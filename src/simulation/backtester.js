/**
 * Backtesting Engine
 * Simulates historical forecasts and compares to actual sales
 */

const _ = require('lodash');
const logger = require('../utils/logger');
const dateHelpers = require('../utils/dateHelpers');
const config = require('../config');
const dataPreprocessor = require('../models/dataPreprocessor');
const forecaster = require('../forecasting/forecaster');
const orderProposal = require('../models/orderProposal');
const accuracyMetrics = require('./accuracyMetrics');

/**
 * Run backtesting simulation for a specific customer and item
 * @param {Object} customerData - Historical customer data
 * @param {string} itemCode - Item to test
 * @param {number} numWeeks - Number of weeks to backtest
 * @param {Object} customConfig - Optional custom configuration
 * @returns {Promise<Object>}
 */
async function backtestItem(customerData, itemCode, numWeeks = 4, customConfig = null) {
  try {
    logger.debug(`Backtesting item ${itemCode} for ${numWeeks} weeks...`);

    // Prepare the data
    const preparedData = dataPreprocessor.prepareDataForForecasting(customerData);
    const itemData = preparedData.items[itemCode];

    if (!itemData) {
      logger.warn(`Item ${itemCode} not found or insufficient data`);
      return null;
    }

    const results = [];
    const timeSeries = itemData.timeSeries;

    // For each week, simulate a forecast and compare to actual
    for (let week = 0; week < numWeeks; week++) {
      // Calculate the date for this simulation
      // Go back (numWeeks - week) * 7 days from today
      const daysBack = (numWeeks - week) * 7;
      const forecastDate = dateHelpers.getDaysBeforeNow(daysBack);
      const forecastDateStr = dateHelpers.formatForSAP(forecastDate);

      // Find the index in time series for this date
      const forecastIndex = timeSeries.findIndex(t => t.ds === forecastDateStr);

      if (forecastIndex === -1 || forecastIndex < config.forecasting.minHistoricalRecords) {
        logger.debug(`Skipping week ${week} - insufficient historical data`);
        continue;
      }

      // Split data: training set (up to forecast date) and test set (actual value)
      const trainingData = timeSeries.slice(0, forecastIndex);

      // Calculate target date (day after tomorrow from forecast date)
      const targetDate = dateHelpers.addDays(forecastDate, config.forecasting.horizonDays);
      const targetDateStr = dateHelpers.formatForSAP(targetDate);

      // Find actual value for target date
      const actualIndex = timeSeries.findIndex(t => t.ds === targetDateStr);
      if (actualIndex === -1) {
        logger.debug(`Skipping week ${week} - no actual data for target date`);
        continue;
      }

      const actualData = timeSeries[actualIndex];

      // Create a temporary item data object with training data only
      const tempItemData = {
        ...itemData,
        timeSeries: trainingData,
      };

      // Temporarily override config if custom config provided
      const originalConfig = { ...config };
      if (customConfig) {
        Object.assign(config, customConfig);
      }

      // Generate forecast
      try {
        const forecast = await forecaster.forecastItem(itemCode, tempItemData);

        if (!forecast) {
          logger.debug(`No forecast generated for week ${week}`);
          continue;
        }

        // Calculate recent pattern from training data
        const recentPattern = orderProposal.analyzeRecentPattern(trainingData, 7);

        // Calculate adjustment
        const adjustment = orderProposal.calculateAdjustmentFactor(
          recentPattern,
          forecast,
          targetDate
        );

        // Calculate proposed quantity
        const proposedQuantity = Math.max(
          config.businessLogic.minOrderQuantity,
          Math.round(forecast.predictedQuantity * adjustment.adjustmentFactor)
        );

        // Store result
        results.push({
          week,
          forecastDate: forecastDateStr,
          targetDate: targetDateStr,
          actual: actualData.y,
          actualSales: actualData.sales,
          actualReturns: actualData.returns,
          actualReturnRate: actualData.sales > 0 ? actualData.returns / actualData.sales : 0,
          baseForecast: forecast.predictedQuantity,
          adjustmentFactor: adjustment.adjustmentFactor,
          proposedQuantity,
          adjustmentReasons: adjustment.reasons,
          forecastLower: forecast.predictedQuantityLower,
          forecastUpper: forecast.predictedQuantityUpper,
          predictedStockout: recentPattern.highSalesWithNoReturns,
          predictedOverstock: recentPattern.highReturnRate,
        });
      } catch (error) {
        logger.error(`Failed to forecast for week ${week}`, { error: error.message });
      } finally {
        // Restore original config
        if (customConfig) {
          Object.assign(config, originalConfig);
        }
      }
    }

    if (results.length === 0) {
      logger.warn(`No results generated for item ${itemCode}`);
      return null;
    }

    // Calculate metrics
    const actual = results.map(r => r.actual);
    const baseForecast = results.map(r => r.baseForecast);
    const proposedForecast = results.map(r => r.proposedQuantity);

    const baseMetrics = accuracyMetrics.calculateAllMetrics(actual, baseForecast);
    const adjustedMetrics = accuracyMetrics.calculateAllMetrics(actual, proposedForecast);
    const confusionMatrix = accuracyMetrics.calculateConfusionMatrix(results);

    return {
      itemCode,
      itemDescription: itemData.itemDescription,
      numWeeks: results.length,
      results,
      baseMetrics: {
        ...baseMetrics,
        quality: accuracyMetrics.classifyForecastQuality(baseMetrics.mape),
      },
      adjustedMetrics: {
        ...adjustedMetrics,
        quality: accuracyMetrics.classifyForecastQuality(adjustedMetrics.mape),
      },
      improvement: {
        mape: baseMetrics.mape - adjustedMetrics.mape,
        mae: baseMetrics.mae - adjustedMetrics.mae,
        rmse: baseMetrics.rmse - adjustedMetrics.rmse,
      },
      confusionMatrix,
    };
  } catch (error) {
    logger.error(`Backtesting failed for item ${itemCode}`, { error: error.message });
    throw error;
  }
}

/**
 * Run backtesting for all items of a customer
 * @param {Object} customerData - Historical customer data
 * @param {number} numWeeks - Number of weeks to backtest
 * @param {Object} customConfig - Optional custom configuration
 * @returns {Promise<Object>}
 */
async function backtestCustomer(customerData, numWeeks = 4, customConfig = null) {
  logger.info(
    `Backtesting customer ${customerData.customerCode} for ${numWeeks} weeks...`
  );

  const preparedData = dataPreprocessor.prepareDataForForecasting(customerData);
  const itemCodes = Object.keys(preparedData.items);

  logger.info(`Backtesting ${itemCodes.length} items...`);

  const itemResults = [];

  for (const itemCode of itemCodes) {
    try {
      const result = await backtestItem(customerData, itemCode, numWeeks, customConfig);
      if (result) {
        itemResults.push(result);
      }
    } catch (error) {
      logger.error(`Failed to backtest item ${itemCode}`, { error: error.message });
    }
  }

  // Calculate aggregate metrics
  const baseMetrics = accuracyMetrics.calculateAggregateMetrics(
    itemResults.map(r => r.baseMetrics)
  );
  const adjustedMetrics = accuracyMetrics.calculateAggregateMetrics(
    itemResults.map(r => r.adjustedMetrics)
  );

  // Calculate overall confusion matrix
  const allResults = _.flatten(itemResults.map(r => r.results));
  const overallConfusionMatrix = accuracyMetrics.calculateConfusionMatrix(allResults);

  logger.info(
    `Backtesting complete for customer ${customerData.customerCode}. ` +
      `Tested ${itemResults.length} items. ` +
      `Base MAPE: ${baseMetrics?.avgMAPE?.toFixed(2)}%, ` +
      `Adjusted MAPE: ${adjustedMetrics?.avgMAPE?.toFixed(2)}%`
  );

  return {
    customerCode: customerData.customerCode,
    customerName: customerData.customerName,
    numWeeks,
    itemCount: itemResults.length,
    itemResults,
    aggregateMetrics: {
      base: baseMetrics,
      adjusted: adjustedMetrics,
      improvement: {
        mape: baseMetrics?.avgMAPE - adjustedMetrics?.avgMAPE,
        mae: baseMetrics?.avgMAE - adjustedMetrics?.avgMAE,
        rmse: baseMetrics?.avgRMSE - adjustedMetrics?.avgRMSE,
      },
    },
    confusionMatrix: overallConfusionMatrix,
  };
}

/**
 * Run backtesting for multiple customers
 * @param {Array} allCustomersData - Array of customer data
 * @param {number} numWeeks - Number of weeks to backtest
 * @param {Object} customConfig - Optional custom configuration
 * @returns {Promise<Array>}
 */
async function backtestAllCustomers(allCustomersData, numWeeks = 4, customConfig = null) {
  logger.info(`Starting backtesting for ${allCustomersData.length} customers...`);

  const results = [];

  for (const customerData of allCustomersData) {
    try {
      const result = await backtestCustomer(customerData, numWeeks, customConfig);
      results.push(result);
    } catch (error) {
      logger.error(`Failed to backtest customer ${customerData.customerCode}`, {
        error: error.message,
      });
    }
  }

  // Calculate overall metrics
  const allBaseMetrics = results.map(r => r.aggregateMetrics.base);
  const allAdjustedMetrics = results.map(r => r.aggregateMetrics.adjusted);

  const overallBase = {
    avgMAPE: _.mean(allBaseMetrics.map(m => m?.avgMAPE).filter(m => m !== null)),
    avgMAE: _.mean(allBaseMetrics.map(m => m?.avgMAE).filter(m => m !== null)),
    avgRMSE: _.mean(allBaseMetrics.map(m => m?.avgRMSE).filter(m => m !== null)),
    avgAccuracy: _.mean(allBaseMetrics.map(m => m?.avgAccuracy).filter(m => m !== null)),
  };

  const overallAdjusted = {
    avgMAPE: _.mean(allAdjustedMetrics.map(m => m?.avgMAPE).filter(m => m !== null)),
    avgMAE: _.mean(allAdjustedMetrics.map(m => m?.avgMAE).filter(m => m !== null)),
    avgRMSE: _.mean(allAdjustedMetrics.map(m => m?.avgRMSE).filter(m => m !== null)),
    avgAccuracy: _.mean(
      allAdjustedMetrics.map(m => m?.avgAccuracy).filter(m => m !== null)
    ),
  };

  logger.info('Backtesting complete for all customers');
  logger.info(`Overall Base MAPE: ${overallBase.avgMAPE?.toFixed(2)}%`);
  logger.info(`Overall Adjusted MAPE: ${overallAdjusted.avgMAPE?.toFixed(2)}%`);
  logger.info(
    `Improvement: ${(overallBase.avgMAPE - overallAdjusted.avgMAPE).toFixed(2)}%`
  );

  return {
    customerResults: results,
    overallMetrics: {
      base: overallBase,
      adjusted: overallAdjusted,
      improvement: {
        mape: overallBase.avgMAPE - overallAdjusted.avgMAPE,
        mae: overallBase.avgMAE - overallAdjusted.avgMAE,
        rmse: overallBase.avgRMSE - overallAdjusted.avgRMSE,
      },
    },
    summary: {
      totalCustomers: results.length,
      totalItems: _.sum(results.map(r => r.itemCount)),
      numWeeks,
    },
  };
}

/**
 * Compare two configurations
 * @param {Array} allCustomersData
 * @param {Object} config1
 * @param {Object} config2
 * @param {number} numWeeks
 * @returns {Promise<Object>}
 */
async function compareConfigurations(
  allCustomersData,
  config1,
  config2,
  numWeeks = 4
) {
  logger.info('Comparing two configurations...');

  const [result1, result2] = await Promise.all([
    backtestAllCustomers(allCustomersData, numWeeks, config1),
    backtestAllCustomers(allCustomersData, numWeeks, config2),
  ]);

  return {
    config1: {
      config: config1,
      metrics: result1.overallMetrics,
    },
    config2: {
      config: config2,
      metrics: result2.overallMetrics,
    },
    winner:
      result1.overallMetrics.adjusted.avgMAPE < result2.overallMetrics.adjusted.avgMAPE
        ? 'config1'
        : 'config2',
  };
}

module.exports = {
  backtestItem,
  backtestCustomer,
  backtestAllCustomers,
  compareConfigurations,
};

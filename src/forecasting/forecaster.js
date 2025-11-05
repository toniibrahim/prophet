/**
 * Forecasting Engine
 * Wrapper for Prophet forecasting using Python
 */

const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');
const holidayCalendar = require('../models/holidayCalendar');
const dateHelpers = require('../utils/dateHelpers');

/**
 * Run Prophet forecast using Python
 * @param {Array} timeSeriesData
 * @param {Array} holidays
 * @returns {Promise<Object>}
 */
function runProphetForecast(timeSeriesData, holidays = null) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'prophetEngine.py');

    // Prepare input data
    const inputData = {
      data: timeSeriesData,
      config: {
        changepoint_prior_scale: config.prophet.changepointPriorScale,
        seasonality_prior_scale: config.prophet.seasonalityPriorScale,
        holidays_prior_scale: config.prophet.holidaysPriorScale,
        seasonality_mode: config.prophet.seasonalityMode,
        daily_seasonality: config.prophet.dailySeasonality,
        weekly_seasonality: config.prophet.weeklySeasonality,
        yearly_seasonality: config.prophet.yearlySeasonality,
        confidence_interval: config.forecasting.confidenceInterval,
        horizon_days: config.forecasting.horizonDays,
      },
      holidays: holidays,
    };

    const inputJson = JSON.stringify(inputData);

    // Spawn Python process
    const python = spawn('python3', [pythonScript]);

    let outputData = '';
    let errorData = '';

    // Send input data to Python script
    python.stdin.write(inputJson);
    python.stdin.end();

    // Collect output
    python.stdout.on('data', data => {
      outputData += data.toString();
    });

    python.stderr.on('data', data => {
      errorData += data.toString();
    });

    python.on('close', code => {
      if (code !== 0) {
        logger.error('Python Prophet script failed', {
          code,
          stderr: errorData,
        });
        reject(new Error(`Prophet script failed: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(outputData);

        if (!result.success) {
          reject(new Error(result.error));
          return;
        }

        resolve(result);
      } catch (error) {
        logger.error('Failed to parse Prophet output', {
          error: error.message,
          output: outputData,
        });
        reject(error);
      }
    });

    python.on('error', error => {
      logger.error('Failed to spawn Python process', { error: error.message });
      reject(error);
    });
  });
}

/**
 * Forecast for a single item
 * @param {Object} itemData - { timeSeries, itemDescription, ... }
 * @param {string} itemCode
 * @returns {Promise<Object>}
 */
async function forecastItem(itemCode, itemData) {
  try {
    logger.debug(`Forecasting item ${itemCode}...`);

    // Prepare time series data (ds, y, regressors)
    const timeSeriesForProphet = itemData.timeSeries.map(row => ({
      ds: row.ds,
      y: row.y,
      is_weekend: row.is_weekend,
      is_ramadan: row.is_ramadan,
      is_eid_adha: row.is_eid_adha,
      is_back_to_school: row.is_back_to_school,
    }));

    // Get holidays for the date range
    const startDate = dateHelpers.parseSAPDate(itemData.timeSeries[0].ds);
    const endDate = dateHelpers.getDaysFromNow(config.forecasting.horizonDays);
    const holidays = holidayCalendar.getHolidaysForRange(startDate, endDate);

    // Run forecast
    const forecastResult = await runProphetForecast(timeSeriesForProphet, holidays);

    // Extract forecast for target date (day after tomorrow)
    const targetDate = dateHelpers.getDaysFromNow(config.forecasting.horizonDays);
    const targetDateStr = dateHelpers.formatForSAP(targetDate);

    const targetForecast = forecastResult.forecast.find(f => f.ds === targetDateStr);

    if (!targetForecast) {
      logger.warn(`No forecast found for target date ${targetDateStr} for item ${itemCode}`);
      return null;
    }

    return {
      itemCode,
      itemDescription: itemData.itemDescription,
      forecastDate: targetDateStr,
      predictedQuantity: Math.max(0, Math.round(targetForecast.yhat)),
      predictedQuantityLower: Math.max(0, Math.round(targetForecast.yhat_lower)),
      predictedQuantityUpper: Math.max(0, Math.round(targetForecast.yhat_upper)),
      historicalAverage: itemData.averageDailySales,
      totalHistoricalSales: itemData.totalSales,
      totalHistoricalReturns: itemData.totalReturns,
      allForecasts: forecastResult.forecast,
    };
  } catch (error) {
    logger.error(`Failed to forecast item ${itemCode}`, { error: error.message });
    throw error;
  }
}

/**
 * Forecast for all items of a customer
 * @param {Object} preparedData - { customerCode, items }
 * @returns {Promise<Object>}
 */
async function forecastCustomer(preparedData) {
  logger.info(`Forecasting for customer ${preparedData.customerCode}...`);

  const forecasts = [];
  const errors = [];

  const itemCodes = Object.keys(preparedData.items);

  for (const itemCode of itemCodes) {
    try {
      const itemData = preparedData.items[itemCode];
      const forecast = await forecastItem(itemCode, itemData);

      if (forecast) {
        forecasts.push(forecast);
      }
    } catch (error) {
      logger.error(`Failed to forecast item ${itemCode} for customer ${preparedData.customerCode}`, {
        error: error.message,
      });
      errors.push({
        itemCode,
        error: error.message,
      });
    }
  }

  logger.info(
    `Completed forecasting for customer ${preparedData.customerCode}: ${forecasts.length} items forecasted, ${errors.length} errors`
  );

  return {
    customerCode: preparedData.customerCode,
    customerName: preparedData.customerName,
    forecastDate: dateHelpers.formatForSAP(
      dateHelpers.getDaysFromNow(config.forecasting.horizonDays)
    ),
    generatedAt: dateHelpers.formatDate(dateHelpers.getCurrentDate()),
    forecasts,
    errors,
  };
}

/**
 * Forecast for all customers
 * @param {Array} allPreparedData
 * @returns {Promise<Array>}
 */
async function forecastAllCustomers(allPreparedData) {
  logger.info(`Forecasting for ${allPreparedData.length} customers...`);

  const allForecasts = [];

  for (const preparedData of allPreparedData) {
    try {
      const customerForecast = await forecastCustomer(preparedData);
      allForecasts.push(customerForecast);
    } catch (error) {
      logger.error(`Failed to forecast customer ${preparedData.customerCode}`, {
        error: error.message,
      });
    }
  }

  logger.info(`Completed forecasting for all customers`);

  return allForecasts;
}

module.exports = {
  runProphetForecast,
  forecastItem,
  forecastCustomer,
  forecastAllCustomers,
};

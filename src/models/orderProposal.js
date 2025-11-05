/**
 * Order Proposal Business Logic
 * Converts forecasts into actionable order proposals
 * Handles special cases: returns, stockouts, special events, etc.
 */

const _ = require('lodash');
const logger = require('../utils/logger');
const config = require('../config');
const dateHelpers = require('../utils/dateHelpers');
const holidayCalendar = require('./holidayCalendar');
const dataPreprocessor = require('./dataPreprocessor');

/**
 * Analyze recent sales pattern for an item
 * @param {Array} timeSeries
 * @param {number} lookbackDays
 * @returns {Object}
 */
function analyzeRecentPattern(timeSeries, lookbackDays = 7) {
  // Get last N days
  const recentData = timeSeries.slice(-lookbackDays);

  const sales = recentData.map(d => d.sales);
  const returns = recentData.map(d => d.returns);

  const totalSales = _.sum(sales);
  const totalReturns = _.sum(returns);
  const returnRate = totalSales > 0 ? totalReturns / totalSales : 0;

  // Check for stockout indicators
  const daysWithSales = sales.filter(s => s > 0).length;
  const daysWithZeroReturns = returns.filter(r => r === 0).length;
  const highSalesWithNoReturns = daysWithSales > 0 && daysWithZeroReturns === lookbackDays;

  // Check for overstock indicators
  const highReturnRate = returnRate > config.businessLogic.overstockReturnThreshold;

  // Check for increasing trend
  const firstHalf = sales.slice(0, Math.floor(sales.length / 2));
  const secondHalf = sales.slice(Math.floor(sales.length / 2));
  const isIncreasing = _.mean(secondHalf) > _.mean(firstHalf);

  return {
    totalSales,
    totalReturns,
    returnRate,
    averageDailySales: _.mean(sales),
    averageDailyReturns: _.mean(returns),
    highSalesWithNoReturns,
    highReturnRate,
    isIncreasing,
    daysWithSales,
  };
}

/**
 * Calculate adjustment factor based on business rules
 * @param {Object} pattern - Recent sales pattern
 * @param {Object} forecast - Forecast data
 * @param {Date} targetDate - Forecast target date
 * @returns {Object} { adjustmentFactor, reason }
 */
function calculateAdjustmentFactor(pattern, forecast, targetDate) {
  let adjustmentFactor = 1.0;
  const reasons = [];

  // Rule 1: Stockout Detection
  // If sales are high and returns are consistently zero, likely stockout
  if (pattern.highSalesWithNoReturns && pattern.averageDailySales > 0) {
    adjustmentFactor *= config.businessLogic.stockoutMultiplier;
    reasons.push(
      `Potential stockout detected (high sales with zero returns) - increasing by ${((config.businessLogic.stockoutMultiplier - 1) * 100).toFixed(0)}%`
    );
  }

  // Rule 2: Overstock Detection
  // If return rate is high, reduce order quantity
  if (pattern.highReturnRate) {
    adjustmentFactor *= config.businessLogic.overstockMultiplier;
    reasons.push(
      `High return rate (${(pattern.returnRate * 100).toFixed(1)}%) detected - reducing by ${((1 - config.businessLogic.overstockMultiplier) * 100).toFixed(0)}%`
    );
  }

  // Rule 3: Increasing Trend
  // If sales are trending up, increase slightly
  if (pattern.isIncreasing && !pattern.highReturnRate) {
    adjustmentFactor *= 1.1;
    reasons.push('Increasing sales trend detected - increasing by 10%');
  }

  // Rule 4: Special Events Adjustment
  const specialEvents = holidayCalendar.checkSpecialEvents(targetDate);

  if (specialEvents.events.includes('ramadan')) {
    // During Ramadan, consumption patterns change
    adjustmentFactor *= 1.2;
    reasons.push('Ramadan period - increasing by 20%');
  }

  if (specialEvents.events.includes('eid_adha')) {
    // During Eid, typically higher demand
    adjustmentFactor *= 1.3;
    reasons.push('Eid al-Adha period - increasing by 30%');
  }

  if (specialEvents.events.includes('back_to_school')) {
    // Back to school period
    adjustmentFactor *= 1.15;
    reasons.push('Back to school period - increasing by 15%');
  }

  // Rule 5: Weekend Adjustment
  if (dateHelpers.isWeekendDay(targetDate)) {
    // Weekends might have different patterns
    // This can be configured based on business knowledge
    if (pattern.averageDailySales > 0) {
      // Check if weekends typically have higher or lower sales
      // For now, keep neutral
    }
  }

  // Rule 6: Safety Stock
  // Always add a safety stock percentage
  adjustmentFactor *= 1 + config.businessLogic.safetyStockPercentage;
  reasons.push(
    `Safety stock of ${(config.businessLogic.safetyStockPercentage * 100).toFixed(0)}%`
  );

  return {
    adjustmentFactor,
    reasons,
  };
}

/**
 * Create order proposal for a single item
 * @param {Object} forecast - Forecast data for item
 * @param {Object} itemData - Historical item data
 * @returns {Object}
 */
function createItemOrderProposal(forecast, itemData) {
  // Analyze recent pattern
  const recentPattern = analyzeRecentPattern(itemData.timeSeries, 7);

  // Get target date
  const targetDate = dateHelpers.parseSAPDate(forecast.forecastDate);

  // Calculate adjustment factor
  const adjustment = calculateAdjustmentFactor(recentPattern, forecast, targetDate);

  // Calculate proposed order quantity
  const baseForecast = forecast.predictedQuantity;
  const adjustedForecast = baseForecast * adjustment.adjustmentFactor;
  const proposedQuantity = Math.max(
    config.businessLogic.minOrderQuantity,
    Math.round(adjustedForecast)
  );

  // Calculate confidence level based on prediction interval width
  const intervalWidth = forecast.predictedQuantityUpper - forecast.predictedQuantityLower;
  const relativeWidth = baseForecast > 0 ? intervalWidth / baseForecast : 1;
  const confidence = Math.max(0, Math.min(100, 100 - relativeWidth * 50));

  return {
    itemCode: forecast.itemCode,
    itemDescription: forecast.itemDescription,
    forecastDate: forecast.forecastDate,
    deliveryDate: forecast.forecastDate, // Day after tomorrow
    generationDate: dateHelpers.formatForSAP(dateHelpers.getCurrentDate()),
    baseForecast: baseForecast,
    adjustmentFactor: adjustment.adjustmentFactor,
    proposedQuantity: proposedQuantity,
    confidenceLevel: Math.round(confidence),
    adjustmentReasons: adjustment.reasons,
    historicalContext: {
      averageDailySales: recentPattern.averageDailySales,
      recentReturnRate: recentPattern.returnRate,
      totalHistoricalSales: itemData.totalSales,
      totalHistoricalReturns: itemData.totalReturns,
    },
    specialEvents: holidayCalendar.checkSpecialEvents(targetDate).events,
    alerts: generateAlerts(recentPattern, baseForecast, proposedQuantity),
  };
}

/**
 * Generate alerts based on analysis
 * @param {Object} pattern
 * @param {number} baseForecast
 * @param {number} proposedQuantity
 * @returns {Array}
 */
function generateAlerts(pattern, baseForecast, proposedQuantity) {
  const alerts = [];

  if (pattern.highSalesWithNoReturns) {
    alerts.push({
      type: 'STOCKOUT_RISK',
      severity: 'high',
      message: 'Potential stockout detected - customer may be facing inventory shortage',
    });
  }

  if (pattern.highReturnRate) {
    alerts.push({
      type: 'OVERSTOCK_RISK',
      severity: 'medium',
      message: `High return rate (${(pattern.returnRate * 100).toFixed(1)}%) - customer may be overstocked`,
    });
  }

  if (baseForecast === 0 && pattern.averageDailySales > 0) {
    alerts.push({
      type: 'FORECAST_ANOMALY',
      severity: 'medium',
      message: 'Forecast is zero but historical sales exist - review recommended',
    });
  }

  if (proposedQuantity > pattern.averageDailySales * 3) {
    alerts.push({
      type: 'LARGE_ORDER',
      severity: 'low',
      message: 'Proposed quantity is significantly higher than recent average - verify with customer',
    });
  }

  return alerts;
}

/**
 * Create order proposals for all items of a customer
 * @param {Object} customerForecast
 * @param {Object} preparedData
 * @returns {Object}
 */
function createCustomerOrderProposal(customerForecast, preparedData) {
  logger.info(`Creating order proposals for customer ${customerForecast.customerCode}...`);

  const proposals = [];

  customerForecast.forecasts.forEach(forecast => {
    const itemData = preparedData.items[forecast.itemCode];

    if (itemData) {
      const proposal = createItemOrderProposal(forecast, itemData);
      proposals.push(proposal);
    }
  });

  // Sort by proposed quantity (descending) to prioritize high-volume items
  const sortedProposals = _.orderBy(proposals, ['proposedQuantity'], ['desc']);

  // Calculate summary statistics
  const summary = {
    totalItems: sortedProposals.length,
    totalQuantity: _.sumBy(sortedProposals, 'proposedQuantity'),
    averageConfidence: _.meanBy(sortedProposals, 'confidenceLevel'),
    itemsWithAlerts: sortedProposals.filter(p => p.alerts.length > 0).length,
    stockoutRisks: sortedProposals.filter(p =>
      p.alerts.some(a => a.type === 'STOCKOUT_RISK')
    ).length,
    overstockRisks: sortedProposals.filter(p =>
      p.alerts.some(a => a.type === 'OVERSTOCK_RISK')
    ).length,
  };

  return {
    customerCode: customerForecast.customerCode,
    customerName: customerForecast.customerName,
    forecastDate: customerForecast.forecastDate,
    generatedAt: customerForecast.generatedAt,
    proposals: sortedProposals,
    summary,
  };
}

/**
 * Create order proposals for all customers
 * @param {Array} allForecasts
 * @param {Array} allPreparedData
 * @returns {Array}
 */
function createAllOrderProposals(allForecasts, allPreparedData) {
  logger.info('Creating order proposals for all customers...');

  const allProposals = [];

  // Create a map for quick lookup
  const preparedDataMap = {};
  allPreparedData.forEach(data => {
    preparedDataMap[data.customerCode] = data;
  });

  allForecasts.forEach(customerForecast => {
    const preparedData = preparedDataMap[customerForecast.customerCode];

    if (preparedData) {
      const customerProposal = createCustomerOrderProposal(customerForecast, preparedData);
      allProposals.push(customerProposal);
    }
  });

  logger.info(`Created order proposals for ${allProposals.length} customers`);

  return allProposals;
}

module.exports = {
  analyzeRecentPattern,
  calculateAdjustmentFactor,
  createItemOrderProposal,
  createCustomerOrderProposal,
  createAllOrderProposals,
};

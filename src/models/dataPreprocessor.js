/**
 * Data Preprocessing and Feature Engineering
 * Transforms SAP B1 data into format suitable for Prophet forecasting
 */

const _ = require('lodash');
const dateHelpers = require('../utils/dateHelpers');
const logger = require('../utils/logger');
const config = require('../config');
const holidayCalendar = require('./holidayCalendar');

/**
 * Aggregate sales and returns by date and item
 * @param {Array} salesData
 * @param {Array} returnsData
 * @returns {Array}
 */
function aggregateByDateAndItem(salesData, returnsData) {
  // Group sales by date and item
  const salesByDateItem = _.groupBy(salesData, item => {
    const date = dateHelpers.formatForSAP(dateHelpers.parseSAPDate(item.docDate));
    return `${date}|${item.itemCode}`;
  });

  // Group returns by date and item
  const returnsByDateItem = _.groupBy(returnsData, item => {
    const date = dateHelpers.formatForSAP(dateHelpers.parseSAPDate(item.docDate));
    return `${date}|${item.itemCode}`;
  });

  // Create aggregated data
  const aggregated = [];
  const allKeys = new Set([
    ...Object.keys(salesByDateItem),
    ...Object.keys(returnsByDateItem),
  ]);

  allKeys.forEach(key => {
    const [dateStr, itemCode] = key.split('|');
    const salesItems = salesByDateItem[key] || [];
    const returnItems = returnsByDateItem[key] || [];

    const totalSales = _.sumBy(salesItems, 'quantity');
    const totalReturns = _.sumBy(returnItems, 'quantity');
    const netSales = totalSales - totalReturns;

    // Get item description from first item
    const itemDescription =
      salesItems[0]?.itemDescription || returnItems[0]?.itemDescription || '';

    aggregated.push({
      date: dateStr,
      itemCode,
      itemDescription,
      salesQuantity: totalSales,
      returnsQuantity: totalReturns,
      netSalesQuantity: netSales,
      salesValue: _.sumBy(salesItems, 'lineTotal'),
      returnsValue: _.sumBy(returnItems, 'lineTotal'),
    });
  });

  return aggregated;
}

/**
 * Create time series data for Prophet (ds, y format)
 * @param {Array} aggregatedData
 * @param {string} itemCode
 * @returns {Array}
 */
function createTimeSeriesForItem(aggregatedData, itemCode) {
  const itemData = aggregatedData.filter(d => d.itemCode === itemCode);

  if (itemData.length === 0) {
    return [];
  }

  // Sort by date
  const sorted = _.sortBy(itemData, 'date');

  // Create complete date range (fill missing dates with 0)
  const startDate = dateHelpers.parseSAPDate(sorted[0].date);
  const endDate = dateHelpers.parseSAPDate(sorted[sorted.length - 1].date);
  const dateRange = dateHelpers.createDateArray(
    startDate,
    dateHelpers.differenceInDays(endDate, startDate) + 1
  );

  // Create lookup map
  const dataMap = {};
  sorted.forEach(item => {
    dataMap[item.date] = item;
  });

  // Create time series with filled dates
  const timeSeries = dateRange.map(date => {
    const dateStr = dateHelpers.formatForSAP(date);
    const data = dataMap[dateStr] || {
      salesQuantity: 0,
      returnsQuantity: 0,
      netSalesQuantity: 0,
    };

    return {
      ds: dateStr,
      y: data.netSalesQuantity,
      sales: data.salesQuantity,
      returns: data.returnsQuantity,
    };
  });

  return timeSeries;
}

/**
 * Add features/regressors to time series data
 * @param {Array} timeSeries
 * @returns {Array}
 */
function addFeatures(timeSeries) {
  return timeSeries.map(row => {
    const date = dateHelpers.parseSAPDate(row.ds);

    // Day of week features
    const dayOfWeek = dateHelpers.getDayOfWeek(date);
    const isWeekend = dateHelpers.isWeekendDay(date) ? 1 : 0;

    // Special events
    const specialEvents = holidayCalendar.checkSpecialEvents(date);
    const isRamadan = specialEvents.events.includes('ramadan') ? 1 : 0;
    const isEidAdha = specialEvents.events.includes('eid_adha') ? 1 : 0;
    const isBackToSchool = specialEvents.events.includes('back_to_school') ? 1 : 0;

    // Return rate (indicator of potential waste or stockout)
    const returnRate = row.sales > 0 ? row.returns / row.sales : 0;

    // Stockout indicator (high sales with no returns might indicate stockout)
    const potentialStockout = row.sales > 0 && row.returns === 0 ? 1 : 0;

    // Overstock indicator (high return rate)
    const potentialOverstock =
      returnRate > config.businessLogic.overstockReturnThreshold ? 1 : 0;

    return {
      ...row,
      day_of_week: dayOfWeek,
      is_weekend: isWeekend,
      is_ramadan: isRamadan,
      is_eid_adha: isEidAdha,
      is_back_to_school: isBackToSchool,
      return_rate: returnRate,
      potential_stockout: potentialStockout,
      potential_overstock: potentialOverstock,
    };
  });
}

/**
 * Prepare data for Prophet forecasting
 * @param {Object} customerData - { customerCode, sales, returns }
 * @returns {Object} - { customerCode, items: { itemCode: timeSeriesData } }
 */
function prepareDataForForecasting(customerData) {
  logger.info(`Preparing data for customer ${customerData.customerCode}...`);

  // Aggregate data by date and item
  const aggregated = aggregateByDateAndItem(customerData.sales, customerData.returns);

  // Get unique items
  const uniqueItems = _.uniq(aggregated.map(d => d.itemCode));

  logger.info(`Found ${uniqueItems.length} unique items for customer ${customerData.customerCode}`);

  // Create time series for each item
  const itemsData = {};
  uniqueItems.forEach(itemCode => {
    const timeSeries = createTimeSeriesForItem(aggregated, itemCode);

    // Only include items with sufficient historical data
    if (timeSeries.length >= config.forecasting.minHistoricalRecords) {
      const timeSeriesWithFeatures = addFeatures(timeSeries);
      itemsData[itemCode] = {
        timeSeries: timeSeriesWithFeatures,
        itemDescription: aggregated.find(d => d.itemCode === itemCode)?.itemDescription,
        totalSales: _.sumBy(timeSeries, 'sales'),
        totalReturns: _.sumBy(timeSeries, 'returns'),
        averageDailySales: _.meanBy(timeSeries, 'y'),
      };
    } else {
      logger.debug(
        `Skipping item ${itemCode} - insufficient historical data (${timeSeries.length} records, minimum ${config.forecasting.minHistoricalRecords})`
      );
    }
  });

  logger.info(
    `Prepared ${Object.keys(itemsData).length} items with sufficient data for forecasting`
  );

  return {
    customerCode: customerData.customerCode,
    customerName: customerData.customerName,
    items: itemsData,
  };
}

/**
 * Calculate statistics for an item's historical data
 * @param {Array} timeSeries
 * @returns {Object}
 */
function calculateItemStatistics(timeSeries) {
  const sales = timeSeries.map(d => d.sales);
  const returns = timeSeries.map(d => d.returns);
  const netSales = timeSeries.map(d => d.y);

  return {
    totalRecords: timeSeries.length,
    totalSales: _.sum(sales),
    totalReturns: _.sum(returns),
    totalNetSales: _.sum(netSales),
    averageDailySales: _.mean(sales),
    averageDailyReturns: _.mean(returns),
    averageDailyNetSales: _.mean(netSales),
    maxDailySales: _.max(sales),
    minDailySales: _.min(sales),
    stdDevSales: calculateStdDev(sales),
    returnRate: _.sum(returns) / _.sum(sales) || 0,
    daysWithSales: sales.filter(s => s > 0).length,
    daysWithReturns: returns.filter(r => r > 0).length,
    daysWithZeroReturns: returns.filter(r => r === 0).length,
  };
}

/**
 * Calculate standard deviation
 * @param {Array} values
 * @returns {number}
 */
function calculateStdDev(values) {
  const mean = _.mean(values);
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(_.mean(squaredDiffs));
}

/**
 * Filter outliers using IQR method
 * @param {Array} timeSeries
 * @returns {Array}
 */
function filterOutliers(timeSeries) {
  const values = timeSeries.map(d => d.y).filter(v => v > 0);

  if (values.length === 0) {
    return timeSeries;
  }

  const sorted = _.sortBy(values);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Replace outliers with median instead of removing
  const median = sorted[Math.floor(sorted.length / 2)];

  return timeSeries.map(row => {
    if (row.y > 0 && (row.y < lowerBound || row.y > upperBound)) {
      return { ...row, y: median };
    }
    return row;
  });
}

module.exports = {
  aggregateByDateAndItem,
  createTimeSeriesForItem,
  addFeatures,
  prepareDataForForecasting,
  calculateItemStatistics,
  filterOutliers,
};

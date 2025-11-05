/**
 * Simulation Report Generator
 * Creates Excel reports for backtesting and parameter tuning results
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const config = require('../config');
const dateHelpers = require('../utils/dateHelpers');

/**
 * Ensure output directory exists
 */
function ensureOutputDirectory() {
  if (!fs.existsSync(config.output.path)) {
    fs.mkdirSync(config.output.path, { recursive: true });
  }
}

/**
 * Generate backtesting report for a customer
 * @param {Object} backtestResult
 * @returns {string} - Path to generated file
 */
function generateBacktestReport(backtestResult) {
  try {
    logger.info('Generating backtest report...');

    ensureOutputDirectory();

    const workbook = XLSX.utils.book_new();

    // Summary worksheet
    const summarySheet = createBacktestSummarySheet(backtestResult);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Item details worksheet
    const itemsSheet = createBacktestItemsSheet(backtestResult);
    XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Item Details');

    // Weekly details worksheet
    const weeklySheet = createBacktestWeeklySheet(backtestResult);
    XLSX.utils.book_append_sheet(workbook, weeklySheet, 'Weekly Details');

    // Confusion matrix worksheet
    const confusionSheet = createConfusionMatrixSheet(backtestResult);
    XLSX.utils.book_append_sheet(workbook, confusionSheet, 'Detection Accuracy');

    // Generate filename
    const timestamp = dateHelpers.formatDate(dateHelpers.getCurrentDate(), 'yyyyMMdd_HHmmss');
    const filename = `backtest_${backtestResult.customerCode}_${timestamp}.xlsx`;
    const filepath = path.join(config.output.path, filename);

    XLSX.writeFile(workbook, filepath);

    logger.info(`Backtest report generated: ${filepath}`);
    return filepath;
  } catch (error) {
    logger.error('Failed to generate backtest report', { error: error.message });
    throw error;
  }
}

/**
 * Create summary sheet for backtest
 */
function createBacktestSummarySheet(result) {
  const data = [];

  // Header
  data.push(['Backtesting Results Summary']);
  data.push(['Customer Code', result.customerCode]);
  data.push(['Customer Name', result.customerName || result.customerCode]);
  data.push(['Number of Weeks Tested', result.numWeeks]);
  data.push(['Number of Items', result.itemCount]);
  data.push(['Generated At', dateHelpers.formatDate(dateHelpers.getCurrentDate())]);
  data.push([]);

  // Base Forecast Metrics
  data.push(['Base Forecast Metrics (Prophet Only)']);
  data.push(['Metric', 'Value']);
  const base = result.aggregateMetrics?.base;
  if (base) {
    data.push(['Average MAPE', `${base.avgMAPE?.toFixed(2)}%`]);
    data.push(['Average MAE', base.avgMAE?.toFixed(2)]);
    data.push(['Average RMSE', base.avgRMSE?.toFixed(2)]);
    data.push(['Average Accuracy', `${base.avgAccuracy?.toFixed(2)}%`]);
    data.push(['Total Actual', base.totalActual]);
    data.push(['Total Forecast', base.totalForecast]);
  }
  data.push([]);

  // Adjusted Forecast Metrics
  data.push(['Adjusted Forecast Metrics (With Business Logic)']);
  data.push(['Metric', 'Value']);
  const adjusted = result.aggregateMetrics?.adjusted;
  if (adjusted) {
    data.push(['Average MAPE', `${adjusted.avgMAPE?.toFixed(2)}%`]);
    data.push(['Average MAE', adjusted.avgMAE?.toFixed(2)]);
    data.push(['Average RMSE', adjusted.avgRMSE?.toFixed(2)]);
    data.push(['Average Accuracy', `${adjusted.avgAccuracy?.toFixed(2)}%`]);
    data.push(['Total Actual', adjusted.totalActual]);
    data.push(['Total Forecast', adjusted.totalForecast]);
  }
  data.push([]);

  // Improvement
  data.push(['Improvement (Adjusted vs Base)']);
  data.push(['Metric', 'Improvement']);
  const improvement = result.aggregateMetrics?.improvement;
  if (improvement) {
    data.push(['MAPE Reduction', `${improvement.mape?.toFixed(2)}%`]);
    data.push(['MAE Reduction', improvement.mae?.toFixed(2)]);
    data.push(['RMSE Reduction', improvement.rmse?.toFixed(2)]);
  }
  data.push([]);

  // Stockout/Overstock Detection
  data.push(['Stockout Detection Accuracy']);
  const stockout = result.confusionMatrix?.stockout;
  if (stockout) {
    data.push(['Accuracy', `${stockout.accuracy?.toFixed(2)}%`]);
    data.push(['Precision', stockout.precision?.toFixed(3)]);
    data.push(['Recall', stockout.recall?.toFixed(3)]);
    data.push(['True Positives', stockout.truePositive]);
    data.push(['False Positives', stockout.falsePositive]);
    data.push(['True Negatives', stockout.trueNegative]);
    data.push(['False Negatives', stockout.falseNegative]);
  }
  data.push([]);

  data.push(['Overstock Detection Accuracy']);
  const overstock = result.confusionMatrix?.overstock;
  if (overstock) {
    data.push(['Accuracy', `${overstock.accuracy?.toFixed(2)}%`]);
    data.push(['Precision', overstock.precision?.toFixed(3)]);
    data.push(['Recall', overstock.recall?.toFixed(3)]);
    data.push(['True Positives', overstock.truePositive]);
    data.push(['False Positives', overstock.falsePositive]);
    data.push(['True Negatives', overstock.trueNegative]);
    data.push(['False Negatives', overstock.falseNegative]);
  }

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Create items detail sheet
 */
function createBacktestItemsSheet(result) {
  const data = [];

  // Header
  data.push([
    'Item Code',
    'Item Description',
    'Weeks Tested',
    'Base MAPE %',
    'Adjusted MAPE %',
    'Improvement %',
    'Base MAE',
    'Adjusted MAE',
    'Base Accuracy %',
    'Adjusted Accuracy %',
    'Quality Base',
    'Quality Adjusted',
  ]);

  result.itemResults?.forEach(item => {
    data.push([
      item.itemCode,
      item.itemDescription,
      item.numWeeks,
      item.baseMetrics?.mape?.toFixed(2),
      item.adjustedMetrics?.mape?.toFixed(2),
      item.improvement?.mape?.toFixed(2),
      item.baseMetrics?.mae?.toFixed(2),
      item.adjustedMetrics?.mae?.toFixed(2),
      item.baseMetrics?.accuracy?.toFixed(2),
      item.adjustedMetrics?.accuracy?.toFixed(2),
      item.baseMetrics?.quality,
      item.adjustedMetrics?.quality,
    ]);
  });

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Create weekly details sheet
 */
function createBacktestWeeklySheet(result) {
  const data = [];

  // Header
  data.push([
    'Item Code',
    'Week',
    'Forecast Date',
    'Target Date',
    'Actual',
    'Base Forecast',
    'Proposed Qty',
    'Error Base',
    'Error Adjusted',
    'Actual Sales',
    'Actual Returns',
    'Return Rate %',
    'Predicted Stockout',
    'Predicted Overstock',
    'Adjustment Factor',
    'Adjustment Reasons',
  ]);

  result.itemResults?.forEach(item => {
    item.results?.forEach(week => {
      data.push([
        item.itemCode,
        week.week + 1,
        week.forecastDate,
        week.targetDate,
        week.actual,
        week.baseForecast,
        week.proposedQuantity,
        Math.abs(week.actual - week.baseForecast).toFixed(2),
        Math.abs(week.actual - week.proposedQuantity).toFixed(2),
        week.actualSales,
        week.actualReturns,
        (week.actualReturnRate * 100).toFixed(1),
        week.predictedStockout ? 'Yes' : 'No',
        week.predictedOverstock ? 'Yes' : 'No',
        week.adjustmentFactor?.toFixed(2),
        week.adjustmentReasons?.join('; '),
      ]);
    });
  });

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Create confusion matrix sheet
 */
function createConfusionMatrixSheet(result) {
  const data = [];

  // Stockout confusion matrix
  data.push(['Stockout Detection - Confusion Matrix']);
  data.push(['', 'Actual Stockout', 'Actual No Stockout']);
  const stockout = result.confusionMatrix?.stockout;
  if (stockout) {
    data.push([
      'Predicted Stockout',
      stockout.truePositive,
      stockout.falsePositive,
    ]);
    data.push([
      'Predicted No Stockout',
      stockout.falseNegative,
      stockout.trueNegative,
    ]);
    data.push([]);
    data.push(['Accuracy', `${stockout.accuracy?.toFixed(2)}%`]);
    data.push(['Precision', stockout.precision?.toFixed(3)]);
    data.push(['Recall', stockout.recall?.toFixed(3)]);
  }
  data.push([]);
  data.push([]);

  // Overstock confusion matrix
  data.push(['Overstock Detection - Confusion Matrix']);
  data.push(['', 'Actual Overstock', 'Actual No Overstock']);
  const overstock = result.confusionMatrix?.overstock;
  if (overstock) {
    data.push([
      'Predicted Overstock',
      overstock.truePositive,
      overstock.falsePositive,
    ]);
    data.push([
      'Predicted No Overstock',
      overstock.falseNegative,
      overstock.trueNegative,
    ]);
    data.push([]);
    data.push(['Accuracy', `${overstock.accuracy?.toFixed(2)}%`]);
    data.push(['Precision', overstock.precision?.toFixed(3)]);
    data.push(['Recall', overstock.recall?.toFixed(3)]);
  }

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Generate parameter tuning report
 * @param {Object} tuningResult
 * @returns {string} - Path to generated file
 */
function generateTuningReport(tuningResult) {
  try {
    logger.info('Generating parameter tuning report...');

    ensureOutputDirectory();

    const workbook = XLSX.utils.book_new();

    // Summary worksheet
    const summarySheet = createTuningSummarySheet(tuningResult);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // All results worksheet
    const resultsSheet = createTuningResultsSheet(tuningResult);
    XLSX.utils.book_append_sheet(workbook, resultsSheet, 'All Configurations');

    // Top 10 worksheet
    const top10Sheet = createTop10Sheet(tuningResult);
    XLSX.utils.book_append_sheet(workbook, top10Sheet, 'Top 10');

    // Generate filename
    const timestamp = dateHelpers.formatDate(dateHelpers.getCurrentDate(), 'yyyyMMdd_HHmmss');
    const filename = `parameter_tuning_${timestamp}.xlsx`;
    const filepath = path.join(config.output.path, filename);

    XLSX.writeFile(workbook, filepath);

    logger.info(`Parameter tuning report generated: ${filepath}`);
    return filepath;
  } catch (error) {
    logger.error('Failed to generate tuning report', { error: error.message });
    throw error;
  }
}

/**
 * Create tuning summary sheet
 */
function createTuningSummarySheet(result) {
  const data = [];

  data.push(['Parameter Tuning Results']);
  data.push(['Generated At', dateHelpers.formatDate(dateHelpers.getCurrentDate())]);
  data.push(['Optimization Metric', result.metric]);
  data.push(['Total Combinations Tested', result.totalCombinations]);
  data.push(['Successful Tests', result.successfulTests]);
  data.push([]);

  // Best configuration
  data.push(['BEST CONFIGURATION']);
  data.push(['Metric Value', result.bestMetrics?.[result.metric]?.toFixed(2)]);
  data.push([]);
  data.push(['Prophet Parameters']);
  Object.entries(result.bestConfig?.prophet || {}).forEach(([key, value]) => {
    data.push([key, value]);
  });
  data.push([]);
  data.push(['Business Logic Parameters']);
  Object.entries(result.bestConfig?.businessLogic || {}).forEach(([key, value]) => {
    data.push([key, value]);
  });
  data.push([]);

  // Worst configuration (for comparison)
  data.push(['WORST CONFIGURATION']);
  data.push(['Metric Value', result.worstMetrics?.[result.metric]?.toFixed(2)]);
  data.push([]);

  // Improvement
  data.push(['IMPROVEMENT']);
  data.push(['Absolute Improvement', result.improvement?.value?.toFixed(2)]);
  data.push(['Percentage Improvement', `${result.improvement?.percentage?.toFixed(2)}%`]);

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Create all results sheet
 */
function createTuningResultsSheet(result) {
  const data = [];

  // Header
  const header = ['Rank', 'MAPE', 'MAE', 'RMSE', 'Accuracy'];

  // Add parameter columns
  const firstConfig = result.allResults[0]?.config;
  if (firstConfig) {
    Object.keys(firstConfig.prophet || {}).forEach(key => {
      header.push(`Prophet: ${key}`);
    });
    Object.keys(firstConfig.businessLogic || {}).forEach(key => {
      header.push(`Business: ${key}`);
    });
  }

  data.push(header);

  // Add all results
  result.allResults?.forEach((res, index) => {
    const row = [
      index + 1,
      res.metrics.avgMAPE?.toFixed(2),
      res.metrics.avgMAE?.toFixed(2),
      res.metrics.avgRMSE?.toFixed(2),
      res.metrics.avgAccuracy?.toFixed(2),
    ];

    // Add parameter values
    Object.values(res.config?.prophet || {}).forEach(value => {
      row.push(value);
    });
    Object.values(res.config?.businessLogic || {}).forEach(value => {
      row.push(value);
    });

    data.push(row);
  });

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Create top 10 sheet
 */
function createTop10Sheet(result) {
  const data = [];

  data.push(['Top 10 Parameter Configurations']);
  data.push([]);

  const top10 = result.allResults?.slice(0, 10) || [];

  top10.forEach((res, index) => {
    data.push([`Rank ${index + 1}`]);
    data.push(['MAPE', `${res.metrics.avgMAPE?.toFixed(2)}%`]);
    data.push(['MAE', res.metrics.avgMAE?.toFixed(2)]);
    data.push(['RMSE', res.metrics.avgRMSE?.toFixed(2)]);
    data.push(['Accuracy', `${res.metrics.avgAccuracy?.toFixed(2)}%`]);
    data.push([]);
    data.push(['Prophet Parameters']);
    Object.entries(res.config?.prophet || {}).forEach(([key, value]) => {
      data.push([key, value]);
    });
    data.push(['Business Logic Parameters']);
    Object.entries(res.config?.businessLogic || {}).forEach(([key, value]) => {
      data.push([key, value]);
    });
    data.push([]);
    data.push([]);
  });

  return XLSX.utils.aoa_to_sheet(data);
}

module.exports = {
  generateBacktestReport,
  generateTuningReport,
};

/**
 * Accuracy Metrics Calculator
 * Calculates various accuracy metrics for forecast evaluation
 */

const _ = require('lodash');
const logger = require('../utils/logger');

/**
 * Calculate Mean Absolute Error (MAE)
 * @param {Array} actual - Actual values
 * @param {Array} forecast - Forecasted values
 * @returns {number}
 */
function calculateMAE(actual, forecast) {
  if (actual.length !== forecast.length || actual.length === 0) {
    return null;
  }

  const errors = actual.map((a, i) => Math.abs(a - forecast[i]));
  return _.mean(errors);
}

/**
 * Calculate Mean Absolute Percentage Error (MAPE)
 * @param {Array} actual - Actual values
 * @param {Array} forecast - Forecasted values
 * @returns {number} - Percentage (0-100)
 */
function calculateMAPE(actual, forecast) {
  if (actual.length !== forecast.length || actual.length === 0) {
    return null;
  }

  // Filter out zeros to avoid division by zero
  const pairs = actual
    .map((a, i) => ({ actual: a, forecast: forecast[i] }))
    .filter(p => p.actual !== 0);

  if (pairs.length === 0) {
    return null;
  }

  const percentageErrors = pairs.map(p => Math.abs((p.actual - p.forecast) / p.actual) * 100);
  return _.mean(percentageErrors);
}

/**
 * Calculate Root Mean Square Error (RMSE)
 * @param {Array} actual - Actual values
 * @param {Array} forecast - Forecasted values
 * @returns {number}
 */
function calculateRMSE(actual, forecast) {
  if (actual.length !== forecast.length || actual.length === 0) {
    return null;
  }

  const squaredErrors = actual.map((a, i) => Math.pow(a - forecast[i], 2));
  return Math.sqrt(_.mean(squaredErrors));
}

/**
 * Calculate Mean Squared Error (MSE)
 * @param {Array} actual - Actual values
 * @param {Array} forecast - Forecasted values
 * @returns {number}
 */
function calculateMSE(actual, forecast) {
  if (actual.length !== forecast.length || actual.length === 0) {
    return null;
  }

  const squaredErrors = actual.map((a, i) => Math.pow(a - forecast[i], 2));
  return _.mean(squaredErrors);
}

/**
 * Calculate Weighted Absolute Percentage Error (WAPE)
 * Better for cases with many zero actual values
 * @param {Array} actual - Actual values
 * @param {Array} forecast - Forecasted values
 * @returns {number} - Percentage (0-100)
 */
function calculateWAPE(actual, forecast) {
  if (actual.length !== forecast.length || actual.length === 0) {
    return null;
  }

  const totalAbsoluteError = _.sum(actual.map((a, i) => Math.abs(a - forecast[i])));
  const totalActual = _.sum(actual);

  if (totalActual === 0) {
    return null;
  }

  return (totalAbsoluteError / totalActual) * 100;
}

/**
 * Calculate Symmetric Mean Absolute Percentage Error (SMAPE)
 * @param {Array} actual - Actual values
 * @param {Array} forecast - Forecasted values
 * @returns {number} - Percentage (0-100)
 */
function calculateSMAPE(actual, forecast) {
  if (actual.length !== forecast.length || actual.length === 0) {
    return null;
  }

  const pairs = actual
    .map((a, i) => ({ actual: a, forecast: forecast[i] }))
    .filter(p => p.actual !== 0 || p.forecast !== 0);

  if (pairs.length === 0) {
    return null;
  }

  const smapeValues = pairs.map(p => {
    const numerator = Math.abs(p.forecast - p.actual);
    const denominator = (Math.abs(p.actual) + Math.abs(p.forecast)) / 2;
    return denominator !== 0 ? (numerator / denominator) * 100 : 0;
  });

  return _.mean(smapeValues);
}

/**
 * Calculate R-squared (coefficient of determination)
 * @param {Array} actual - Actual values
 * @param {Array} forecast - Forecasted values
 * @returns {number} - Value between -∞ and 1 (1 is perfect)
 */
function calculateRSquared(actual, forecast) {
  if (actual.length !== forecast.length || actual.length === 0) {
    return null;
  }

  const meanActual = _.mean(actual);
  const ssTotal = _.sum(actual.map(a => Math.pow(a - meanActual, 2)));
  const ssResidual = _.sum(actual.map((a, i) => Math.pow(a - forecast[i], 2)));

  if (ssTotal === 0) {
    return null;
  }

  return 1 - ssResidual / ssTotal;
}

/**
 * Calculate forecast bias
 * Positive = over-forecasting, Negative = under-forecasting
 * @param {Array} actual - Actual values
 * @param {Array} forecast - Forecasted values
 * @returns {number}
 */
function calculateBias(actual, forecast) {
  if (actual.length !== forecast.length || actual.length === 0) {
    return null;
  }

  const errors = actual.map((a, i) => forecast[i] - a);
  return _.mean(errors);
}

/**
 * Calculate forecast accuracy percentage
 * @param {Array} actual - Actual values
 * @param {Array} forecast - Forecasted values
 * @returns {number} - Percentage (0-100)
 */
function calculateAccuracy(actual, forecast) {
  const mape = calculateMAPE(actual, forecast);
  if (mape === null) {
    return null;
  }
  return Math.max(0, 100 - mape);
}

/**
 * Calculate all metrics at once
 * @param {Array} actual - Actual values
 * @param {Array} forecast - Forecasted values
 * @returns {Object}
 */
function calculateAllMetrics(actual, forecast) {
  return {
    mae: calculateMAE(actual, forecast),
    mape: calculateMAPE(actual, forecast),
    rmse: calculateRMSE(actual, forecast),
    mse: calculateMSE(actual, forecast),
    wape: calculateWAPE(actual, forecast),
    smape: calculateSMAPE(actual, forecast),
    rSquared: calculateRSquared(actual, forecast),
    bias: calculateBias(actual, forecast),
    accuracy: calculateAccuracy(actual, forecast),
    count: actual.length,
  };
}

/**
 * Calculate metrics for a single item over time
 * @param {Array} timeSeries - Array of { date, actual, forecast }
 * @returns {Object}
 */
function calculateItemMetrics(timeSeries) {
  const actual = timeSeries.map(t => t.actual);
  const forecast = timeSeries.map(t => t.forecast);

  return {
    ...calculateAllMetrics(actual, forecast),
    totalActual: _.sum(actual),
    totalForecast: _.sum(forecast),
    avgActual: _.mean(actual),
    avgForecast: _.mean(forecast),
    minActual: _.min(actual),
    maxActual: _.max(actual),
    minForecast: _.min(forecast),
    maxForecast: _.max(forecast),
  };
}

/**
 * Calculate aggregate metrics across multiple items
 * @param {Array} itemMetrics - Array of metric objects
 * @returns {Object}
 */
function calculateAggregateMetrics(itemMetrics) {
  const validMetrics = itemMetrics.filter(m => m.mae !== null);

  if (validMetrics.length === 0) {
    return null;
  }

  return {
    avgMAE: _.mean(validMetrics.map(m => m.mae)),
    avgMAPE: _.mean(validMetrics.map(m => m.mape)),
    avgRMSE: _.mean(validMetrics.map(m => m.rmse)),
    avgWAPE: _.mean(validMetrics.map(m => m.wape)),
    avgSMAPE: _.mean(validMetrics.map(m => m.smape)),
    avgRSquared: _.mean(validMetrics.map(m => m.rSquared)),
    avgBias: _.mean(validMetrics.map(m => m.bias)),
    avgAccuracy: _.mean(validMetrics.map(m => m.accuracy)),
    medianMAPE: _.sortBy(validMetrics, 'mape')[Math.floor(validMetrics.length / 2)]?.mape,
    itemCount: validMetrics.length,
    totalActual: _.sum(validMetrics.map(m => m.totalActual || 0)),
    totalForecast: _.sum(validMetrics.map(m => m.totalForecast || 0)),
  };
}

/**
 * Classify forecast quality based on MAPE
 * @param {number} mape - MAPE value
 * @returns {string}
 */
function classifyForecastQuality(mape) {
  if (mape === null) return 'Unknown';
  if (mape < 10) return 'Excellent';
  if (mape < 20) return 'Good';
  if (mape < 30) return 'Acceptable';
  if (mape < 50) return 'Poor';
  return 'Very Poor';
}

/**
 * Calculate confusion matrix for stockout/overstock detection
 * @param {Array} results - Array of { actualReturns, forecastedQty, actualSales }
 * @returns {Object}
 */
function calculateConfusionMatrix(results) {
  let truePositiveStockout = 0; // Predicted stockout correctly
  let falsePositiveStockout = 0; // Predicted stockout incorrectly
  let trueNegativeStockout = 0; // Predicted no stockout correctly
  let falseNegativeStockout = 0; // Missed stockout

  let truePositiveOverstock = 0;
  let falsePositiveOverstock = 0;
  let trueNegativeOverstock = 0;
  let falseNegativeOverstock = 0;

  results.forEach(r => {
    const actualStockout = r.actualReturns === 0 && r.actualSales > 0;
    const predictedStockout = r.predictedStockout || false;
    const actualOverstock = r.actualReturnRate > 0.15;
    const predictedOverstock = r.predictedOverstock || false;

    // Stockout matrix
    if (predictedStockout && actualStockout) truePositiveStockout++;
    else if (predictedStockout && !actualStockout) falsePositiveStockout++;
    else if (!predictedStockout && !actualStockout) trueNegativeStockout++;
    else if (!predictedStockout && actualStockout) falseNegativeStockout++;

    // Overstock matrix
    if (predictedOverstock && actualOverstock) truePositiveOverstock++;
    else if (predictedOverstock && !actualOverstock) falsePositiveOverstock++;
    else if (!predictedOverstock && !actualOverstock) trueNegativeOverstock++;
    else if (!predictedOverstock && actualOverstock) falseNegativeOverstock++;
  });

  const stockoutAccuracy =
    (truePositiveStockout + trueNegativeStockout) / results.length || 0;
  const overstockAccuracy =
    (truePositiveOverstock + trueNegativeOverstock) / results.length || 0;

  return {
    stockout: {
      truePositive: truePositiveStockout,
      falsePositive: falsePositiveStockout,
      trueNegative: trueNegativeStockout,
      falseNegative: falseNegativeStockout,
      accuracy: stockoutAccuracy * 100,
      precision:
        truePositiveStockout / (truePositiveStockout + falsePositiveStockout) || 0,
      recall: truePositiveStockout / (truePositiveStockout + falseNegativeStockout) || 0,
    },
    overstock: {
      truePositive: truePositiveOverstock,
      falsePositive: falsePositiveOverstock,
      trueNegative: trueNegativeOverstock,
      falseNegative: falseNegativeOverstock,
      accuracy: overstockAccuracy * 100,
      precision:
        truePositiveOverstock / (truePositiveOverstock + falsePositiveOverstock) || 0,
      recall:
        truePositiveOverstock / (truePositiveOverstock + falseNegativeOverstock) || 0,
    },
  };
}

module.exports = {
  calculateMAE,
  calculateMAPE,
  calculateRMSE,
  calculateMSE,
  calculateWAPE,
  calculateSMAPE,
  calculateRSquared,
  calculateBias,
  calculateAccuracy,
  calculateAllMetrics,
  calculateItemMetrics,
  calculateAggregateMetrics,
  classifyForecastQuality,
  calculateConfusionMatrix,
};

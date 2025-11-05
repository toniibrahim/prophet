/**
 * Parameter Tuning and Optimization
 * Tests different parameter combinations to find optimal settings
 */

const _ = require('lodash');
const logger = require('../utils/logger');
const config = require('../config');
const backtester = require('./backtester');

/**
 * Default parameter grid for testing
 */
const DEFAULT_PARAMETER_GRID = {
  prophet: {
    changepointPriorScale: [0.01, 0.05, 0.1, 0.5],
    seasonalityPriorScale: [1, 5, 10, 15],
    holidaysPriorScale: [1, 5, 10, 15],
  },
  businessLogic: {
    stockoutMultiplier: [1.1, 1.2, 1.3, 1.4, 1.5],
    overstockMultiplier: [0.5, 0.6, 0.7, 0.8, 0.9],
    safetyStockPercentage: [0.05, 0.1, 0.15, 0.2],
  },
};

/**
 * Generate all parameter combinations from grid
 * @param {Object} parameterGrid
 * @returns {Array}
 */
function generateParameterCombinations(parameterGrid) {
  const combinations = [];

  // Generate Prophet parameter combinations
  const prophetParams = parameterGrid.prophet || {};
  const prophetCombinations = cartesianProduct(prophetParams);

  // Generate Business Logic parameter combinations
  const businessParams = parameterGrid.businessLogic || {};
  const businessCombinations = cartesianProduct(businessParams);

  // Combine all
  prophetCombinations.forEach(prophetConfig => {
    businessCombinations.forEach(businessConfig => {
      combinations.push({
        prophet: prophetConfig,
        businessLogic: businessConfig,
      });
    });
  });

  return combinations;
}

/**
 * Cartesian product of parameter values
 * @param {Object} params - { param1: [val1, val2], param2: [val3, val4] }
 * @returns {Array}
 */
function cartesianProduct(params) {
  const keys = Object.keys(params);
  if (keys.length === 0) return [{}];

  const values = keys.map(key => params[key]);
  const combinations = cartesian(...values);

  return combinations.map(combo => {
    const config = {};
    keys.forEach((key, i) => {
      config[key] = combo[i];
    });
    return config;
  });
}

/**
 * Cartesian product helper
 */
function cartesian(...arrays) {
  return arrays.reduce(
    (acc, array) => {
      return acc.flatMap(x => array.map(y => [...(Array.isArray(x) ? x : [x]), y]));
    },
    [[]]
  );
}

/**
 * Test a single parameter configuration
 * @param {Array} customerData - Array of customer data
 * @param {Object} paramConfig - Parameter configuration
 * @param {number} numWeeks - Number of weeks to test
 * @returns {Promise<Object>}
 */
async function testParameterConfiguration(customerData, paramConfig, numWeeks = 4) {
  logger.debug('Testing parameter configuration:', paramConfig);

  try {
    const result = await backtester.backtestAllCustomers(
      customerData,
      numWeeks,
      paramConfig
    );

    return {
      config: paramConfig,
      metrics: result.overallMetrics.adjusted,
      success: true,
    };
  } catch (error) {
    logger.error('Failed to test parameter configuration', {
      error: error.message,
      config: paramConfig,
    });
    return {
      config: paramConfig,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Run grid search to find best parameters
 * @param {Array} customerData - Array of customer data
 * @param {Object} parameterGrid - Grid of parameters to test
 * @param {number} numWeeks - Number of weeks to test
 * @param {string} metric - Metric to optimize ('mape', 'mae', 'rmse')
 * @returns {Promise<Object>}
 */
async function gridSearch(
  customerData,
  parameterGrid = DEFAULT_PARAMETER_GRID,
  numWeeks = 4,
  metric = 'avgMAPE'
) {
  logger.info('Starting grid search for optimal parameters...');

  const combinations = generateParameterCombinations(parameterGrid);
  logger.info(`Generated ${combinations.length} parameter combinations to test`);

  const results = [];

  for (let i = 0; i < combinations.length; i++) {
    const combination = combinations[i];
    logger.info(
      `Testing combination ${i + 1}/${combinations.length}: ${JSON.stringify(combination)}`
    );

    const result = await testParameterConfiguration(customerData, combination, numWeeks);
    results.push(result);

    if (result.success) {
      logger.info(
        `Result: ${metric} = ${result.metrics[metric]?.toFixed(2)}` +
          (metric.includes('MAPE') || metric.includes('Accuracy') ? '%' : '')
      );
    }
  }

  // Find best configuration
  const successfulResults = results.filter(r => r.success);

  if (successfulResults.length === 0) {
    logger.error('No successful parameter tests');
    return null;
  }

  // Sort by metric (lower is better for error metrics, higher for accuracy)
  const isErrorMetric =
    metric.includes('MAE') || metric.includes('RMSE') || metric.includes('MSE');
  const sorted = _.orderBy(
    successfulResults,
    [r => r.metrics[metric]],
    [isErrorMetric ? 'asc' : 'desc']
  );

  const bestConfig = sorted[0];
  const worstConfig = sorted[sorted.length - 1];

  logger.info('Grid search complete!');
  logger.info(`Best ${metric}: ${bestConfig.metrics[metric]?.toFixed(2)}`);
  logger.info(`Best config: ${JSON.stringify(bestConfig.config)}`);

  return {
    bestConfig: bestConfig.config,
    bestMetrics: bestConfig.metrics,
    worstConfig: worstConfig.config,
    worstMetrics: worstConfig.metrics,
    allResults: sorted,
    metric,
    totalCombinations: combinations.length,
    successfulTests: successfulResults.length,
    improvement: {
      value: Math.abs(bestConfig.metrics[metric] - worstConfig.metrics[metric]),
      percentage:
        ((bestConfig.metrics[metric] - worstConfig.metrics[metric]) /
          worstConfig.metrics[metric]) *
        100,
    },
  };
}

/**
 * Test Prophet parameters only (keep business logic constant)
 * @param {Array} customerData
 * @param {number} numWeeks
 * @returns {Promise<Object>}
 */
async function tuneProphetParameters(customerData, numWeeks = 4) {
  logger.info('Tuning Prophet parameters...');

  const prophetGrid = {
    prophet: DEFAULT_PARAMETER_GRID.prophet,
    businessLogic: {
      stockoutMultiplier: [config.businessLogic.stockoutMultiplier],
      overstockMultiplier: [config.businessLogic.overstockMultiplier],
      safetyStockPercentage: [config.businessLogic.safetyStockPercentage],
    },
  };

  return await gridSearch(customerData, prophetGrid, numWeeks, 'avgMAPE');
}

/**
 * Test Business Logic parameters only (keep Prophet constant)
 * @param {Array} customerData
 * @param {number} numWeeks
 * @returns {Promise<Object>}
 */
async function tuneBusinessLogicParameters(customerData, numWeeks = 4) {
  logger.info('Tuning Business Logic parameters...');

  const businessGrid = {
    prophet: {
      changepointPriorScale: [config.prophet.changepointPriorScale],
      seasonalityPriorScale: [config.prophet.seasonalityPriorScale],
      holidaysPriorScale: [config.prophet.holidaysPriorScale],
    },
    businessLogic: DEFAULT_PARAMETER_GRID.businessLogic,
  };

  return await gridSearch(customerData, businessGrid, numWeeks, 'avgMAPE');
}

/**
 * Quick test with common parameter variations
 * @param {Array} customerData
 * @param {number} numWeeks
 * @returns {Promise<Object>}
 */
async function quickTune(customerData, numWeeks = 4) {
  logger.info('Running quick parameter tuning...');

  const quickGrid = {
    prophet: {
      changepointPriorScale: [0.05, 0.1],
      seasonalityPriorScale: [5, 10],
      holidaysPriorScale: [10],
    },
    businessLogic: {
      stockoutMultiplier: [1.2, 1.3, 1.4],
      overstockMultiplier: [0.7, 0.8],
      safetyStockPercentage: [0.1, 0.15],
    },
  };

  return await gridSearch(customerData, quickGrid, numWeeks, 'avgMAPE');
}

/**
 * Test specific parameter variations around current config
 * @param {Array} customerData
 * @param {string} parameterName - e.g., 'stockoutMultiplier'
 * @param {Array} values - Values to test
 * @param {number} numWeeks
 * @returns {Promise<Object>}
 */
async function testParameter(customerData, parameterName, values, numWeeks = 4) {
  logger.info(`Testing parameter: ${parameterName} with values:`, values);

  // Determine if it's a Prophet or Business Logic parameter
  const isProphetParam = parameterName in config.prophet;
  const isBusinessParam = parameterName in config.businessLogic;

  if (!isProphetParam && !isBusinessParam) {
    throw new Error(`Unknown parameter: ${parameterName}`);
  }

  const paramGrid = {
    prophet: {},
    businessLogic: {},
  };

  // Set all other parameters to current values
  if (isProphetParam) {
    Object.keys(config.prophet).forEach(key => {
      paramGrid.prophet[key] =
        key === parameterName ? values : [config.prophet[key]];
    });
    Object.keys(config.businessLogic).forEach(key => {
      paramGrid.businessLogic[key] = [config.businessLogic[key]];
    });
  } else {
    Object.keys(config.prophet).forEach(key => {
      paramGrid.prophet[key] = [config.prophet[key]];
    });
    Object.keys(config.businessLogic).forEach(key => {
      paramGrid.businessLogic[key] =
        key === parameterName ? values : [config.businessLogic[key]];
    });
  }

  const result = await gridSearch(customerData, paramGrid, numWeeks, 'avgMAPE');

  return {
    ...result,
    parameterName,
    testedValues: values,
  };
}

/**
 * Generate recommended parameter grid based on dataset characteristics
 * @param {Array} customerData
 * @returns {Object}
 */
function generateRecommendedGrid(customerData) {
  // Analyze dataset to recommend parameter ranges
  const totalCustomers = customerData.length;
  const totalItems = _.sum(
    customerData.map(c => Object.keys(c.items || {}).length)
  );

  logger.info(`Dataset: ${totalCustomers} customers, ${totalItems} items`);

  // For small datasets, use finer granularity
  // For large datasets, use coarser granularity
  const isLargeDataset = totalItems > 100;

  return isLargeDataset
    ? {
        prophet: {
          changepointPriorScale: [0.05, 0.1],
          seasonalityPriorScale: [5, 10],
          holidaysPriorScale: [10],
        },
        businessLogic: {
          stockoutMultiplier: [1.2, 1.3],
          overstockMultiplier: [0.7, 0.8],
          safetyStockPercentage: [0.1, 0.15],
        },
      }
    : DEFAULT_PARAMETER_GRID;
}

module.exports = {
  gridSearch,
  tuneProphetParameters,
  tuneBusinessLogicParameters,
  quickTune,
  testParameter,
  generateRecommendedGrid,
  DEFAULT_PARAMETER_GRID,
};

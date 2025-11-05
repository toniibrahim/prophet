#!/usr/bin/env node

/**
 * SAP B1 Sales Forecasting and Order Proposal System
 * Main entry point
 */

const logger = require('./utils/logger');
const config = require('./config');
const orchestrator = require('./orchestrator');
const scheduler = require('./scheduler');

// Simulation modules
const sapB1Client = require('./services/sapB1Client');
const sapB1DataReader = require('./services/sapB1DataReader');
const dataPreprocessor = require('./models/dataPreprocessor');
const backtester = require('./simulation/backtester');
const parameterTuner = require('./simulation/parameterTuner');
const simulationReporter = require('./reporting/simulationReporter');
const dateHelpers = require('./utils/dateHelpers');

// Parse command line arguments
const args = process.argv.slice(2);
const isForecastMode = args.includes('--forecast');
const isBacktestMode = args.includes('--backtest');
const isTuneMode = args.includes('--tune-params');
const isQuickTuneMode = args.includes('--quick-tune');
const customerIndex = args.indexOf('--customer');
const customerCode = customerIndex !== -1 ? args[customerIndex + 1] : null;
const weeksIndex = args.indexOf('--weeks');
const numWeeks = weeksIndex !== -1 ? parseInt(args[weeksIndex + 1], 10) : 4;
const isScheduledMode = !isForecastMode && !customerCode && !isBacktestMode && !isTuneMode && !isQuickTuneMode;

/**
 * Main function
 */
async function main() {
  try {
    logger.info('SAP B1 Sales Forecasting System starting...');

    // Determine mode
    let mode = 'Unknown';
    if (isBacktestMode) mode = 'Backtest';
    else if (isTuneMode) mode = 'Parameter Tuning';
    else if (isQuickTuneMode) mode = 'Quick Parameter Tuning';
    else if (isScheduledMode) mode = 'Scheduled';
    else if (isForecastMode) mode = 'One-time Forecast';
    else if (customerCode) mode = 'Customer Forecast';

    logger.info(`Mode: ${mode}`);

    // Backtest mode
    if (isBacktestMode) {
      logger.info(`Running backtesting for ${numWeeks} weeks...`);
      console.log('\n' + '='.repeat(80));
      console.log('SAP B1 Sales Forecasting - Backtesting Mode');
      console.log('='.repeat(80));
      console.log(`Weeks to test: ${numWeeks}`);
      console.log('This will simulate historical forecasts and compare to actual sales.');
      console.log('='.repeat(80) + '\n');

      // Connect to SAP B1
      await sapB1Client.login();

      // Fetch historical data
      console.log('Fetching historical data...');
      const allCustomersData = await sapB1DataReader.getAllCustomersData();
      console.log(`✓ Fetched data for ${allCustomersData.length} customers`);

      // Prepare data
      console.log('Preparing data...');
      const preparedData = [];
      for (const customerData of allCustomersData) {
        const prepared = dataPreprocessor.prepareDataForForecasting(customerData);
        if (Object.keys(prepared.items).length > 0) {
          preparedData.push(customerData);
        }
      }
      console.log(`✓ Prepared data for ${preparedData.length} customers`);

      // Run backtesting
      if (customerCode) {
        // Single customer backtest
        const customer = preparedData.find(c => c.customerCode === customerCode);
        if (!customer) {
          console.error(`Customer ${customerCode} not found`);
          process.exit(1);
        }

        console.log(`\nRunning backtest for customer ${customerCode}...`);
        const result = await backtester.backtestCustomer(customer, numWeeks);

        // Generate report
        const reportPath = simulationReporter.generateBacktestReport(result);

        console.log('\n' + '='.repeat(80));
        console.log('✓ Backtesting completed!');
        console.log('='.repeat(80));
        console.log(`Customer: ${result.customerCode}`);
        console.log(`Items tested: ${result.itemCount}`);
        console.log(`Base MAPE: ${result.aggregateMetrics.base?.avgMAPE?.toFixed(2)}%`);
        console.log(`Adjusted MAPE: ${result.aggregateMetrics.adjusted?.avgMAPE?.toFixed(2)}%`);
        console.log(`Improvement: ${result.aggregateMetrics.improvement?.mape?.toFixed(2)}%`);
        console.log(`Report: ${reportPath}`);
        console.log('='.repeat(80) + '\n');
      } else {
        // All customers backtest
        console.log(`\nRunning backtest for all ${preparedData.length} customers...`);
        const result = await backtester.backtestAllCustomers(preparedData, numWeeks);

        // Generate reports for each customer
        console.log('\nGenerating reports...');
        for (const customerResult of result.customerResults) {
          simulationReporter.generateBacktestReport(customerResult);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✓ Backtesting completed!');
        console.log('='.repeat(80));
        console.log(`Customers: ${result.summary.totalCustomers}`);
        console.log(`Total items: ${result.summary.totalItems}`);
        console.log(`Weeks tested: ${result.summary.numWeeks}`);
        console.log(`Overall Base MAPE: ${result.overallMetrics.base?.avgMAPE?.toFixed(2)}%`);
        console.log(`Overall Adjusted MAPE: ${result.overallMetrics.adjusted?.avgMAPE?.toFixed(2)}%`);
        console.log(`Overall Improvement: ${result.overallMetrics.improvement?.mape?.toFixed(2)}%`);
        console.log(`Reports generated in: ${config.output.path}`);
        console.log('='.repeat(80) + '\n');
      }

      await sapB1Client.logout();
      process.exit(0);
    }

    // Parameter tuning mode
    if (isTuneMode || isQuickTuneMode) {
      const isQuick = isQuickTuneMode;
      logger.info(`Running ${isQuick ? 'quick' : 'full'} parameter tuning...`);
      console.log('\n' + '='.repeat(80));
      console.log(`SAP B1 Sales Forecasting - ${isQuick ? 'Quick' : 'Full'} Parameter Tuning`);
      console.log('='.repeat(80));
      console.log(`Weeks to test: ${numWeeks}`);
      console.log('This will test multiple parameter combinations to find the best settings.');
      console.log('='.repeat(80) + '\n');

      // Connect to SAP B1
      await sapB1Client.login();

      // Fetch historical data
      console.log('Fetching historical data...');
      const allCustomersData = await sapB1DataReader.getAllCustomersData();
      console.log(`✓ Fetched data for ${allCustomersData.length} customers`);

      // Prepare data
      console.log('Preparing data...');
      const preparedData = [];
      for (const customerData of allCustomersData) {
        const prepared = dataPreprocessor.prepareDataForForecasting(customerData);
        if (Object.keys(prepared.items).length > 0) {
          preparedData.push(customerData);
        }
      }
      console.log(`✓ Prepared data for ${preparedData.length} customers`);

      // Run parameter tuning
      console.log(`\nTesting parameter combinations (this may take a while)...\n`);
      const result = isQuick
        ? await parameterTuner.quickTune(preparedData, numWeeks)
        : await parameterTuner.gridSearch(preparedData, parameterTuner.DEFAULT_PARAMETER_GRID, numWeeks);

      // Generate report
      const reportPath = simulationReporter.generateTuningReport(result);

      console.log('\n' + '='.repeat(80));
      console.log('✓ Parameter tuning completed!');
      console.log('='.repeat(80));
      console.log(`Combinations tested: ${result.totalCombinations}`);
      console.log(`Successful tests: ${result.successfulTests}`);
      console.log(`Best MAPE: ${result.bestMetrics?.avgMAPE?.toFixed(2)}%`);
      console.log(`Worst MAPE: ${result.worstMetrics?.avgMAPE?.toFixed(2)}%`);
      console.log(`Improvement: ${Math.abs(result.improvement?.value)?.toFixed(2)}%`);
      console.log('\nBest Configuration:');
      console.log(JSON.stringify(result.bestConfig, null, 2));
      console.log(`\nReport: ${reportPath}`);
      console.log('='.repeat(80) + '\n');

      await sapB1Client.logout();
      process.exit(0);
    }

    if (customerCode) {
      // Run forecast for specific customer
      logger.info(`Running forecast for customer: ${customerCode}`);
      const result = await orchestrator.runForecastingForCustomer(customerCode);

      if (result.success) {
        console.log('\n' + '='.repeat(80));
        console.log('✓ Forecasting completed successfully!');
        console.log('='.repeat(80));
        console.log(`Duration: ${result.duration} seconds`);
        console.log(`Report: ${result.reportPath}`);
        console.log('='.repeat(80) + '\n');
        process.exit(0);
      } else {
        console.error('\n' + '='.repeat(80));
        console.error('✗ Forecasting failed');
        console.error('='.repeat(80));
        console.error(`Error: ${result.error}`);
        console.error('='.repeat(80) + '\n');
        process.exit(1);
      }
    } else if (isForecastMode) {
      // Run one-time forecast
      logger.info('Running one-time forecast for all customers...');
      const result = await orchestrator.runForecasting();

      if (result.success) {
        console.log('\n' + '='.repeat(80));
        console.log('✓ Forecasting completed successfully!');
        console.log('='.repeat(80));
        console.log(`Customers: ${result.statistics.customers}`);
        console.log(`Total Items: ${result.statistics.totalItems}`);
        console.log(`Total Quantity: ${result.statistics.totalQuantity}`);
        console.log(`Stockout Risks: ${result.statistics.stockoutRisks}`);
        console.log(`Overstock Risks: ${result.statistics.overstockRisks}`);
        console.log(`Duration: ${result.duration} seconds`);
        console.log(`Report: ${result.reportPath}`);
        console.log('='.repeat(80) + '\n');
        process.exit(0);
      } else {
        console.error('\n' + '='.repeat(80));
        console.error('✗ Forecasting failed');
        console.error('='.repeat(80));
        console.error(`Error: ${result.error || result.message}`);
        console.error('='.repeat(80) + '\n');
        process.exit(1);
      }
    } else {
      // Scheduled mode
      logger.info('Starting in scheduled mode...');
      const job = scheduler.scheduleDailyForecasting();

      if (job) {
        console.log('\n' + '='.repeat(80));
        console.log('SAP B1 Sales Forecasting System - Scheduled Mode');
        console.log('='.repeat(80));
        console.log(`Scheduled Time: ${config.scheduling.forecastGenerationTime}`);
        console.log(`Timezone: ${config.regional.timezone}`);
        console.log('The system will run forecasting automatically at the scheduled time.');
        console.log('Press Ctrl+C to stop.');
        console.log('='.repeat(80) + '\n');

        // Keep the process running
        process.on('SIGINT', () => {
          console.log('\nShutting down gracefully...');
          scheduler.cancelScheduledJob(job);
          logger.info('System shutdown');
          process.exit(0);
        });

        process.on('SIGTERM', () => {
          console.log('\nShutting down gracefully...');
          scheduler.cancelScheduledJob(job);
          logger.info('System shutdown');
          process.exit(0);
        });
      } else {
        logger.warn('Scheduler is disabled. Use --forecast to run one-time forecast.');
        console.log('\n' + '='.repeat(80));
        console.log('Scheduler is disabled in configuration');
        console.log('='.repeat(80));
        console.log('Available commands:');
        console.log('  npm start -- --forecast                  # Run one-time forecast');
        console.log('  npm start -- --customer CODE             # Forecast for specific customer');
        console.log('  npm start -- --backtest [--weeks 4]      # Run backtesting simulation');
        console.log('  npm start -- --backtest --customer CODE  # Backtest specific customer');
        console.log('  npm start -- --quick-tune [--weeks 4]    # Quick parameter tuning');
        console.log('  npm start -- --tune-params [--weeks 4]   # Full parameter tuning');
        console.log('='.repeat(80) + '\n');
        process.exit(0);
      }
    }
  } catch (error) {
    logger.error('Fatal error', { error: error.message, stack: error.stack });
    console.error('\n✗ Fatal error:', error.message);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
main();

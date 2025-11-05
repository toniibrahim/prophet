#!/usr/bin/env node

/**
 * SAP B1 Sales Forecasting and Order Proposal System
 * Main entry point
 */

const logger = require('./utils/logger');
const config = require('./config');
const orchestrator = require('./orchestrator');
const scheduler = require('./scheduler');

// Parse command line arguments
const args = process.argv.slice(2);
const isScheduledMode = !args.includes('--forecast') && !args.includes('--customer');
const isForecastMode = args.includes('--forecast');
const customerIndex = args.indexOf('--customer');
const customerCode = customerIndex !== -1 ? args[customerIndex + 1] : null;

/**
 * Main function
 */
async function main() {
  try {
    logger.info('SAP B1 Sales Forecasting System starting...');
    logger.info(`Mode: ${isScheduledMode ? 'Scheduled' : isForecastMode ? 'One-time Forecast' : 'Customer Forecast'}`);

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
        console.log('To run a one-time forecast, use: npm start -- --forecast');
        console.log('To run for a specific customer, use: npm start -- --customer CUSTOMER_CODE');
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

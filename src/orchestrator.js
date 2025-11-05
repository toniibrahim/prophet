/**
 * Main Orchestrator
 * Coordinates the entire forecasting and order proposal process
 */

const logger = require('./utils/logger');
const sapB1Client = require('./services/sapB1Client');
const sapB1DataReader = require('./services/sapB1DataReader');
const dataPreprocessor = require('./models/dataPreprocessor');
const forecaster = require('./forecasting/forecaster');
const orderProposal = require('./models/orderProposal');
const excelReporter = require('./reporting/excelReporter');
const dateHelpers = require('./utils/dateHelpers');

/**
 * Main forecasting workflow
 * @returns {Promise<Object>}
 */
async function runForecasting() {
  const startTime = Date.now();

  try {
    logger.info('='.repeat(80));
    logger.info('Starting SAP B1 Sales Forecasting and Order Proposal Generation');
    logger.info(`Start Time: ${dateHelpers.formatDate(dateHelpers.getCurrentDate())}`);
    logger.info(`Forecast Target Date: ${dateHelpers.formatForSAP(dateHelpers.getDaysFromNow(2))}`);
    logger.info('='.repeat(80));

    // Step 1: Connect to SAP B1
    logger.info('Step 1: Connecting to SAP B1 Service Layer...');
    await sapB1Client.login();
    logger.info('✓ Connected to SAP B1');

    // Step 2: Fetch historical data
    logger.info('Step 2: Fetching historical sales and returns data...');
    const allCustomersData = await sapB1DataReader.getAllCustomersData();
    logger.info(`✓ Fetched data for ${allCustomersData.length} customers`);

    if (allCustomersData.length === 0) {
      logger.warn('No customer data found. Exiting.');
      await sapB1Client.logout();
      return {
        success: false,
        message: 'No customer data found',
      };
    }

    // Step 3: Preprocess data
    logger.info('Step 3: Preprocessing and preparing data for forecasting...');
    const allPreparedData = [];

    for (const customerData of allCustomersData) {
      try {
        const preparedData = dataPreprocessor.prepareDataForForecasting(customerData);
        if (Object.keys(preparedData.items).length > 0) {
          allPreparedData.push(preparedData);
        } else {
          logger.warn(`No items with sufficient data for customer ${customerData.customerCode}`);
        }
      } catch (error) {
        logger.error(`Failed to prepare data for customer ${customerData.customerCode}`, {
          error: error.message,
        });
      }
    }

    logger.info(`✓ Prepared data for ${allPreparedData.length} customers`);

    if (allPreparedData.length === 0) {
      logger.warn('No data prepared for forecasting. Exiting.');
      await sapB1Client.logout();
      return {
        success: false,
        message: 'No data prepared for forecasting',
      };
    }

    // Step 4: Generate forecasts
    logger.info('Step 4: Generating forecasts using Prophet...');
    const allForecasts = await forecaster.forecastAllCustomers(allPreparedData);
    logger.info(`✓ Generated forecasts for ${allForecasts.length} customers`);

    // Step 5: Create order proposals
    logger.info('Step 5: Creating order proposals with business logic...');
    const allProposals = orderProposal.createAllOrderProposals(allForecasts, allPreparedData);
    logger.info(`✓ Created order proposals for ${allProposals.length} customers`);

    // Calculate overall statistics
    const totalItems = allProposals.reduce((sum, p) => sum + p.summary.totalItems, 0);
    const totalQuantity = allProposals.reduce((sum, p) => sum + p.summary.totalQuantity, 0);
    const totalStockoutRisks = allProposals.reduce(
      (sum, p) => sum + p.summary.stockoutRisks,
      0
    );
    const totalOverstockRisks = allProposals.reduce(
      (sum, p) => sum + p.summary.overstockRisks,
      0
    );

    logger.info('Summary:');
    logger.info(`  - Total Items: ${totalItems}`);
    logger.info(`  - Total Quantity: ${totalQuantity}`);
    logger.info(`  - Stockout Risks: ${totalStockoutRisks}`);
    logger.info(`  - Overstock Risks: ${totalOverstockRisks}`);

    // Step 6: Generate reports
    logger.info('Step 6: Generating Excel reports...');
    const mainReportPath = excelReporter.generateReport(allProposals);
    logger.info(`✓ Main report generated: ${mainReportPath}`);

    // Optionally generate individual customer reports
    // const customerReports = excelReporter.generateCustomerReports(allProposals);
    // logger.info(`✓ Generated ${customerReports.length} individual customer reports`);

    // Step 7: Cleanup
    logger.info('Step 7: Cleaning up...');
    await sapB1Client.logout();
    logger.info('✓ Disconnected from SAP B1');

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    logger.info('='.repeat(80));
    logger.info('Forecasting completed successfully!');
    logger.info(`Duration: ${duration} seconds`);
    logger.info(`Report: ${mainReportPath}`);
    logger.info('='.repeat(80));

    return {
      success: true,
      duration,
      statistics: {
        customers: allProposals.length,
        totalItems,
        totalQuantity,
        stockoutRisks: totalStockoutRisks,
        overstockRisks: totalOverstockRisks,
      },
      reportPath: mainReportPath,
    };
  } catch (error) {
    logger.error('Forecasting failed', { error: error.message, stack: error.stack });

    // Ensure we logout even on error
    try {
      await sapB1Client.logout();
    } catch (logoutError) {
      logger.error('Failed to logout from SAP B1', { error: logoutError.message });
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Run forecasting for a specific customer
 * @param {string} customerCode
 * @returns {Promise<Object>}
 */
async function runForecastingForCustomer(customerCode) {
  const startTime = Date.now();

  try {
    logger.info(`Starting forecasting for customer ${customerCode}...`);

    // Connect to SAP B1
    await sapB1Client.login();

    // Get date range
    const { startDate, endDate } = dateHelpers.getHistoricalDateRange(
      require('./config').forecasting.historicalDataDays
    );

    // Fetch customer data
    const customerData = await sapB1DataReader.getCustomerData(customerCode, startDate, endDate);

    // Get customer name
    const customers = await sapB1DataReader.getCreditCustomers();
    const customer = customers.find(c => c.CardCode === customerCode);
    customerData.customerName = customer?.CardName || customerCode;

    // Preprocess data
    const preparedData = dataPreprocessor.prepareDataForForecasting(customerData);

    // Generate forecast
    const forecast = await forecaster.forecastCustomer(preparedData);

    // Create order proposal
    const proposal = orderProposal.createCustomerOrderProposal(forecast, preparedData);

    // Generate report
    const reportPath = excelReporter.generateCustomerReports([proposal])[0];

    // Cleanup
    await sapB1Client.logout();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    logger.info(`Forecasting completed for customer ${customerCode} in ${duration} seconds`);

    return {
      success: true,
      duration,
      proposal,
      reportPath,
    };
  } catch (error) {
    logger.error(`Forecasting failed for customer ${customerCode}`, {
      error: error.message,
    });

    try {
      await sapB1Client.logout();
    } catch (logoutError) {
      // Ignore logout errors
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  runForecasting,
  runForecastingForCustomer,
};

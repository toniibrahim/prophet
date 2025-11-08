/**
 * Data Loader with Incremental Loading
 * Manages data import from SAP B1 with incremental loading strategy
 */

const sapClient = require('../integrations/sapB1Client');
const salesRepository = require('./repositories/salesRepository');
const importLogRepository = require('./repositories/importLogRepository');
const dateHelpers = require('../utils/dateHelpers');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Load customer data with incremental strategy
 * - First run: Fetch historical data (configurable, default 2 years)
 * - Subsequent runs: Only fetch data since last import
 *
 * @param {string} customerCode
 * @param {string} customerName
 * @param {boolean} forceFullReload - Force full reload ignoring import log
 * @returns {Promise<Object>} - { salesCount, returnsCount, dateRange, isInitialImport }
 */
async function loadCustomerData(customerCode, customerName, forceFullReload = false) {
  try {
    logger.info(`Starting data load for customer ${customerCode}...`);

    // Determine date range based on import history
    let dateRange;
    let isInitialImport = false;

    if (forceFullReload) {
      // Force full reload
      logger.info('Force full reload requested');
      const initialDays = parseInt(
        process.env.INITIAL_HISTORICAL_DAYS || config.forecasting.historicalDataDays * 2 || '730',
        10
      );
      dateRange = {
        startDate: dateHelpers.getDaysBeforeNow(initialDays),
        endDate: dateHelpers.getCurrentDate(),
        isInitialImport: true,
      };

      // Delete existing data
      await salesRepository.deleteSalesByCustomer(customerCode);
      await salesRepository.deleteReturnsByCustomer(customerCode);
      await importLogRepository.deleteImportLog(customerCode);

      isInitialImport = true;
    } else {
      // Check if customer has been imported before
      const hasImported = await importLogRepository.hasBeenImported(customerCode);

      if (!hasImported) {
        // Initial import - get historical data
        const initialDays = parseInt(
          process.env.INITIAL_HISTORICAL_DAYS || config.forecasting.historicalDataDays * 2 || '730',
          10
        );
        logger.info(`Initial import for customer ${customerCode}, fetching ${initialDays} days of historical data`);

        dateRange = {
          startDate: dateHelpers.getDaysBeforeNow(initialDays),
          endDate: dateHelpers.getCurrentDate(),
          isInitialImport: true,
        };
        isInitialImport = true;
      } else {
        // Incremental import - get data since last import
        const importLog = await importLogRepository.getImportLog(customerCode);
        const lastImportDate = new Date(importLog.last_import_date);
        const nextDay = dateHelpers.addDays(lastImportDate, 1);
        const today = dateHelpers.getCurrentDate();

        // Check if we need to import anything
        if (nextDay > today) {
          logger.info(`No new data to import for customer ${customerCode} (already up to date)`);
          return {
            salesCount: 0,
            returnsCount: 0,
            dateRange: {
              startDate: lastImportDate,
              endDate: today,
            },
            isInitialImport: false,
            upToDate: true,
          };
        }

        logger.info(`Incremental import for customer ${customerCode}, fetching from ${dateHelpers.formatForSAP(nextDay)} to ${dateHelpers.formatForSAP(today)}`);

        dateRange = {
          startDate: nextDay,
          endDate: today,
          isInitialImport: false,
        };
      }
    }

    // Mark import as in progress (if log exists)
    if (!isInitialImport) {
      await importLogRepository.markImportInProgress(customerCode);
    }

    // Fetch data from SAP B1
    logger.info(`Fetching sales data from SAP B1 for date range: ${dateHelpers.formatForSAP(dateRange.startDate)} to ${dateHelpers.formatForSAP(dateRange.endDate)}`);

    const [salesData, returnsData] = await Promise.all([
      sapClient.getSalesData(
        customerCode,
        dateHelpers.formatForSAP(dateRange.startDate),
        dateHelpers.formatForSAP(dateRange.endDate)
      ),
      sapClient.getReturnsData(
        customerCode,
        dateHelpers.formatForSAP(dateRange.startDate),
        dateHelpers.formatForSAP(dateRange.endDate)
      ),
    ]);

    logger.info(`Fetched ${salesData.length} sales records and ${returnsData.length} returns records from SAP B1`);

    // Transform data for database
    const transformedSales = salesData.map(item => ({
      customerCode,
      customerName,
      itemCode: item.itemCode,
      itemDescription: item.itemDescription,
      docDate: item.docDate,
      docNum: item.docNum || '',
      quantity: item.quantity,
      lineTotal: item.lineTotal || 0,
    }));

    const transformedReturns = returnsData.map(item => ({
      customerCode,
      customerName,
      itemCode: item.itemCode,
      itemDescription: item.itemDescription,
      docDate: item.docDate,
      docNum: item.docNum || '',
      quantity: item.quantity,
      lineTotal: item.lineTotal || 0,
    }));

    // Insert data into database
    let salesCount = 0;
    let returnsCount = 0;

    if (transformedSales.length > 0) {
      salesCount = await salesRepository.bulkInsertSales(transformedSales);
    }

    if (transformedReturns.length > 0) {
      returnsCount = await salesRepository.bulkInsertReturns(transformedReturns);
    }

    const totalRecords = salesCount + returnsCount;

    // Update import log
    if (isInitialImport) {
      await importLogRepository.createImportLog(
        customerCode,
        customerName,
        dateRange.endDate,
        totalRecords
      );
    } else {
      await importLogRepository.updateImportLog(
        customerCode,
        dateRange.endDate,
        totalRecords
      );
    }

    logger.info(`Data load completed for customer ${customerCode}: ${salesCount} sales, ${returnsCount} returns`);

    return {
      salesCount,
      returnsCount,
      dateRange,
      isInitialImport,
      upToDate: false,
    };
  } catch (error) {
    logger.error(`Failed to load data for customer ${customerCode}`, { error: error.message });

    // Mark import as failed
    try {
      await importLogRepository.markImportFailed(customerCode, error.message);
    } catch (logError) {
      logger.error('Failed to mark import as failed', { error: logError.message });
    }

    throw error;
  }
}

/**
 * Get customer data from database for forecasting
 * @param {string} customerCode
 * @param {number} historicalDays - Number of days of historical data (default from config)
 * @returns {Promise<Object>} - { customerCode, customerName, sales, returns }
 */
async function getCustomerDataForForecasting(customerCode, historicalDays = null) {
  try {
    const days = historicalDays || config.forecasting.historicalDataDays;
    const endDate = dateHelpers.getCurrentDate();
    const startDate = dateHelpers.getDaysBeforeNow(days);

    logger.info(`Retrieving ${days} days of data for customer ${customerCode} from database`);

    const [sales, returns] = await Promise.all([
      salesRepository.getSalesByCustomerAndDateRange(customerCode, startDate, endDate),
      salesRepository.getReturnsByCustomerAndDateRange(customerCode, startDate, endDate),
    ]);

    // Get customer name from import log or first record
    let customerName = customerCode;
    const importLog = await importLogRepository.getImportLog(customerCode);
    if (importLog) {
      customerName = importLog.customer_name;
    } else if (sales.length > 0) {
      customerName = sales[0].customer_name;
    }

    logger.info(`Retrieved ${sales.length} sales and ${returns.length} returns from database`);

    // Transform database format to match expected format
    const transformedSales = sales.map(s => ({
      itemCode: s.item_code,
      itemDescription: s.item_description,
      docDate: s.doc_date,
      docNum: s.doc_num,
      quantity: parseFloat(s.quantity),
      lineTotal: parseFloat(s.line_total),
    }));

    const transformedReturns = returns.map(r => ({
      itemCode: r.item_code,
      itemDescription: r.item_description,
      docDate: r.doc_date,
      docNum: r.doc_num,
      quantity: parseFloat(r.quantity),
      lineTotal: parseFloat(r.line_total),
    }));

    return {
      customerCode,
      customerName,
      sales: transformedSales,
      returns: transformedReturns,
    };
  } catch (error) {
    logger.error(`Failed to get customer data for forecasting`, { error: error.message });
    throw error;
  }
}

/**
 * Load data for multiple customers
 * @param {Array<Object>} customers - Array of { customerCode, customerName }
 * @param {boolean} forceFullReload
 * @returns {Promise<Array>}
 */
async function loadMultipleCustomers(customers, forceFullReload = false) {
  const results = [];

  for (const customer of customers) {
    try {
      const result = await loadCustomerData(
        customer.customerCode,
        customer.customerName,
        forceFullReload
      );
      results.push({
        customerCode: customer.customerCode,
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error(`Failed to load customer ${customer.customerCode}`, { error: error.message });
      results.push({
        customerCode: customer.customerCode,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Get import status for all customers
 * @returns {Promise<Array>}
 */
async function getImportStatus() {
  try {
    return await importLogRepository.getAllImportLogs();
  } catch (error) {
    logger.error('Failed to get import status', { error: error.message });
    throw error;
  }
}

module.exports = {
  loadCustomerData,
  getCustomerDataForForecasting,
  loadMultipleCustomers,
  getImportStatus,
};

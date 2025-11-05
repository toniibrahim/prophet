/**
 * SAP B1 Data Reader
 * Retrieves sales and returns data from SAP Business One
 */

const sapB1Client = require('./sapB1Client');
const dateHelpers = require('../utils/dateHelpers');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Get list of credit customers
 * @returns {Promise<Array>} Array of customer objects
 */
async function getCreditCustomers() {
  try {
    logger.info('Fetching credit customers from SAP B1...');

    // Query BusinessPartners where GroupCode indicates credit customers
    // Adjust the filter based on your SAP B1 configuration
    const response = await sapB1Client.query('BusinessPartners', {
      select: ['CardCode', 'CardName', 'GroupCode', 'EmailAddress', 'Phone1'],
      filter: "CardType eq 'C' and GroupCode eq 100", // Adjust GroupCode for credit customers
    });

    const customers = response.value || [];
    logger.info(`Retrieved ${customers.length} credit customers`);

    return customers;
  } catch (error) {
    logger.error('Failed to fetch credit customers', { error: error.message });
    throw error;
  }
}

/**
 * Get sales data (delivery documents) for a customer and date range
 * @param {string} customerCode
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
async function getSalesData(customerCode, startDate, endDate) {
  try {
    logger.debug(`Fetching sales data for customer ${customerCode}...`);

    const startDateStr = dateHelpers.formatForSAP(startDate);
    const endDateStr = dateHelpers.formatForSAP(endDate);

    // Query DeliveryNotes (ODLN) and their lines (DLN1)
    // Note: We'll need to join document headers with lines
    const filter = `CardCode eq '${customerCode}' and DocDate ge '${startDateStr}' and DocDate le '${endDateStr}' and DocumentStatus eq 'C'`;

    const deliveries = await sapB1Client.queryAll('DeliveryNotes', {
      select: ['DocNum', 'DocDate', 'CardCode', 'CardName', 'DocTotal', 'DocumentLines'],
      filter,
      orderby: 'DocDate asc',
    });

    // Flatten the data to get individual line items
    const salesLines = [];
    deliveries.forEach(delivery => {
      if (delivery.DocumentLines && delivery.DocumentLines.length > 0) {
        delivery.DocumentLines.forEach(line => {
          salesLines.push({
            docNum: delivery.DocNum,
            docDate: delivery.DocDate,
            customerCode: delivery.CardCode,
            customerName: delivery.CardName,
            itemCode: line.ItemCode,
            itemDescription: line.ItemDescription,
            quantity: line.Quantity,
            price: line.Price,
            lineTotal: line.LineTotal,
            warehouseCode: line.WarehouseCode,
          });
        });
      }
    });

    logger.debug(`Retrieved ${salesLines.length} sales line items for customer ${customerCode}`);

    return salesLines;
  } catch (error) {
    logger.error(`Failed to fetch sales data for customer ${customerCode}`, {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get returns data (return documents) for a customer and date range
 * @param {string} customerCode
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
async function getReturnsData(customerCode, startDate, endDate) {
  try {
    logger.debug(`Fetching returns data for customer ${customerCode}...`);

    const startDateStr = dateHelpers.formatForSAP(startDate);
    const endDateStr = dateHelpers.formatForSAP(endDate);

    // Query Returns (ORDN) and their lines (RDN1)
    const filter = `CardCode eq '${customerCode}' and DocDate ge '${startDateStr}' and DocDate le '${endDateStr}' and DocumentStatus eq 'C'`;

    const returns = await sapB1Client.queryAll('Returns', {
      select: ['DocNum', 'DocDate', 'CardCode', 'CardName', 'DocTotal', 'DocumentLines'],
      filter,
      orderby: 'DocDate asc',
    });

    // Flatten the data to get individual line items
    const returnLines = [];
    returns.forEach(returnDoc => {
      if (returnDoc.DocumentLines && returnDoc.DocumentLines.length > 0) {
        returnDoc.DocumentLines.forEach(line => {
          returnLines.push({
            docNum: returnDoc.DocNum,
            docDate: returnDoc.DocDate,
            customerCode: returnDoc.CardCode,
            customerName: returnDoc.CardName,
            itemCode: line.ItemCode,
            itemDescription: line.ItemDescription,
            quantity: line.Quantity,
            price: line.Price,
            lineTotal: line.LineTotal,
            warehouseCode: line.WarehouseCode,
          });
        });
      }
    });

    logger.debug(`Retrieved ${returnLines.length} return line items for customer ${customerCode}`);

    return returnLines;
  } catch (error) {
    logger.error(`Failed to fetch returns data for customer ${customerCode}`, {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get combined sales and returns data for a customer
 * @param {string} customerCode
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Object>}
 */
async function getCustomerData(customerCode, startDate, endDate) {
  try {
    logger.info(`Fetching data for customer ${customerCode} from ${dateHelpers.formatDate(startDate)} to ${dateHelpers.formatDate(endDate)}`);

    const [salesData, returnsData] = await Promise.all([
      getSalesData(customerCode, startDate, endDate),
      getReturnsData(customerCode, startDate, endDate),
    ]);

    return {
      customerCode,
      startDate,
      endDate,
      sales: salesData,
      returns: returnsData,
    };
  } catch (error) {
    logger.error(`Failed to fetch customer data for ${customerCode}`, {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get all customers' historical data
 * @returns {Promise<Array>}
 */
async function getAllCustomersData() {
  try {
    logger.info('Fetching historical data for all credit customers...');

    // Get date range
    const { startDate, endDate } = dateHelpers.getHistoricalDateRange(
      config.forecasting.historicalDataDays
    );

    // Get all credit customers
    const customers = await getCreditCustomers();

    // Fetch data for each customer
    const allData = [];
    for (const customer of customers) {
      try {
        const customerData = await getCustomerData(customer.CardCode, startDate, endDate);
        allData.push({
          ...customerData,
          customerName: customer.CardName,
        });
      } catch (error) {
        logger.error(`Failed to fetch data for customer ${customer.CardCode}, skipping...`, {
          error: error.message,
        });
        // Continue with other customers
      }
    }

    logger.info(`Successfully fetched data for ${allData.length} customers`);

    return allData;
  } catch (error) {
    logger.error('Failed to fetch all customers data', { error: error.message });
    throw error;
  }
}

/**
 * Get items list (for reference)
 * @returns {Promise<Array>}
 */
async function getItems() {
  try {
    logger.info('Fetching items from SAP B1...');

    const response = await sapB1Client.queryAll('Items', {
      select: ['ItemCode', 'ItemName', 'ItemType', 'InventoryItem'],
      filter: "InventoryItem eq 'Y' and Frozen eq 'N'",
    });

    logger.info(`Retrieved ${response.length} items`);

    return response;
  } catch (error) {
    logger.error('Failed to fetch items', { error: error.message });
    throw error;
  }
}

/**
 * Get promotions data (if stored in SAP B1)
 * This is optional and depends on how promotions are managed in your SAP B1
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
async function getPromotions(startDate, endDate) {
  try {
    logger.info('Fetching promotions data...');

    // This is a placeholder - implement based on your SAP B1 configuration
    // Promotions might be stored in:
    // - Special Prices (SPP1)
    // - Price Lists
    // - User-defined tables
    // - Marketing Documents with special fields

    // Example: Query special prices
    // const response = await sapB1Client.queryAll('SpecialPrices', {
    //   filter: `FromDate ge '${dateHelpers.formatForSAP(startDate)}' and UntilDate le '${dateHelpers.formatForSAP(endDate)}'`
    // });

    // For now, return empty array
    return [];
  } catch (error) {
    logger.error('Failed to fetch promotions', { error: error.message });
    return [];
  }
}

module.exports = {
  getCreditCustomers,
  getSalesData,
  getReturnsData,
  getCustomerData,
  getAllCustomersData,
  getItems,
  getPromotions,
};

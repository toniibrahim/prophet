/**
 * Sales Data Repository
 * Handles CRUD operations for sales and returns data
 */

const db = require('../connection');
const logger = require('../../utils/logger');

/**
 * Insert sales data in bulk
 * @param {Array} salesData - Array of sales records
 * @returns {Promise<number>} - Number of records inserted
 */
async function bulkInsertSales(salesData) {
  if (!salesData || salesData.length === 0) {
    return 0;
  }

  try {
    const values = salesData.map((item, index) => {
      const offset = index * 7;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    }).join(',');

    const params = salesData.flatMap(item => [
      item.customerCode,
      item.customerName,
      item.itemCode,
      item.itemDescription,
      item.docDate,
      item.docNum,
      item.quantity,
    ]);

    // Add line_total calculation if not provided
    const enrichedParams = salesData.flatMap(item => [
      item.customerCode,
      item.customerName,
      item.itemCode,
      item.itemDescription,
      item.docDate,
      item.docNum || '',
      item.quantity,
      item.lineTotal || 0,
    ]);

    const valuesStr = salesData.map((_, index) => {
      const offset = index * 8;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
    }).join(',');

    const query = `
      INSERT INTO sales_data (customer_code, customer_name, item_code, item_description, doc_date, doc_num, quantity, line_total)
      VALUES ${valuesStr}
      ON CONFLICT (customer_code, item_code, doc_date, doc_num) DO UPDATE
      SET quantity = EXCLUDED.quantity,
          line_total = EXCLUDED.line_total,
          updated_at = CURRENT_TIMESTAMP
    `;

    const result = await db.query(query, enrichedParams);
    logger.info(`Bulk inserted ${result.rowCount} sales records`);
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to bulk insert sales data', { error: error.message });
    throw error;
  }
}

/**
 * Insert returns data in bulk
 * @param {Array} returnsData - Array of return records
 * @returns {Promise<number>} - Number of records inserted
 */
async function bulkInsertReturns(returnsData) {
  if (!returnsData || returnsData.length === 0) {
    return 0;
  }

  try {
    const enrichedParams = returnsData.flatMap(item => [
      item.customerCode,
      item.customerName,
      item.itemCode,
      item.itemDescription,
      item.docDate,
      item.docNum || '',
      item.quantity,
      item.lineTotal || 0,
    ]);

    const valuesStr = returnsData.map((_, index) => {
      const offset = index * 8;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
    }).join(',');

    const query = `
      INSERT INTO returns_data (customer_code, customer_name, item_code, item_description, doc_date, doc_num, quantity, line_total)
      VALUES ${valuesStr}
      ON CONFLICT (customer_code, item_code, doc_date, doc_num) DO UPDATE
      SET quantity = EXCLUDED.quantity,
          line_total = EXCLUDED.line_total,
          updated_at = CURRENT_TIMESTAMP
    `;

    const result = await db.query(query, enrichedParams);
    logger.info(`Bulk inserted ${result.rowCount} returns records`);
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to bulk insert returns data', { error: error.message });
    throw error;
  }
}

/**
 * Get sales data for a customer within date range
 * @param {string} customerCode
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
async function getSalesByCustomerAndDateRange(customerCode, startDate, endDate) {
  try {
    const result = await db.query(
      `SELECT * FROM sales_data
       WHERE customer_code = $1
       AND doc_date >= $2
       AND doc_date <= $3
       ORDER BY doc_date ASC`,
      [customerCode, startDate, endDate]
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get sales data', { error: error.message });
    throw error;
  }
}

/**
 * Get returns data for a customer within date range
 * @param {string} customerCode
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
async function getReturnsByCustomerAndDateRange(customerCode, startDate, endDate) {
  try {
    const result = await db.query(
      `SELECT * FROM returns_data
       WHERE customer_code = $1
       AND doc_date >= $2
       AND doc_date <= $3
       ORDER BY doc_date ASC`,
      [customerCode, startDate, endDate]
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get returns data', { error: error.message });
    throw error;
  }
}

/**
 * Get aggregated sales by item for a customer
 * @param {string} customerCode
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
async function getAggregatedSalesByItem(customerCode, startDate, endDate) {
  try {
    const result = await db.query(
      `SELECT
        item_code,
        item_description,
        doc_date,
        SUM(quantity) as quantity,
        SUM(line_total) as line_total
       FROM sales_data
       WHERE customer_code = $1
       AND doc_date >= $2
       AND doc_date <= $3
       GROUP BY item_code, item_description, doc_date
       ORDER BY doc_date ASC`,
      [customerCode, startDate, endDate]
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get aggregated sales', { error: error.message });
    throw error;
  }
}

/**
 * Get aggregated returns by item for a customer
 * @param {string} customerCode
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
async function getAggregatedReturnsByItem(customerCode, startDate, endDate) {
  try {
    const result = await db.query(
      `SELECT
        item_code,
        item_description,
        doc_date,
        SUM(quantity) as quantity,
        SUM(line_total) as line_total
       FROM returns_data
       WHERE customer_code = $1
       AND doc_date >= $2
       AND doc_date <= $3
       GROUP BY item_code, item_description, doc_date
       ORDER BY doc_date ASC`,
      [customerCode, startDate, endDate]
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get aggregated returns', { error: error.message });
    throw error;
  }
}

/**
 * Get net sales (sales - returns) from view
 * @param {string} customerCode
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
async function getNetSales(customerCode, startDate, endDate) {
  try {
    const result = await db.query(
      `SELECT * FROM v_net_sales
       WHERE customer_code = $1
       AND doc_date >= $2
       AND doc_date <= $3
       ORDER BY doc_date ASC`,
      [customerCode, startDate, endDate]
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get net sales', { error: error.message });
    throw error;
  }
}

/**
 * Delete sales data for a customer (for re-importing)
 * @param {string} customerCode
 * @returns {Promise<number>}
 */
async function deleteSalesByCustomer(customerCode) {
  try {
    const result = await db.query(
      'DELETE FROM sales_data WHERE customer_code = $1',
      [customerCode]
    );
    logger.info(`Deleted ${result.rowCount} sales records for customer ${customerCode}`);
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to delete sales data', { error: error.message });
    throw error;
  }
}

/**
 * Delete returns data for a customer (for re-importing)
 * @param {string} customerCode
 * @returns {Promise<number>}
 */
async function deleteReturnsByCustomer(customerCode) {
  try {
    const result = await db.query(
      'DELETE FROM returns_data WHERE customer_code = $1',
      [customerCode]
    );
    logger.info(`Deleted ${result.rowCount} returns records for customer ${customerCode}`);
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to delete returns data', { error: error.message });
    throw error;
  }
}

/**
 * Get date range of existing data for a customer
 * @param {string} customerCode
 * @returns {Promise<Object>} - { minDate, maxDate }
 */
async function getCustomerDataDateRange(customerCode) {
  try {
    const result = await db.query(
      `SELECT
        MIN(doc_date) as min_date,
        MAX(doc_date) as max_date
       FROM (
         SELECT doc_date FROM sales_data WHERE customer_code = $1
         UNION ALL
         SELECT doc_date FROM returns_data WHERE customer_code = $1
       ) as combined`,
      [customerCode]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get customer data range', { error: error.message });
    throw error;
  }
}

module.exports = {
  bulkInsertSales,
  bulkInsertReturns,
  getSalesByCustomerAndDateRange,
  getReturnsByCustomerAndDateRange,
  getAggregatedSalesByItem,
  getAggregatedReturnsByItem,
  getNetSales,
  deleteSalesByCustomer,
  deleteReturnsByCustomer,
  getCustomerDataDateRange,
};

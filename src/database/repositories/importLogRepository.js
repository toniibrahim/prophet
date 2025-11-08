/**
 * Import Log Repository
 * Tracks data import history for incremental loading
 */

const db = require('../connection');
const logger = require('../../utils/logger');

/**
 * Get import log for a customer
 * @param {string} customerCode
 * @returns {Promise<Object|null>}
 */
async function getImportLog(customerCode) {
  try {
    const result = await db.query(
      'SELECT * FROM import_log WHERE customer_code = $1',
      [customerCode]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get import log', { error: error.message });
    throw error;
  }
}

/**
 * Check if customer has been imported before
 * @param {string} customerCode
 * @returns {Promise<boolean>}
 */
async function hasBeenImported(customerCode) {
  const log = await getImportLog(customerCode);
  return log !== null;
}

/**
 * Create initial import log entry
 * @param {string} customerCode
 * @param {string} customerName
 * @param {Date} importDate
 * @param {number} recordsImported
 * @returns {Promise<Object>}
 */
async function createImportLog(customerCode, customerName, importDate, recordsImported = 0) {
  try {
    const result = await db.query(
      `INSERT INTO import_log (customer_code, customer_name, last_import_date, initial_import_date, records_imported, import_status)
       VALUES ($1, $2, $3, $3, $4, 'success')
       RETURNING *`,
      [customerCode, customerName, importDate, recordsImported]
    );
    logger.info(`Created import log for customer ${customerCode}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create import log', { error: error.message });
    throw error;
  }
}

/**
 * Update import log after successful import
 * @param {string} customerCode
 * @param {Date} lastImportDate
 * @param {number} recordsImported
 * @returns {Promise<Object>}
 */
async function updateImportLog(customerCode, lastImportDate, recordsImported) {
  try {
    const result = await db.query(
      `UPDATE import_log
       SET last_import_date = $2,
           records_imported = records_imported + $3,
           import_status = 'success',
           error_message = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE customer_code = $1
       RETURNING *`,
      [customerCode, lastImportDate, recordsImported]
    );
    logger.info(`Updated import log for customer ${customerCode}, added ${recordsImported} records`);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update import log', { error: error.message });
    throw error;
  }
}

/**
 * Mark import as failed
 * @param {string} customerCode
 * @param {string} errorMessage
 * @returns {Promise<Object>}
 */
async function markImportFailed(customerCode, errorMessage) {
  try {
    const result = await db.query(
      `UPDATE import_log
       SET import_status = 'failed',
           error_message = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE customer_code = $1
       RETURNING *`,
      [customerCode, errorMessage]
    );
    logger.warn(`Marked import as failed for customer ${customerCode}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to mark import as failed', { error: error.message });
    throw error;
  }
}

/**
 * Mark import as in progress
 * @param {string} customerCode
 * @returns {Promise<Object>}
 */
async function markImportInProgress(customerCode) {
  try {
    const result = await db.query(
      `UPDATE import_log
       SET import_status = 'in_progress',
           updated_at = CURRENT_TIMESTAMP
       WHERE customer_code = $1
       RETURNING *`,
      [customerCode]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to mark import in progress', { error: error.message });
    throw error;
  }
}

/**
 * Get all import logs
 * @returns {Promise<Array>}
 */
async function getAllImportLogs() {
  try {
    const result = await db.query(
      'SELECT * FROM import_log ORDER BY updated_at DESC'
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get all import logs', { error: error.message });
    throw error;
  }
}

/**
 * Get import logs with failed status
 * @returns {Promise<Array>}
 */
async function getFailedImports() {
  try {
    const result = await db.query(
      "SELECT * FROM import_log WHERE import_status = 'failed' ORDER BY updated_at DESC"
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get failed imports', { error: error.message });
    throw error;
  }
}

/**
 * Delete import log for a customer
 * @param {string} customerCode
 * @returns {Promise<number>}
 */
async function deleteImportLog(customerCode) {
  try {
    const result = await db.query(
      'DELETE FROM import_log WHERE customer_code = $1',
      [customerCode]
    );
    logger.info(`Deleted import log for customer ${customerCode}`);
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to delete import log', { error: error.message });
    throw error;
  }
}

/**
 * Get the date range that needs to be imported for a customer
 * @param {string} customerCode
 * @param {number} initialHistoricalDays - Number of days for initial import (default 730 = 2 years)
 * @returns {Promise<Object>} - { startDate, endDate, isInitialImport }
 */
async function getImportDateRange(customerCode, initialHistoricalDays = 730) {
  try {
    const log = await getImportLog(customerCode);
    const endDate = new Date();

    if (!log) {
      // First time import - get historical data
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - initialHistoricalDays);

      return {
        startDate,
        endDate,
        isInitialImport: true,
      };
    } else {
      // Incremental import - get data since last import
      const startDate = new Date(log.last_import_date);
      startDate.setDate(startDate.getDate() + 1); // Start from next day

      return {
        startDate,
        endDate,
        isInitialImport: false,
      };
    }
  } catch (error) {
    logger.error('Failed to get import date range', { error: error.message });
    throw error;
  }
}

module.exports = {
  getImportLog,
  hasBeenImported,
  createImportLog,
  updateImportLog,
  markImportFailed,
  markImportInProgress,
  getAllImportLogs,
  getFailedImports,
  deleteImportLog,
  getImportDateRange,
};

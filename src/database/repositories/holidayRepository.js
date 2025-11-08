/**
 * Holiday Repository
 * Manages holidays, Ramadan dates, and promotions
 */

const db = require('../connection');
const logger = require('../../utils/logger');

// ============================================================
// HOLIDAYS
// ============================================================

/**
 * Get all holidays
 * @param {number} year - Optional year filter
 * @returns {Promise<Array>}
 */
async function getAllHolidays(year = null) {
  try {
    let query = 'SELECT * FROM holidays WHERE is_active = true';
    const params = [];

    if (year) {
      query += ' AND year = $1';
      params.push(year);
    }

    query += ' ORDER BY start_date ASC';

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get holidays', { error: error.message });
    throw error;
  }
}

/**
 * Get holiday by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getHolidayById(id) {
  try {
    const result = await db.query('SELECT * FROM holidays WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get holiday', { error: error.message });
    throw error;
  }
}

/**
 * Create new holiday
 * @param {Object} holidayData
 * @returns {Promise<Object>}
 */
async function createHoliday(holidayData) {
  try {
    const result = await db.query(
      `INSERT INTO holidays (holiday_name, holiday_type, start_date, end_date, year, description, impact_multiplier)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        holidayData.holiday_name,
        holidayData.holiday_type,
        holidayData.start_date,
        holidayData.end_date,
        holidayData.year,
        holidayData.description || null,
        holidayData.impact_multiplier || 1.0,
      ]
    );
    logger.info(`Created holiday: ${holidayData.holiday_name}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create holiday', { error: error.message });
    throw error;
  }
}

/**
 * Update holiday
 * @param {number} id
 * @param {Object} holidayData
 * @returns {Promise<Object>}
 */
async function updateHoliday(id, holidayData) {
  try {
    const result = await db.query(
      `UPDATE holidays
       SET holiday_name = $2,
           holiday_type = $3,
           start_date = $4,
           end_date = $5,
           year = $6,
           description = $7,
           impact_multiplier = $8,
           is_active = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        holidayData.holiday_name,
        holidayData.holiday_type,
        holidayData.start_date,
        holidayData.end_date,
        holidayData.year,
        holidayData.description || null,
        holidayData.impact_multiplier || 1.0,
        holidayData.is_active !== undefined ? holidayData.is_active : true,
      ]
    );
    logger.info(`Updated holiday ID: ${id}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update holiday', { error: error.message });
    throw error;
  }
}

/**
 * Delete holiday
 * @param {number} id
 * @returns {Promise<number>}
 */
async function deleteHoliday(id) {
  try {
    const result = await db.query('DELETE FROM holidays WHERE id = $1', [id]);
    logger.info(`Deleted holiday ID: ${id}`);
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to delete holiday', { error: error.message });
    throw error;
  }
}

/**
 * Get holidays within date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
async function getHolidaysInRange(startDate, endDate) {
  try {
    const result = await db.query(
      `SELECT * FROM holidays
       WHERE is_active = true
       AND start_date <= $2
       AND end_date >= $1
       ORDER BY start_date ASC`,
      [startDate, endDate]
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get holidays in range', { error: error.message });
    throw error;
  }
}

// ============================================================
// RAMADAN DATES
// ============================================================

/**
 * Get all Ramadan dates
 * @returns {Promise<Array>}
 */
async function getAllRamadanDates() {
  try {
    const result = await db.query(
      'SELECT * FROM ramadan_dates WHERE is_active = true ORDER BY year DESC'
    );
    return result.rows;
  } catch (error) {
    logger.error('Failed to get Ramadan dates', { error: error.message });
    throw error;
  }
}

/**
 * Get Ramadan dates for a specific year
 * @param {number} year
 * @returns {Promise<Object|null>}
 */
async function getRamadanByYear(year) {
  try {
    const result = await db.query(
      'SELECT * FROM ramadan_dates WHERE year = $1',
      [year]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get Ramadan dates for year', { error: error.message });
    throw error;
  }
}

/**
 * Create or update Ramadan dates for a year
 * @param {Object} ramadanData
 * @returns {Promise<Object>}
 */
async function upsertRamadanDates(ramadanData) {
  try {
    const result = await db.query(
      `INSERT INTO ramadan_dates (year, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (year) DO UPDATE
       SET start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           notes = EXCLUDED.notes,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        ramadanData.year,
        ramadanData.start_date,
        ramadanData.end_date,
        ramadanData.notes || null,
      ]
    );
    logger.info(`Upserted Ramadan dates for year ${ramadanData.year}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to upsert Ramadan dates', { error: error.message });
    throw error;
  }
}

/**
 * Delete Ramadan dates for a year
 * @param {number} year
 * @returns {Promise<number>}
 */
async function deleteRamadanDates(year) {
  try {
    const result = await db.query('DELETE FROM ramadan_dates WHERE year = $1', [year]);
    logger.info(`Deleted Ramadan dates for year ${year}`);
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to delete Ramadan dates', { error: error.message });
    throw error;
  }
}

// ============================================================
// PROMOTIONS
// ============================================================

/**
 * Get all promotions
 * @param {number} year - Optional year filter
 * @returns {Promise<Array>}
 */
async function getAllPromotions(year = null) {
  try {
    let query = 'SELECT * FROM promotions WHERE is_active = true';
    const params = [];

    if (year) {
      query += ' AND year = $1';
      params.push(year);
    }

    query += ' ORDER BY start_date DESC';

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get promotions', { error: error.message });
    throw error;
  }
}

/**
 * Get promotion by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getPromotionById(id) {
  try {
    const result = await db.query('SELECT * FROM promotions WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get promotion', { error: error.message });
    throw error;
  }
}

/**
 * Create new promotion
 * @param {Object} promotionData
 * @returns {Promise<Object>}
 */
async function createPromotion(promotionData) {
  try {
    const result = await db.query(
      `INSERT INTO promotions (promotion_name, promotion_type, start_date, end_date, year, item_codes, customer_codes, discount_percentage, expected_uplift, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        promotionData.promotion_name,
        promotionData.promotion_type || null,
        promotionData.start_date,
        promotionData.end_date,
        promotionData.year,
        promotionData.item_codes || null,
        promotionData.customer_codes || null,
        promotionData.discount_percentage || null,
        promotionData.expected_uplift || 1.0,
        promotionData.description || null,
      ]
    );
    logger.info(`Created promotion: ${promotionData.promotion_name}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create promotion', { error: error.message });
    throw error;
  }
}

/**
 * Update promotion
 * @param {number} id
 * @param {Object} promotionData
 * @returns {Promise<Object>}
 */
async function updatePromotion(id, promotionData) {
  try {
    const result = await db.query(
      `UPDATE promotions
       SET promotion_name = $2,
           promotion_type = $3,
           start_date = $4,
           end_date = $5,
           year = $6,
           item_codes = $7,
           customer_codes = $8,
           discount_percentage = $9,
           expected_uplift = $10,
           description = $11,
           is_active = $12,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        promotionData.promotion_name,
        promotionData.promotion_type || null,
        promotionData.start_date,
        promotionData.end_date,
        promotionData.year,
        promotionData.item_codes || null,
        promotionData.customer_codes || null,
        promotionData.discount_percentage || null,
        promotionData.expected_uplift || 1.0,
        promotionData.description || null,
        promotionData.is_active !== undefined ? promotionData.is_active : true,
      ]
    );
    logger.info(`Updated promotion ID: ${id}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update promotion', { error: error.message });
    throw error;
  }
}

/**
 * Delete promotion
 * @param {number} id
 * @returns {Promise<number>}
 */
async function deletePromotion(id) {
  try {
    const result = await db.query('DELETE FROM promotions WHERE id = $1', [id]);
    logger.info(`Deleted promotion ID: ${id}`);
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to delete promotion', { error: error.message });
    throw error;
  }
}

/**
 * Get promotions within date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} customerCode - Optional customer filter
 * @param {string} itemCode - Optional item filter
 * @returns {Promise<Array>}
 */
async function getPromotionsInRange(startDate, endDate, customerCode = null, itemCode = null) {
  try {
    let query = `
      SELECT * FROM promotions
      WHERE is_active = true
      AND start_date <= $2
      AND end_date >= $1
    `;
    const params = [startDate, endDate];

    if (customerCode) {
      query += ` AND (customer_codes IS NULL OR $3 = ANY(customer_codes))`;
      params.push(customerCode);
    }

    if (itemCode) {
      const itemParam = customerCode ? '$4' : '$3';
      query += ` AND (item_codes IS NULL OR ${itemParam} = ANY(item_codes))`;
      params.push(itemCode);
    }

    query += ' ORDER BY start_date ASC';

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get promotions in range', { error: error.message });
    throw error;
  }
}

module.exports = {
  // Holidays
  getAllHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getHolidaysInRange,

  // Ramadan
  getAllRamadanDates,
  getRamadanByYear,
  upsertRamadanDates,
  deleteRamadanDates,

  // Promotions
  getAllPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getPromotionsInRange,
};

/**
 * Database-backed Holiday and Special Events Calendar
 * Generates holidays for Prophet forecasting model using database
 */

const dateHelpers = require('../utils/dateHelpers');
const holidayRepository = require('../database/repositories/holidayRepository');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Generate holidays dataframe for Prophet from database
 * Prophet expects holidays in format: [{ ds: 'YYYY-MM-DD', holiday: 'holiday_name' }]
 *
 * @param {number} startYear
 * @param {number} endYear
 * @returns {Promise<Array>} Array of holiday objects
 */
async function generateHolidays(startYear, endYear) {
  const holidays = [];

  try {
    // If database is not enabled, fall back to config-based holidays
    if (!config.database.enabled) {
      logger.info('Database not enabled, using config-based holidays');
      const legacyCalendar = require('./holidayCalendar');
      return legacyCalendar.generateHolidays(startYear, endYear);
    }

    for (let year = startYear; year <= endYear; year++) {
      // Get Ramadan dates from database
      const ramadan = await holidayRepository.getRamadanByYear(year);
      if (ramadan && ramadan.is_active) {
        const ramadanHolidays = generateHolidaysFromDateRange(
          new Date(ramadan.start_date),
          new Date(ramadan.end_date),
          'ramadan'
        );
        holidays.push(...ramadanHolidays);
      } else {
        // Fallback to calculation if not in database
        logger.debug(`No Ramadan dates in database for year ${year}, using calculation`);
        const islamicHolidays = dateHelpers.calculateIslamicHolidays(year);
        const ramadanHolidays = generateHolidaysFromDateRange(
          islamicHolidays.ramadan.start,
          islamicHolidays.ramadan.end,
          'ramadan'
        );
        holidays.push(...ramadanHolidays);
      }

      // Get other holidays from database
      const yearHolidays = await holidayRepository.getAllHolidays(year);
      for (const holiday of yearHolidays) {
        const holidayEntries = generateHolidaysFromDateRange(
          new Date(holiday.start_date),
          new Date(holiday.end_date),
          holiday.holiday_type === 'islamic' ? holiday.holiday_name.toLowerCase().replace(/\s+/g, '_') : holiday.holiday_name.toLowerCase().replace(/\s+/g, '_')
        );
        holidays.push(...holidayEntries);
      }

      // Get promotions from database and add as special events
      const promotions = await holidayRepository.getAllPromotions(year);
      for (const promotion of promotions) {
        const promoEntries = generateHolidaysFromDateRange(
          new Date(promotion.start_date),
          new Date(promotion.end_date),
          `promotion_${promotion.promotion_name.toLowerCase().replace(/\s+/g, '_')}`
        );
        holidays.push(...promoEntries);
      }
    }

    logger.debug(`Generated ${holidays.length} holiday entries from database for years ${startYear}-${endYear}`);
    return holidays;
  } catch (error) {
    logger.error('Failed to generate holidays from database, falling back to config', {
      error: error.message,
    });
    // Fallback to config-based holidays
    const legacyCalendar = require('./holidayCalendar');
    return legacyCalendar.generateHolidays(startYear, endYear);
  }
}

/**
 * Generate holiday entries for a date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} holidayName
 * @returns {Array}
 */
function generateHolidaysFromDateRange(startDate, endDate, holidayName) {
  const holidays = [];
  const dates = dateHelpers.createDateArray(
    startDate,
    dateHelpers.differenceInDays(endDate, startDate) + 1
  );

  dates.forEach(date => {
    holidays.push({
      ds: dateHelpers.formatForSAP(date),
      holiday: holidayName,
      lower_window: 0,
      upper_window: 0,
    });
  });

  return holidays;
}

/**
 * Get holiday calendar for a date range from database
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array>}
 */
async function getHolidaysForRange(startDate, endDate) {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  return await generateHolidays(startYear, endYear);
}

/**
 * Check if a date is a special event (database-aware)
 * @param {Date} date
 * @returns {Promise<Object>} { isSpecialEvent: boolean, events: string[], promotions: Array }
 */
async function checkSpecialEvents(date) {
  const events = [];
  const promotions = [];

  try {
    // If database is not enabled, fall back to config-based check
    if (!config.database.enabled) {
      const legacyCalendar = require('./holidayCalendar');
      return legacyCalendar.checkSpecialEvents(date);
    }

    const dateStr = dateHelpers.formatForSAP(date);

    // Check Ramadan
    const year = date.getFullYear();
    const ramadan = await holidayRepository.getRamadanByYear(year);
    if (ramadan && ramadan.is_active) {
      const ramadanStart = new Date(ramadan.start_date);
      const ramadanEnd = new Date(ramadan.end_date);
      if (date >= ramadanStart && date <= ramadanEnd) {
        events.push('ramadan');
      }
    }

    // Check holidays
    const holidays = await holidayRepository.getHolidaysInRange(dateStr, dateStr);
    for (const holiday of holidays) {
      const eventName = holiday.holiday_name.toLowerCase().replace(/\s+/g, '_');
      events.push(eventName);
    }

    // Check promotions
    const activePromotions = await holidayRepository.getPromotionsInRange(dateStr, dateStr);
    for (const promo of activePromotions) {
      const promoName = `promotion_${promo.promotion_name.toLowerCase().replace(/\s+/g, '_')}`;
      events.push(promoName);
      promotions.push({
        name: promo.promotion_name,
        type: promo.promotion_type,
        uplift: promo.expected_uplift,
      });
    }

    // Check weekend
    if (dateHelpers.isWeekendDay(date)) {
      events.push('weekend');
    }

    return {
      isSpecialEvent: events.length > 0,
      events,
      promotions,
    };
  } catch (error) {
    logger.error('Failed to check special events from database, falling back', {
      error: error.message,
    });
    // Fallback to config-based check
    const legacyCalendar = require('./holidayCalendar');
    return legacyCalendar.checkSpecialEvents(date);
  }
}

/**
 * Check special events synchronously (for compatibility with existing code)
 * Note: This will not include database-sourced events
 * @param {Date} date
 * @returns {Object}
 */
function checkSpecialEventsSync(date) {
  const legacyCalendar = require('./holidayCalendar');
  return legacyCalendar.checkSpecialEvents(date);
}

module.exports = {
  generateHolidays,
  getHolidaysForRange,
  checkSpecialEvents,
  checkSpecialEventsSync, // For backward compatibility
};

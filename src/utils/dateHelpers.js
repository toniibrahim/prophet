/**
 * Date helper utilities
 * Handles date operations, timezone conversions, and calendar calculations
 */

const { format, addDays, subDays, differenceInDays, isWeekend, getDay } = require('date-fns');
const { utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');
const config = require('../config');

/**
 * Get current date in configured timezone
 * @returns {Date}
 */
function getCurrentDate() {
  return utcToZonedTime(new Date(), config.regional.timezone);
}

/**
 * Format date for SAP B1 API (YYYY-MM-DD)
 * @param {Date} date
 * @returns {string}
 */
function formatForSAP(date) {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format date for display
 * @param {Date} date
 * @param {string} formatStr
 * @returns {string}
 */
function formatDate(date, formatStr = 'yyyy-MM-dd HH:mm:ss') {
  return format(date, formatStr);
}

/**
 * Get date N days from now
 * @param {number} days
 * @returns {Date}
 */
function getDaysFromNow(days) {
  return addDays(getCurrentDate(), days);
}

/**
 * Get date N days before now
 * @param {number} days
 * @returns {Date}
 */
function getDaysBeforeNow(days) {
  return subDays(getCurrentDate(), days);
}

/**
 * Check if date is weekend (Friday and Saturday)
 * @param {Date} date
 * @returns {boolean}
 */
function isWeekendDay(date) {
  const day = getDay(date);
  return day === 5 || day === 6; // Friday (5) and Saturday (6)
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 * @param {Date} date
 * @returns {number}
 */
function getDayOfWeek(date) {
  return getDay(date);
}

/**
 * Simple Islamic calendar approximation
 * Note: For production, consider using a proper Islamic calendar library
 * This uses the approximate calculation method
 *
 * @param {number} year - Gregorian year
 * @returns {Object} Approximate dates for Ramadan and Eid al-Adha
 */
function calculateIslamicHolidays(year) {
  // Islamic calendar is approximately 11 days shorter than Gregorian
  // This is a simplified approximation - for production use a proper library

  // Reference point: Ramadan 2024 started around March 11
  // Reference point: Eid al-Adha 2024 was around June 16

  const referenceYear = 2024;
  const ramadanReferenceDate = new Date(2024, 2, 11); // March 11, 2024
  const eidAdhaReferenceDate = new Date(2024, 5, 16); // June 16, 2024

  const yearDiff = year - referenceYear;
  const daysToSubtract = yearDiff * 11; // Islamic year is ~11 days shorter

  const ramadanStart = new Date(ramadanReferenceDate);
  ramadanStart.setDate(ramadanStart.getDate() - daysToSubtract);

  const ramadanEnd = new Date(ramadanStart);
  ramadanEnd.setDate(ramadanEnd.getDate() + 29); // Ramadan is ~29-30 days

  const eidAdhaStart = new Date(eidAdhaReferenceDate);
  eidAdhaStart.setDate(eidAdhaStart.getDate() - daysToSubtract);

  return {
    ramadan: {
      start: ramadanStart,
      end: ramadanEnd,
    },
    eidAdha: {
      start: eidAdhaStart,
      durationDays: config.specialEvents.eidAdha.durationDays,
    },
  };
}

/**
 * Check if a date falls within Ramadan
 * @param {Date} date
 * @returns {boolean}
 */
function isInRamadan(date) {
  // Check if manual override is set
  if (config.specialEvents.ramadan.startDate && config.specialEvents.ramadan.endDate) {
    const start = new Date(config.specialEvents.ramadan.startDate);
    const end = new Date(config.specialEvents.ramadan.endDate);
    return date >= start && date <= end;
  }

  // Calculate for current year
  const holidays = calculateIslamicHolidays(date.getFullYear());
  return date >= holidays.ramadan.start && date <= holidays.ramadan.end;
}

/**
 * Check if a date falls within Eid al-Adha period
 * @param {Date} date
 * @returns {boolean}
 */
function isInEidAdha(date) {
  // Check if manual override is set
  if (config.specialEvents.eidAdha.startDate) {
    const start = new Date(config.specialEvents.eidAdha.startDate);
    const end = addDays(start, config.specialEvents.eidAdha.durationDays);
    return date >= start && date < end;
  }

  // Calculate for current year
  const holidays = calculateIslamicHolidays(date.getFullYear());
  const end = addDays(holidays.eidAdha.start, holidays.eidAdha.durationDays);
  return date >= holidays.eidAdha.start && date < end;
}

/**
 * Check if a date falls within back-to-school period
 * @param {Date} date
 * @returns {boolean}
 */
function isInBackToSchool(date) {
  const year = date.getFullYear();
  const startMonth = config.specialEvents.backToSchool.startMonth - 1; // 0-indexed
  const startDay = config.specialEvents.backToSchool.startDay;

  const start = new Date(year, startMonth, startDay);
  const end = addDays(start, config.specialEvents.backToSchool.durationDays);

  return date >= start && date < end;
}

/**
 * Get day name
 * @param {Date} date
 * @returns {string}
 */
function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[getDay(date)];
}

/**
 * Parse SAP B1 date string
 * @param {string} dateString
 * @returns {Date}
 */
function parseSAPDate(dateString) {
  // SAP B1 dates can come in various formats
  // Common format: "2024-11-05" or "2024-11-05T00:00:00"
  return new Date(dateString);
}

/**
 * Get date range for historical data
 * @param {number} days
 * @returns {Object} { startDate, endDate }
 */
function getHistoricalDateRange(days) {
  const endDate = getCurrentDate();
  const startDate = subDays(endDate, days);
  return { startDate, endDate };
}

/**
 * Create date array for forecasting
 * @param {Date} startDate
 * @param {number} days
 * @returns {Date[]}
 */
function createDateArray(startDate, days) {
  const dates = [];
  for (let i = 0; i < days; i++) {
    dates.push(addDays(startDate, i));
  }
  return dates;
}

module.exports = {
  getCurrentDate,
  formatForSAP,
  formatDate,
  getDaysFromNow,
  getDaysBeforeNow,
  isWeekendDay,
  getDayOfWeek,
  getDayName,
  calculateIslamicHolidays,
  isInRamadan,
  isInEidAdha,
  isInBackToSchool,
  parseSAPDate,
  getHistoricalDateRange,
  createDateArray,
  differenceInDays,
  addDays,
  subDays,
};

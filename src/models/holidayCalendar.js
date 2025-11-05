/**
 * Holiday and Special Events Calendar
 * Generates holidays for Prophet forecasting model
 */

const dateHelpers = require('../utils/dateHelpers');
const config = require('../config');

/**
 * Generate holidays dataframe for Prophet
 * Prophet expects holidays in format: [{ ds: 'YYYY-MM-DD', holiday: 'holiday_name' }]
 *
 * @param {number} startYear
 * @param {number} endYear
 * @returns {Array} Array of holiday objects
 */
function generateHolidays(startYear, endYear) {
  const holidays = [];

  for (let year = startYear; year <= endYear; year++) {
    // Add Ramadan holidays
    const ramadanHolidays = generateRamadanHolidays(year);
    holidays.push(...ramadanHolidays);

    // Add Eid al-Adha holidays
    const eidAdhaHolidays = generateEidAdhaHolidays(year);
    holidays.push(...eidAdhaHolidays);

    // Add Back to School period
    const backToSchoolHolidays = generateBackToSchoolHolidays(year);
    holidays.push(...backToSchoolHolidays);

    // Add Weekends (if desired, though Prophet handles weekly seasonality)
    // const weekendHolidays = generateWeekendHolidays(year);
    // holidays.push(...weekendHolidays);
  }

  return holidays;
}

/**
 * Generate Ramadan holiday entries
 * @param {number} year
 * @returns {Array}
 */
function generateRamadanHolidays(year) {
  const holidays = [];

  let ramadanStart, ramadanEnd;

  // Check for manual override
  if (config.specialEvents.ramadan.startDate && config.specialEvents.ramadan.endDate) {
    const configStart = new Date(config.specialEvents.ramadan.startDate);
    const configEnd = new Date(config.specialEvents.ramadan.endDate);

    if (configStart.getFullYear() === year) {
      ramadanStart = configStart;
      ramadanEnd = configEnd;
    } else {
      const islamicHolidays = dateHelpers.calculateIslamicHolidays(year);
      ramadanStart = islamicHolidays.ramadan.start;
      ramadanEnd = islamicHolidays.ramadan.end;
    }
  } else {
    const islamicHolidays = dateHelpers.calculateIslamicHolidays(year);
    ramadanStart = islamicHolidays.ramadan.start;
    ramadanEnd = islamicHolidays.ramadan.end;
  }

  // Generate daily entries for Ramadan
  const dates = dateHelpers.createDateArray(
    ramadanStart,
    dateHelpers.differenceInDays(ramadanEnd, ramadanStart) + 1
  );

  dates.forEach(date => {
    holidays.push({
      ds: dateHelpers.formatForSAP(date),
      holiday: 'ramadan',
      lower_window: 0,
      upper_window: 0,
    });
  });

  return holidays;
}

/**
 * Generate Eid al-Adha holiday entries
 * @param {number} year
 * @returns {Array}
 */
function generateEidAdhaHolidays(year) {
  const holidays = [];

  let eidStart;

  // Check for manual override
  if (config.specialEvents.eidAdha.startDate) {
    const configStart = new Date(config.specialEvents.eidAdha.startDate);
    if (configStart.getFullYear() === year) {
      eidStart = configStart;
    } else {
      const islamicHolidays = dateHelpers.calculateIslamicHolidays(year);
      eidStart = islamicHolidays.eidAdha.start;
    }
  } else {
    const islamicHolidays = dateHelpers.calculateIslamicHolidays(year);
    eidStart = islamicHolidays.eidAdha.start;
  }

  // Generate daily entries for Eid al-Adha
  const dates = dateHelpers.createDateArray(
    eidStart,
    config.specialEvents.eidAdha.durationDays
  );

  dates.forEach(date => {
    holidays.push({
      ds: dateHelpers.formatForSAP(date),
      holiday: 'eid_adha',
      lower_window: 0,
      upper_window: 0,
    });
  });

  return holidays;
}

/**
 * Generate Back to School holiday entries
 * @param {number} year
 * @returns {Array}
 */
function generateBackToSchoolHolidays(year) {
  const holidays = [];

  const startMonth = config.specialEvents.backToSchool.startMonth - 1; // 0-indexed
  const startDay = config.specialEvents.backToSchool.startDay;
  const durationDays = config.specialEvents.backToSchool.durationDays;

  const start = new Date(year, startMonth, startDay);
  const dates = dateHelpers.createDateArray(start, durationDays);

  dates.forEach(date => {
    holidays.push({
      ds: dateHelpers.formatForSAP(date),
      holiday: 'back_to_school',
      lower_window: 0,
      upper_window: 0,
    });
  });

  return holidays;
}

/**
 * Generate weekend entries (optional)
 * @param {number} year
 * @returns {Array}
 */
function generateWeekendHolidays(year) {
  const holidays = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const dates = dateHelpers.createDateArray(
    startDate,
    dateHelpers.differenceInDays(endDate, startDate) + 1
  );

  dates.forEach(date => {
    if (dateHelpers.isWeekendDay(date)) {
      holidays.push({
        ds: dateHelpers.formatForSAP(date),
        holiday: 'weekend',
        lower_window: 0,
        upper_window: 0,
      });
    }
  });

  return holidays;
}

/**
 * Get holiday calendar for a date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array}
 */
function getHolidaysForRange(startDate, endDate) {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  return generateHolidays(startYear, endYear);
}

/**
 * Check if a date is a special event
 * @param {Date} date
 * @returns {Object} { isSpecialEvent: boolean, events: string[] }
 */
function checkSpecialEvents(date) {
  const events = [];

  if (dateHelpers.isInRamadan(date)) {
    events.push('ramadan');
  }

  if (dateHelpers.isInEidAdha(date)) {
    events.push('eid_adha');
  }

  if (dateHelpers.isInBackToSchool(date)) {
    events.push('back_to_school');
  }

  if (dateHelpers.isWeekendDay(date)) {
    events.push('weekend');
  }

  return {
    isSpecialEvent: events.length > 0,
    events,
  };
}

module.exports = {
  generateHolidays,
  generateRamadanHolidays,
  generateEidAdhaHolidays,
  generateBackToSchoolHolidays,
  generateWeekendHolidays,
  getHolidaysForRange,
  checkSpecialEvents,
};

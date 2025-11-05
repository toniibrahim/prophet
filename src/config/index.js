/**
 * Configuration module for SAP B1 Sales Forecaster
 * Loads and validates environment variables
 */

require('dotenv').config();

const config = {
  // SAP B1 Configuration
  sapB1: {
    serviceLayerUrl: process.env.SAP_B1_SERVICE_LAYER_URL,
    companyDb: process.env.SAP_B1_COMPANY_DB,
    username: process.env.SAP_B1_USERNAME,
    password: process.env.SAP_B1_PASSWORD,
  },

  // Forecasting Configuration
  forecasting: {
    horizonDays: parseInt(process.env.FORECAST_HORIZON_DAYS || '2', 10),
    historicalDataDays: parseInt(process.env.HISTORICAL_DATA_DAYS || '365', 10),
    minHistoricalRecords: parseInt(process.env.MIN_HISTORICAL_RECORDS || '30', 10),
    confidenceInterval: parseFloat(process.env.CONFIDENCE_INTERVAL || '0.95'),
  },

  // Prophet Model Parameters
  prophet: {
    changepointPriorScale: parseFloat(process.env.PROPHET_CHANGEPOINT_PRIOR_SCALE || '0.05'),
    seasonalityPriorScale: parseFloat(process.env.PROPHET_SEASONALITY_PRIOR_SCALE || '10'),
    holidaysPriorScale: parseFloat(process.env.PROPHET_HOLIDAYS_PRIOR_SCALE || '10'),
    seasonalityMode: process.env.PROPHET_SEASONALITY_MODE || 'multiplicative',
    weeklySeasonality: process.env.PROPHET_WEEKLY_SEASONALITY !== 'false',
    yearlySeasonality: process.env.PROPHET_YEARLY_SEASONALITY !== 'false',
    dailySeasonality: process.env.PROPHET_DAILY_SEASONALITY === 'true',
  },

  // Business Logic Parameters
  businessLogic: {
    stockoutSalesThreshold: parseFloat(process.env.STOCKOUT_SALES_THRESHOLD || '0.8'),
    stockoutMultiplier: parseFloat(process.env.STOCKOUT_MULTIPLIER || '1.3'),
    overstockReturnThreshold: parseFloat(process.env.OVERSTOCK_RETURN_THRESHOLD || '0.15'),
    overstockMultiplier: parseFloat(process.env.OVERSTOCK_MULTIPLIER || '0.7'),
    safetyStockPercentage: parseFloat(process.env.SAFETY_STOCK_PERCENTAGE || '0.1'),
    minOrderQuantity: parseInt(process.env.MIN_ORDER_QUANTITY || '1', 10),
  },

  // Regional Settings
  regional: {
    timezone: process.env.TIMEZONE || 'Asia/Riyadh',
    locale: process.env.LOCALE || 'en-US',
  },

  // Scheduling
  scheduling: {
    forecastGenerationTime: process.env.FORECAST_GENERATION_TIME || '06:00',
    enableScheduler: process.env.ENABLE_SCHEDULER !== 'false',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/forecaster.log',
  },

  // Output
  output: {
    format: process.env.OUTPUT_FORMAT || 'xlsx',
    path: process.env.OUTPUT_PATH || './data/output',
  },

  // Special Events
  specialEvents: {
    backToSchool: {
      startMonth: parseInt(process.env.BACK_TO_SCHOOL_START_MONTH || '8', 10),
      startDay: parseInt(process.env.BACK_TO_SCHOOL_START_DAY || '15', 10),
      durationDays: parseInt(process.env.BACK_TO_SCHOOL_DURATION_DAYS || '30', 10),
    },
    ramadan: {
      startDate: process.env.RAMADAN_START_DATE,
      endDate: process.env.RAMADAN_END_DATE,
    },
    eidAdha: {
      startDate: process.env.EID_ADHA_START_DATE,
      durationDays: parseInt(process.env.EID_ADHA_DURATION_DAYS || '4', 10),
    },
  },

  // Odoo Configuration
  odoo: {
    enabled: process.env.ODOO_ENABLED === 'true',
    url: process.env.ODOO_URL,
    db: process.env.ODOO_DB,
    username: process.env.ODOO_USERNAME,
    password: process.env.ODOO_PASSWORD,
    defaultSalesmanId: process.env.ODOO_DEFAULT_SALESMAN_ID ? parseInt(process.env.ODOO_DEFAULT_SALESMAN_ID, 10) : null,
    autoConfirmOrders: process.env.ODOO_AUTO_CONFIRM_ORDERS === 'true',
    createTransferRequests: process.env.ODOO_CREATE_TRANSFER_REQUESTS === 'true',
  },
};

/**
 * Validates required configuration
 */
function validateConfig() {
  const required = [
    'sapB1.serviceLayerUrl',
    'sapB1.companyDb',
    'sapB1.username',
    'sapB1.password',
  ];

  const missing = [];

  required.forEach(key => {
    const keys = key.split('.');
    let value = config;
    for (const k of keys) {
      value = value[k];
      if (value === undefined || value === null || value === '') {
        missing.push(key);
        break;
      }
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.join(', ')}\n` +
      'Please check your .env file against .env.example'
    );
  }
}

// Validate on load
if (process.env.NODE_ENV !== 'test') {
  // Only validate if SAP config is provided (skip validation for testing/demo)
  if (process.env.SAP_B1_SERVICE_LAYER_URL) {
    validateConfig();
  }
}

module.exports = config;

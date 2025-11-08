/**
 * Database Migration Script
 * Initializes and updates database schema
 */

const fs = require('fs');
const path = require('path');
const db = require('./connection');
const logger = require('../utils/logger');

/**
 * Run database migration
 * @returns {Promise<void>}
 */
async function runMigration() {
  try {
    logger.info('Starting database migration...');

    // Test connection
    const connected = await db.testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await db.executeSqlFile(schemaSQL);

    logger.info('Database migration completed successfully');

    // Display stats
    const stats = await db.getStats();
    logger.info('Database statistics:', stats);

    return true;
  } catch (error) {
    logger.error('Database migration failed', { error: error.message });
    throw error;
  }
}

/**
 * Verify database schema
 * @returns {Promise<boolean>}
 */
async function verifySchema() {
  try {
    const requiredTables = [
      'sales_data',
      'returns_data',
      'import_log',
      'holidays',
      'ramadan_dates',
      'promotions',
      'system_config',
    ];

    logger.info('Verifying database schema...');

    for (const table of requiredTables) {
      const exists = await db.tableExists(table);
      if (!exists) {
        logger.error(`Required table missing: ${table}`);
        return false;
      }
      logger.debug(`Table verified: ${table}`);
    }

    logger.info('Database schema verification passed');
    return true;
  } catch (error) {
    logger.error('Schema verification failed', { error: error.message });
    return false;
  }
}

/**
 * Seed initial data
 * @returns {Promise<void>}
 */
async function seedInitialData() {
  try {
    logger.info('Seeding initial data...');

    // Seed Ramadan dates for next few years
    const ramadanDates = [
      { year: 2025, start_date: '2025-02-28', end_date: '2025-03-29' },
      { year: 2026, start_date: '2026-02-17', end_date: '2026-03-18' },
      { year: 2027, start_date: '2027-02-06', end_date: '2027-03-07' },
      { year: 2028, start_date: '2028-01-26', end_date: '2028-02-24' },
      { year: 2029, start_date: '2029-01-15', end_date: '2029-02-13' },
    ];

    for (const ramadan of ramadanDates) {
      await db.query(
        `INSERT INTO ramadan_dates (year, start_date, end_date, notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (year) DO UPDATE
         SET start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date`,
        [ramadan.year, ramadan.start_date, ramadan.end_date, 'Automatically calculated']
      );
    }

    logger.info(`Seeded ${ramadanDates.length} Ramadan date entries`);

    // Seed common holidays for current year
    const currentYear = new Date().getFullYear();
    const commonHolidays = [
      {
        name: 'New Year',
        type: 'fixed',
        start: `${currentYear}-01-01`,
        end: `${currentYear}-01-01`,
      },
      {
        name: 'Eid al-Adha',
        type: 'islamic',
        start: `${currentYear}-06-15`,
        end: `${currentYear}-06-18`,
      },
      {
        name: 'Back to School',
        type: 'custom',
        start: `${currentYear}-08-15`,
        end: `${currentYear}-09-14`,
      },
    ];

    for (const holiday of commonHolidays) {
      await db.query(
        `INSERT INTO holidays (holiday_name, holiday_type, start_date, end_date, year, impact_multiplier)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (holiday_name, year, start_date) DO NOTHING`,
        [holiday.name, holiday.type, holiday.start, holiday.end, currentYear, 1.2]
      );
    }

    logger.info(`Seeded ${commonHolidays.length} holiday entries`);
    logger.info('Initial data seeding completed');
  } catch (error) {
    logger.error('Failed to seed initial data', { error: error.message });
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  (async () => {
    try {
      await runMigration();
      await seedInitialData();
      await verifySchema();

      logger.info('Database setup completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Database setup failed', { error: error.message });
      process.exit(1);
    } finally {
      await db.closePool();
    }
  })();
}

module.exports = {
  runMigration,
  verifySchema,
  seedInitialData,
};

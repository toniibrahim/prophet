/**
 * PostgreSQL Database Connection
 * Manages database connection pool and provides query interface
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;

/**
 * Database configuration from environment
 */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'prophet_forecast',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Maximum pool size
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
};

/**
 * Initialize database connection pool
 * @returns {Pool}
 */
function initializePool() {
  if (pool) {
    return pool;
  }

  logger.info('Initializing PostgreSQL connection pool...', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
  });

  pool = new Pool(dbConfig);

  // Handle pool errors
  pool.on('error', (err, client) => {
    logger.error('Unexpected error on idle database client', err);
  });

  pool.on('connect', () => {
    logger.debug('New database client connected to pool');
  });

  pool.on('remove', () => {
    logger.debug('Database client removed from pool');
  });

  return pool;
}

/**
 * Get database connection pool
 * @returns {Pool}
 */
function getPool() {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>}
 */
async function query(text, params = []) {
  const start = Date.now();
  const pool = getPool();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Executed query', {
      duration,
      rows: result.rowCount,
      query: text.substring(0, 100), // Log first 100 chars
    });

    return result;
  } catch (error) {
    logger.error('Database query error', {
      error: error.message,
      query: text.substring(0, 100),
      params,
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<PoolClient>}
 */
async function getClient() {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Execute queries in a transaction
 * @param {Function} callback - Function that receives client and executes queries
 * @returns {Promise<any>}
 */
async function transaction(callback) {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT NOW() as current_time, version() as version');
    logger.info('Database connection successful', {
      time: result.rows[0].current_time,
      version: result.rows[0].version.split(',')[0],
    });
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error: error.message });
    return false;
  }
}

/**
 * Close all database connections
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    logger.info('Closing database connection pool...');
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

/**
 * Execute SQL file (for migrations)
 * @param {string} sqlContent - SQL file content
 * @returns {Promise<void>}
 */
async function executeSqlFile(sqlContent) {
  const pool = getPool();

  try {
    logger.info('Executing SQL script...');
    await pool.query(sqlContent);
    logger.info('SQL script executed successfully');
  } catch (error) {
    logger.error('Failed to execute SQL script', { error: error.message });
    throw error;
  }
}

/**
 * Check if a table exists
 * @param {string} tableName
 * @returns {Promise<boolean>}
 */
async function tableExists(tableName) {
  const result = await query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

/**
 * Get database statistics
 * @returns {Promise<Object>}
 */
async function getStats() {
  try {
    const tables = [
      'sales_data',
      'returns_data',
      'import_log',
      'holidays',
      'ramadan_dates',
      'promotions',
    ];

    const stats = {};
    for (const table of tables) {
      const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = parseInt(result.rows[0].count, 10);
    }

    return stats;
  } catch (error) {
    logger.error('Failed to get database stats', { error: error.message });
    return {};
  }
}

module.exports = {
  initializePool,
  getPool,
  query,
  getClient,
  transaction,
  testConnection,
  closePool,
  executeSqlFile,
  tableExists,
  getStats,
};

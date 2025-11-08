/**
 * Express Web Server for Admin Interface
 * Provides UI for managing holidays, Ramadan dates, and promotions
 */

const express = require('express');
const path = require('path');
const db = require('../database/connection');
const holidayRepository = require('../database/repositories/holidayRepository');
const importLogRepository = require('../database/repositories/importLogRepository');
const logger = require('../utils/logger');

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', async (req, res) => {
  try {
    const dbConnected = await db.testConnection();
    const stats = await db.getStats();

    res.json({
      status: 'ok',
      database: dbConnected ? 'connected' : 'disconnected',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

// ============================================================
// HOLIDAYS API
// ============================================================

// Get all holidays
app.get('/api/holidays', async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const holidays = await holidayRepository.getAllHolidays(year);
    res.json(holidays);
  } catch (error) {
    logger.error('Failed to get holidays', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get holiday by ID
app.get('/api/holidays/:id', async (req, res) => {
  try {
    const holiday = await holidayRepository.getHolidayById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found' });
    }
    res.json(holiday);
  } catch (error) {
    logger.error('Failed to get holiday', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Create holiday
app.post('/api/holidays', async (req, res) => {
  try {
    const holiday = await holidayRepository.createHoliday(req.body);
    res.status(201).json(holiday);
  } catch (error) {
    logger.error('Failed to create holiday', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Update holiday
app.put('/api/holidays/:id', async (req, res) => {
  try {
    const holiday = await holidayRepository.updateHoliday(req.params.id, req.body);
    res.json(holiday);
  } catch (error) {
    logger.error('Failed to update holiday', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete holiday
app.delete('/api/holidays/:id', async (req, res) => {
  try {
    await holidayRepository.deleteHoliday(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete holiday', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// RAMADAN DATES API
// ============================================================

// Get all Ramadan dates
app.get('/api/ramadan', async (req, res) => {
  try {
    const ramadanDates = await holidayRepository.getAllRamadanDates();
    res.json(ramadanDates);
  } catch (error) {
    logger.error('Failed to get Ramadan dates', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get Ramadan dates by year
app.get('/api/ramadan/:year', async (req, res) => {
  try {
    const ramadan = await holidayRepository.getRamadanByYear(req.params.year);
    if (!ramadan) {
      return res.status(404).json({ error: 'Ramadan dates not found for this year' });
    }
    res.json(ramadan);
  } catch (error) {
    logger.error('Failed to get Ramadan dates', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Create or update Ramadan dates
app.post('/api/ramadan', async (req, res) => {
  try {
    const ramadan = await holidayRepository.upsertRamadanDates(req.body);
    res.json(ramadan);
  } catch (error) {
    logger.error('Failed to upsert Ramadan dates', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete Ramadan dates
app.delete('/api/ramadan/:year', async (req, res) => {
  try {
    await holidayRepository.deleteRamadanDates(req.params.year);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete Ramadan dates', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PROMOTIONS API
// ============================================================

// Get all promotions
app.get('/api/promotions', async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const promotions = await holidayRepository.getAllPromotions(year);
    res.json(promotions);
  } catch (error) {
    logger.error('Failed to get promotions', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get promotion by ID
app.get('/api/promotions/:id', async (req, res) => {
  try {
    const promotion = await holidayRepository.getPromotionById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }
    res.json(promotion);
  } catch (error) {
    logger.error('Failed to get promotion', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Create promotion
app.post('/api/promotions', async (req, res) => {
  try {
    const promotion = await holidayRepository.createPromotion(req.body);
    res.status(201).json(promotion);
  } catch (error) {
    logger.error('Failed to create promotion', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Update promotion
app.put('/api/promotions/:id', async (req, res) => {
  try {
    const promotion = await holidayRepository.updatePromotion(req.params.id, req.body);
    res.json(promotion);
  } catch (error) {
    logger.error('Failed to update promotion', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete promotion
app.delete('/api/promotions/:id', async (req, res) => {
  try {
    await holidayRepository.deletePromotion(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete promotion', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// IMPORT LOG API
// ============================================================

// Get all import logs
app.get('/api/imports', async (req, res) => {
  try {
    const imports = await importLogRepository.getAllImportLogs();
    res.json(imports);
  } catch (error) {
    logger.error('Failed to get import logs', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get failed imports
app.get('/api/imports/failed', async (req, res) => {
  try {
    const failed = await importLogRepository.getFailedImports();
    res.json(failed);
  } catch (error) {
    logger.error('Failed to get failed imports', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SERVE HTML PAGES
// ============================================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/holidays', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'holidays.html'));
});

app.get('/ramadan', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ramadan.html'));
});

app.get('/promotions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'promotions.html'));
});

app.get('/imports', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'imports.html'));
});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
  try {
    // Test database connection
    const connected = await db.testConnection();
    if (!connected) {
      logger.error('Failed to connect to database. Please check your database configuration.');
      process.exit(1);
    }

    app.listen(PORT, () => {
      logger.info(`Admin web server running on http://localhost:${PORT}`);
      logger.info('Available routes:');
      logger.info('  - / (Dashboard)');
      logger.info('  - /holidays (Holidays Management)');
      logger.info('  - /ramadan (Ramadan Dates Management)');
      logger.info('  - /promotions (Promotions Management)');
      logger.info('  - /imports (Import Status)');
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await db.closePool();
  process.exit(0);
});

// Start server if run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

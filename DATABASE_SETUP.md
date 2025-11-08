# Database Setup Guide

## Overview

This system now uses PostgreSQL to store sales data, holidays, Ramadan dates, and promotions. The database enables:

1. **Incremental Data Loading**: First run fetches 2 years of historical data, subsequent runs only fetch new data
2. **Persistent Storage**: All sales and returns data stored locally
3. **Admin Interface**: Web-based UI to manage holidays, Ramadan dates, and promotions
4. **Import Tracking**: Monitor data import status for each customer

## Prerequisites

- PostgreSQL 12 or higher installed
- Node.js 16 or higher
- Access to SAP B1 Service Layer

## Installation Steps

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**MacOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE prophet_forecast;

# Create user (optional, if not using postgres user)
CREATE USER prophet_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE prophet_forecast TO prophet_user;

# Exit
\q
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and update the database settings:

```env
# PostgreSQL Database Configuration
DB_ENABLED=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=prophet_forecast
DB_USER=postgres
DB_PASSWORD=your_database_password
DB_POOL_MAX=20

# Database Import Configuration
INITIAL_HISTORICAL_DAYS=730  # 2 years on first import
INCREMENTAL_FETCH_ENABLED=true

# Admin Web Interface
ADMIN_PORT=3000
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Database Migration

```bash
npm run migrate
```

This will:
- Create all necessary tables
- Set up indexes
- Seed initial Ramadan dates for 2025-2029
- Create sample holidays

### 6. Verify Database Setup

```bash
# Connect to database
psql -U postgres -d prophet_forecast

# Check tables
\dt

# You should see:
# - sales_data
# - returns_data
# - import_log
# - holidays
# - ramadan_dates
# - promotions
# - system_config
# - forecast_cache
```

## Database Schema

### Sales Data Tables

**sales_data** - Stores all sales transactions
- Indexed by customer_code, item_code, doc_date
- Unique constraint on (customer_code, item_code, doc_date, doc_num)

**returns_data** - Stores all return transactions
- Same structure as sales_data
- Tracks product returns separately

**import_log** - Tracks data import history
- One record per customer
- Stores last_import_date for incremental loading
- Tracks import status and errors

### Holiday & Events Tables

**holidays** - Store holidays by year
- Fields: holiday_name, holiday_type, start_date, end_date, year, impact_multiplier
- Types: fixed, islamic, custom

**ramadan_dates** - Ramadan dates by year
- One record per year
- Fields: year, start_date, end_date, notes

**promotions** - Marketing promotions
- Fields: promotion_name, start_date, end_date, discount_percentage, expected_uplift
- Can target specific items/customers using arrays

## Usage

### Running the Forecasting System

**First Time (Initial Import):**
```bash
npm start
```

The system will:
1. Fetch 2 years (730 days) of historical data from SAP B1
2. Store data in PostgreSQL
3. Create import log entry for each customer
4. Run forecasting on stored data

**Subsequent Runs (Incremental):**
```bash
npm start
```

The system will:
1. Check last import date for each customer
2. Only fetch data since last import
3. Update import log
4. Run forecasting on updated data

### Admin Web Interface

Start the admin server:
```bash
npm run admin
```

Access at: `http://localhost:3000`

**Features:**
- **Dashboard**: System status and database statistics
- **Holidays**: Manage holidays with impact multipliers
- **Ramadan**: Maintain Ramadan dates for multiple years
- **Promotions**: Track promotions with expected sales uplift
- **Import Status**: Monitor data import progress

### Manual Operations

**Run Migration Only:**
```bash
npm run migrate
```

**Force Full Reload for a Customer:**
```javascript
const dataLoader = require('./src/database/dataLoader');
await dataLoader.loadCustomerData('C00001', 'Customer Name', true);
```

**Check Import Status:**
```javascript
const importLog = require('./src/database/repositories/importLogRepository');
const status = await importLog.getAllImportLogs();
console.log(status);
```

## Incremental Loading Strategy

### First Import
- Fetches `INITIAL_HISTORICAL_DAYS` (default: 730 days / 2 years)
- Creates import log with `initial_import_date` and `last_import_date`
- Stores all sales and returns in database

### Subsequent Imports
- Checks `import_log` for `last_import_date`
- Only fetches data from `last_import_date + 1` to current date
- Updates import log with new `last_import_date`
- Appends new records to existing data

### Benefits
- **Faster**: Only fetches new data, not entire history
- **Efficient**: Reduces load on SAP B1 server
- **Scalable**: Works with large historical datasets
- **Reliable**: Tracks import status and errors

## Weekend Configuration

The system now uses **Friday and Saturday** as weekend days (instead of Saturday/Sunday). This is configured in `src/utils/dateHelpers.js:60-62`.

To change:
```javascript
function isWeekendDay(date) {
  const day = getDay(date);
  return day === 5 || day === 6; // Friday (5) and Saturday (6)
}
```

## Maintenance

### Backup Database

```bash
pg_dump -U postgres prophet_forecast > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
psql -U postgres prophet_forecast < backup_20250101.sql
```

### Clear Import Log (Force Re-import)

```sql
DELETE FROM import_log WHERE customer_code = 'C00001';
DELETE FROM sales_data WHERE customer_code = 'C00001';
DELETE FROM returns_data WHERE customer_code = 'C00001';
```

### Monitor Database Size

```sql
SELECT pg_size_pretty(pg_database_size('prophet_forecast'));
```

### View Table Sizes

```sql
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Troubleshooting

### Connection Errors

**Error:** "connection refused"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql
```

**Error:** "authentication failed"
- Check DB_USER and DB_PASSWORD in .env
- Verify user exists in PostgreSQL
- Check pg_hba.conf for authentication method

### Migration Errors

**Error:** "relation already exists"
- Tables already created
- Drop tables or skip migration

**Error:** "permission denied"
- Grant privileges to user:
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO prophet_user;
```

### Import Errors

Check import log for errors:
```sql
SELECT * FROM import_log WHERE import_status = 'failed';
```

View error message:
```sql
SELECT customer_code, error_message, updated_at
FROM import_log
WHERE import_status = 'failed'
ORDER BY updated_at DESC;
```

## Performance Optimization

### Index Optimization

The schema includes indexes on:
- `(customer_code, doc_date)` - For customer queries
- `(item_code, doc_date)` - For item queries
- `doc_date` - For date range queries

### Connection Pooling

Default pool size: 20 connections
Adjust in .env:
```env
DB_POOL_MAX=50
```

### Batch Inserts

The system uses bulk inserts for performance:
- Up to 1000 records per batch
- Transactions for data consistency
- Handles conflicts with UPSERT

## Next Steps

1. **Run Migration**: `npm run migrate`
2. **Configure SAP B1**: Update .env with SAP credentials
3. **Start Admin UI**: `npm run admin`
4. **Configure Holidays**: Add holidays via admin UI
5. **Run Forecaster**: `npm start`

## Support

For issues or questions:
- Check logs: `./logs/forecaster.log`
- Review import status in admin UI
- Check PostgreSQL logs: `/var/log/postgresql/`

## Architecture

```
┌─────────────────┐
│   SAP B1 API    │
└────────┬────────┘
         │ Initial: 730 days
         │ Incremental: New data only
         ↓
┌─────────────────┐
│  Data Loader    │
│  (Incremental)  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐       ┌──────────────┐
│   PostgreSQL    │◄──────┤  Admin UI    │
│   - Sales       │       │  (Express)   │
│   - Returns     │       │  Port: 3000  │
│   - Holidays    │       └──────────────┘
│   - Promotions  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Prophet Engine  │
│  (Forecasting)  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Order Proposals │
│  (SAP B1/Odoo)  │
└─────────────────┘
```

# SAP B1 Sales Forecasting & Order Proposal System

A comprehensive Node.js application that reads sales and returns data from SAP Business One, uses Facebook Prophet for advanced time series forecasting, and generates intelligent order proposals for credit customers.

## Features

### 🗄️ PostgreSQL Database Integration (NEW!)
- **Persistent Storage**: All sales and returns data stored locally in PostgreSQL
- **Incremental Loading**:
  - **First run**: Fetches 2 years (730 days) of historical data from SAP B1
  - **Subsequent runs**: Only fetches NEW data since last import
  - Dramatically reduces load on SAP B1 and speeds up processing
- **Import Tracking**: Monitor data import status for each customer
- **Scalable**: Handles large datasets efficiently with optimized indexes
- **See**: [DATABASE_SETUP.md](DATABASE_SETUP.md) for detailed setup guide

### 🎛️ Admin Web Interface (NEW!)
- **Dashboard**: System status and database statistics
- **Holidays Management**: Add, edit, delete holidays with impact multipliers
- **Ramadan Dates**: Maintain Ramadan dates for multiple years
- **Promotions**: Track marketing campaigns with expected sales uplift
- **Import Monitor**: Real-time data import status and error tracking
- **Responsive UI**: Clean, modern interface accessible at `http://localhost:3000`

### Advanced Forecasting
- **Prophet Integration**: Leverages Facebook's Prophet library for robust time series forecasting
- **Multi-factor Analysis**: Considers weekday/weekend patterns, holidays, special events, and historical trends
- **Confidence Intervals**: Provides prediction ranges with configurable confidence levels
- **Weekend Configuration**: Friday and Saturday configured as weekend days (customizable)

### Special Events Handling
- **Ramadan**: Automatic detection and adjustment for Ramadan period (database-managed)
- **Eid al-Adha**: Special handling for Eid holidays
- **Back to School**: Seasonal adjustments for back-to-school period
- **Custom Holidays**: Manage holidays via admin interface with impact multipliers
- **Promotions**: Track promotional campaigns with expected uplift

### Intelligent Business Logic
- **Stockout Detection**: Identifies potential stockouts (high sales with zero returns)
- **Overstock Prevention**: Detects overstocking (high return rates)
- **Dynamic Adjustments**: Automatically adjusts order quantities based on:
  - Recent sales trends
  - Return patterns
  - Special events
  - Safety stock requirements
- **Confidence Scoring**: Each forecast includes a confidence level

### Comprehensive Reporting
- **Excel Reports**: Professional Excel reports with multiple worksheets
- **Summary Dashboard**: Overall statistics and alerts
- **Detailed Analysis**: Item-by-item breakdown with adjustment reasons
- **Alert System**: Highlights high-priority items requiring attention
- **Customer-specific Reports**: Individual reports for each customer

### Odoo ERP Integration
- **Automatic Order Creation**: Sends forecasts directly to Odoo as sale orders
- **Salesman Assignment**: Orders automatically assigned to appropriate salesmen
- **Mobile VAN Support**: Creates transfer requests for delivery vehicles
- **Dual Output**: Get both Excel reports AND Odoo orders
- **Flexible**: Can be enabled/disabled as needed
- **Auto-Confirmation**: Optional automatic order confirmation
- **See**: [ODOO_INTEGRATION.md](ODOO_INTEGRATION.md) for setup guide

### Backtesting & Optimization
- **Historical Validation**: Test forecast accuracy against historical data
- **Parameter Tuning**: Optimize Prophet parameters automatically
- **Quick Tune Mode**: Fast parameter optimization
- **Performance Metrics**: RMSE, MAE, and MAPE metrics

### Automation
- **Scheduled Execution**: Automatic daily forecast generation
- **Configurable Schedule**: Set custom execution times
- **One-time Execution**: Run on-demand forecasts
- **Customer-specific Forecasts**: Generate forecasts for individual customers

## Architecture

```
┌─────────────────┐
│   SAP B1 API    │
└────────┬────────┘
         │ Initial: 730 days (2 years)
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
│   - Ramadan     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Data Processor  │
│ (Time Series,   │
│  Features)      │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Prophet Engine  │
│  (Python)       │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Order Proposal  │
│ Business Logic  │
└────────┬────────┘
         │
         ├─────────────────┬─────────────────┐
         ↓                 ↓                 ↓
┌─────────────────┐ ┌─────────────┐ ┌──────────────┐
│ Excel Reports   │ │  Odoo ERP   │ │ SAP B1 (opt) │
└─────────────────┘ └─────────────┘ └──────────────┘
```

## Prerequisites

- **Node.js**: Version 16.x or higher
- **Python**: Version 3.8 or higher
- **PostgreSQL**: Version 12 or higher (NEW!)
- **SAP Business One**: With Service Layer enabled
- **SAP B1 Credentials**: Valid user account with read access to:
  - Business Partners (OCRD)
  - Delivery Notes (ODLN, DLN1)
  - Returns (ORDN, RDN1)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd prophet
```

### 2. Install PostgreSQL

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

### 3. Create Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE prophet_forecast;

# Create user (optional)
CREATE USER prophet_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE prophet_forecast TO prophet_user;

# Exit
\q
```

### 4. Install Node.js Dependencies

```bash
npm install
```

### 5. Install Python Dependencies

```bash
pip3 install -r requirements.txt
```

Or using a virtual environment (recommended):

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 6. Configure Environment

Copy the example environment file and edit it:

```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Required SAP B1 configuration:**
```env
SAP_B1_SERVICE_LAYER_URL=https://your-server:50000/b1s/v1
SAP_B1_COMPANY_DB=SBODEMOUS
SAP_B1_USERNAME=manager
SAP_B1_PASSWORD=your_password
```

**Required PostgreSQL configuration:**
```env
DB_ENABLED=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=prophet_forecast
DB_USER=postgres
DB_PASSWORD=your_database_password

# Initial import fetches 2 years of historical data
INITIAL_HISTORICAL_DAYS=730

# Enable incremental loading
INCREMENTAL_FETCH_ENABLED=true
```

**Admin interface configuration:**
```env
ADMIN_PORT=3000
```

### 7. Run Database Migration

```bash
npm run migrate
```

This will:
- Create all necessary database tables
- Set up indexes for optimized queries
- Seed initial Ramadan dates (2025-2029)
- Create sample holidays
- Initialize system configuration

### 8. Verify Installation

```bash
npm test  # Run tests
python3 src/forecasting/prophetEngine.py --version  # Check Python setup
```

## Configuration

### SAP B1 Configuration

Edit `.env` file to configure SAP B1 connection:

- `SAP_B1_SERVICE_LAYER_URL`: Your SAP B1 Service Layer URL
- `SAP_B1_COMPANY_DB`: Company database name
- `SAP_B1_USERNAME`: SAP B1 username
- `SAP_B1_PASSWORD`: SAP B1 password

### Database Configuration

PostgreSQL settings in `.env`:

```env
DB_ENABLED=true                    # Enable database integration
DB_HOST=localhost                  # Database host
DB_PORT=5432                       # PostgreSQL port
DB_NAME=prophet_forecast           # Database name
DB_USER=postgres                   # Database user
DB_PASSWORD=your_password          # Database password
DB_POOL_MAX=20                     # Connection pool size

INITIAL_HISTORICAL_DAYS=730        # Days to fetch on first import (2 years)
INCREMENTAL_FETCH_ENABLED=true     # Enable incremental loading

ADMIN_PORT=3000                    # Admin web interface port
```

### Forecasting Parameters

Adjust forecasting behavior in `.env`:

```env
FORECAST_HORIZON_DAYS=2           # Forecast for day after tomorrow
HISTORICAL_DATA_DAYS=365          # Use 1 year for forecasting window
MIN_HISTORICAL_RECORDS=30         # Minimum data points required
CONFIDENCE_INTERVAL=0.95          # 95% confidence interval
```

### Prophet Model Parameters

Fine-tune Prophet model:

```env
PROPHET_CHANGEPOINT_PRIOR_SCALE=0.05    # Trend flexibility
PROPHET_SEASONALITY_PRIOR_SCALE=10      # Seasonality strength
PROPHET_HOLIDAYS_PRIOR_SCALE=10         # Holiday impact
PROPHET_SEASONALITY_MODE=multiplicative # Seasonality mode
PROPHET_WEEKLY_SEASONALITY=true         # Weekly patterns
PROPHET_YEARLY_SEASONALITY=true         # Yearly patterns
PROPHET_DAILY_SEASONALITY=false         # Daily patterns
```

### Business Logic Parameters

Fine-tune business rules:

```env
STOCKOUT_SALES_THRESHOLD=0.8      # Threshold for stockout detection
STOCKOUT_MULTIPLIER=1.3           # Increase by 30% for stockouts
OVERSTOCK_RETURN_THRESHOLD=0.15   # Return rate > 15% indicates overstock
OVERSTOCK_MULTIPLIER=0.7          # Decrease by 30% for overstock
SAFETY_STOCK_PERCENTAGE=0.1       # 10% safety stock
MIN_ORDER_QUANTITY=1              # Minimum order quantity
```

### Regional Settings

Configure timezone and locale:

```env
TIMEZONE=Asia/Riyadh              # Your timezone
LOCALE=en-US                      # Locale for formatting
```

**Weekend Configuration:**
The system uses **Friday and Saturday** as weekend days (not Saturday/Sunday). This is configured in `src/utils/dateHelpers.js` and can be changed if needed.

### Special Events

Configure special events via the **Admin Web Interface** or manually in `.env`:

```env
# Back to School
BACK_TO_SCHOOL_START_MONTH=8
BACK_TO_SCHOOL_START_DAY=15
BACK_TO_SCHOOL_DURATION_DAYS=30

# Ramadan (managed in database, optional manual override)
# RAMADAN_START_DATE=2025-03-01
# RAMADAN_END_DATE=2025-03-30

# Eid al-Adha (managed in database, optional manual override)
# EID_ADHA_START_DATE=2025-06-15
# EID_ADHA_DURATION_DAYS=4
```

### Scheduling

Configure automatic execution:

```env
FORECAST_GENERATION_TIME=06:00    # Run daily at 6:00 AM
ENABLE_SCHEDULER=true             # Enable automatic scheduling
```

## Usage

### Admin Web Interface

Start the admin server:

```bash
npm run admin
```

Access at: **http://localhost:3000**

**Features:**
- Dashboard with system status
- Manage holidays with impact multipliers
- Maintain Ramadan dates for multiple years
- Track promotions with expected uplift
- Monitor data import status

### First Time Setup

**Run the initial data import:**

```bash
npm start
```

On the first run, the system will:
1. Fetch 2 years (730 days) of historical data from SAP B1
2. Store all data in PostgreSQL database
3. Create import log entries for each customer
4. Run forecasting on the stored data
5. Generate Excel reports

This initial import may take some time depending on data volume.

### Scheduled Mode (Default)

Run the application in scheduled mode to automatically generate forecasts daily:

```bash
npm start
```

On subsequent runs, the system will:
1. Check the last import date for each customer
2. **Only fetch new data** since last import (much faster!)
3. Update the database with incremental data
4. Run forecasting on updated data
5. Generate reports

### One-time Forecast

Generate forecasts immediately for all customers:

```bash
npm run forecast
# or
npm start -- --forecast
```

### Customer-specific Forecast

Generate forecast for a specific customer:

```bash
npm start -- --customer C0001
```

### Backtesting

Test forecast accuracy against historical data:

```bash
npm run backtest
```

### Parameter Optimization

Optimize Prophet parameters automatically:

```bash
# Quick tune (faster)
npm run quick-tune

# Full parameter tuning (slower but more comprehensive)
npm run tune-params
```

### Development Mode

Run with auto-reload for development:

```bash
npm run dev
```

### Database Operations

**Run database migration:**
```bash
npm run migrate
```

**Force full reload for a customer:**
```javascript
const dataLoader = require('./src/database/dataLoader');
await dataLoader.loadCustomerData('C00001', 'Customer Name', true);
```

**Check database connection:**
```bash
psql -U postgres -d prophet_forecast -c "SELECT COUNT(*) FROM sales_data;"
```

## Output

### Excel Reports

Reports are generated in `./data/output/` directory:

#### Main Report (`order_proposals_YYYYMMDD_HHMMSS.xlsx`)

Contains multiple worksheets:

1. **Summary**: Overall statistics and customer summary table
2. **All Proposals**: Detailed proposals for all customers and items
3. **Alerts**: All alerts sorted by severity
4. **Customer Sheets**: Individual sheets for each customer (up to 20)

#### Individual Customer Reports

Separate Excel files for each customer: `CUSTOMER_CODE_YYYYMMDD.xlsx`

### Report Columns

**All Proposals Sheet:**
- Customer Code & Name
- Item Code & Description
- Delivery Date
- Proposed Quantity
- Base Forecast
- Adjustment Factor
- Confidence Level (%)
- Average Daily Sales
- Return Rate (%)
- Historical Sales & Returns
- Special Events
- Alerts
- Adjustment Reasons

### Logs

Logs are stored in `./logs/` directory:

- `forecaster.log`: All application logs
- `error.log`: Error logs only

## Database Schema

For detailed database schema information, see [DATABASE_SETUP.md](DATABASE_SETUP.md).

**Main Tables:**
- `sales_data` - All sales transactions
- `returns_data` - All return transactions
- `import_log` - Import tracking for incremental loading
- `holidays` - Holiday calendar with impact multipliers
- `ramadan_dates` - Ramadan periods by year
- `promotions` - Marketing promotions with expected uplift
- `system_config` - System-wide configuration
- `forecast_cache` - Optional forecast results caching

## Incremental Loading Strategy

### First Import
- Fetches **730 days (2 years)** of historical data from SAP B1
- Creates import log with `initial_import_date` and `last_import_date`
- Stores all sales and returns in PostgreSQL

### Subsequent Imports
- Checks `import_log` for `last_import_date`
- **Only fetches data** from `last_import_date + 1` to current date
- Updates import log with new `last_import_date`
- Appends new records to existing data

### Benefits
- ⚡ **Faster**: Only fetches new data, not entire history
- 🔧 **Efficient**: Reduces load on SAP B1 server
- 📈 **Scalable**: Works with large historical datasets
- 🛡️ **Reliable**: Tracks import status and errors

## Understanding the Output

### Adjustment Factors

The system applies various multipliers based on business logic:

- **Stockout (×1.3)**: High sales with zero returns
- **Overstock (×0.7)**: High return rate (>15%)
- **Increasing Trend (×1.1)**: Sales trending upward
- **Ramadan (×1.2)**: 20% increase during Ramadan
- **Eid al-Adha (×1.3)**: 30% increase during Eid
- **Back to School (×1.15)**: 15% increase
- **Promotions (variable)**: Based on expected uplift in database
- **Safety Stock (×1.1)**: 10% safety buffer

### Alert Types

**STOCKOUT_RISK (High Severity)**
- Customer likely facing inventory shortage
- Zero returns with high sales
- Action: Consider increasing delivery quantity

**OVERSTOCK_RISK (Medium Severity)**
- Customer may be overstocked
- High return rate (>15%)
- Action: Reduce delivery to prevent waste

**FORECAST_ANOMALY (Medium Severity)**
- Forecast anomaly detected
- Action: Manual review recommended

**LARGE_ORDER (Low Severity)**
- Proposed quantity significantly higher than average
- Action: Verify with customer

### Confidence Levels

- **80-100%**: High confidence - reliable forecast
- **60-79%**: Medium confidence - monitor closely
- **0-59%**: Low confidence - manual review recommended

## Customization

### Managing Holidays via Admin UI

Use the admin interface at `http://localhost:3000` to:
- Add/edit/delete holidays
- Set impact multipliers for forecasting
- Manage Ramadan dates for multiple years
- Track promotions with expected uplift

### Adding Holidays Programmatically

For advanced customization, edit `src/models/holidayCalendar.js`:

```javascript
function generateCustomHolidays(year) {
  const holidays = [];

  // Add your custom holiday
  const customDate = new Date(year, 5, 15); // June 15
  holidays.push({
    ds: dateHelpers.formatForSAP(customDate),
    holiday: 'custom_holiday',
    lower_window: 0,
    upper_window: 0,
  });

  return holidays;
}
```

### Changing Weekend Days

Edit `src/utils/dateHelpers.js` to customize weekend days:

```javascript
function isWeekendDay(date) {
  const day = getDay(date);
  return day === 5 || day === 6; // Friday (5) and Saturday (6)
  // Change to: day === 0 || day === 6 for Sunday (0) and Saturday (6)
}
```

### Modifying Business Rules

Edit `src/models/orderProposal.js` to customize business logic:

```javascript
function calculateAdjustmentFactor(pattern, forecast, targetDate) {
  let adjustmentFactor = 1.0;

  // Add your custom rules
  if (/* your condition */) {
    adjustmentFactor *= 1.2;
    reasons.push('Custom rule applied');
  }

  return { adjustmentFactor, reasons };
}
```

### Changing Report Format

Edit `src/reporting/excelReporter.js` to customize report layout and content.

## Troubleshooting

### Database Issues

**Error: Connection refused**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql
```

**Error: Authentication failed**
- Check DB_USER and DB_PASSWORD in .env
- Verify user exists in PostgreSQL
- Check pg_hba.conf for authentication method

**Error: Permission denied**
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
```

**Check import status:**
```sql
SELECT * FROM import_log WHERE import_status = 'failed';
```

### Connection Issues

**Error: Cannot connect to SAP B1**
- Verify Service Layer URL is correct
- Check network connectivity
- Ensure SSL certificates are valid (or disable SSL verification for testing)

**Error: Login failed**
- Verify credentials in `.env` file
- Check user has necessary permissions
- Verify company database name

### Python Issues

**Error: Prophet not found**
```bash
pip3 install prophet
```

**Error: Python3 not found**
- Ensure Python 3.8+ is installed
- Add Python to system PATH
- On Windows, use `python` instead of `python3`

### Data Issues

**Warning: No customer data found**
- Check customer group code in data reader
- Verify customers have sales/returns data in the historical period
- Adjust `INITIAL_HISTORICAL_DAYS` if needed

**Warning: Insufficient historical records**
- Reduce `MIN_HISTORICAL_RECORDS` in `.env`
- Increase `HISTORICAL_DATA_DAYS` to get more data

**First import taking too long:**
- Normal for first run (fetching 2 years of data)
- Reduce `INITIAL_HISTORICAL_DAYS` if needed
- Process customers in batches

### Memory Issues

For large datasets:
- Reduce `HISTORICAL_DATA_DAYS`
- Process customers in batches
- Increase Node.js memory limit: `NODE_OPTIONS=--max-old-space-size=4096 npm start`

### Admin Interface Issues

**Cannot access admin interface:**
```bash
# Check if server is running
npm run admin

# Check port availability
lsof -i :3000

# Change port in .env if needed
ADMIN_PORT=3001
```

## Performance Optimization

### Database Performance

**Optimize indexes:**
The schema includes optimized indexes on:
- `(customer_code, doc_date)` - For customer queries
- `(item_code, doc_date)` - For item queries
- `doc_date` - For date range queries

**Connection pooling:**
Adjust pool size in .env:
```env
DB_POOL_MAX=50
```

**Vacuum database regularly:**
```bash
psql -U postgres -d prophet_forecast -c "VACUUM ANALYZE;"
```

### For Large Deployments

1. **Database Indexing**: Ensure PostgreSQL indexes are created (done automatically)
2. **Connection Pooling**: Adjust DB_POOL_MAX based on concurrent users
3. **Batch Processing**: System automatically uses bulk inserts
4. **Incremental Loading**: Enabled by default to reduce SAP B1 load

### Recommended Settings

**Small deployment (< 100 customers):**
```env
INITIAL_HISTORICAL_DAYS=730
HISTORICAL_DATA_DAYS=365
MIN_HISTORICAL_RECORDS=30
DB_POOL_MAX=20
```

**Medium deployment (100-500 customers):**
```env
INITIAL_HISTORICAL_DAYS=365
HISTORICAL_DATA_DAYS=180
MIN_HISTORICAL_RECORDS=20
DB_POOL_MAX=50
```

**Large deployment (> 500 customers):**
```env
INITIAL_HISTORICAL_DAYS=180
HISTORICAL_DATA_DAYS=90
MIN_HISTORICAL_RECORDS=15
DB_POOL_MAX=100
```

## Best Practices

1. **Initial Setup**: Run database migration before first use
2. **Daily Execution**: Run forecasts daily for up-to-date predictions
3. **Review Alerts**: Always check high-severity alerts before placing orders
4. **Monitor Confidence**: Review items with low confidence manually
5. **Historical Data**: System maintains all historical data automatically
6. **Backup Database**: Regular PostgreSQL backups recommended
7. **Admin Interface**: Use web interface to manage holidays and promotions
8. **Import Monitoring**: Check import status regularly via admin UI
9. **Incremental Loading**: Trust the system - it only fetches new data
10. **Customer Feedback**: Regularly validate forecasts with customer feedback

## Database Maintenance

### Backup Database

```bash
# Full backup
pg_dump -U postgres prophet_forecast > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U postgres prophet_forecast < backup_20250101.sql
```

### Monitor Database Size

```sql
SELECT pg_size_pretty(pg_database_size('prophet_forecast'));
```

### View Table Sizes

```sql
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Clear Import Log (Force Re-import)

```sql
DELETE FROM import_log WHERE customer_code = 'C00001';
DELETE FROM sales_data WHERE customer_code = 'C00001';
DELETE FROM returns_data WHERE customer_code = 'C00001';
```

## Security

- Store `.env` file securely and never commit to version control
- Use read-only SAP B1 credentials when possible
- Rotate passwords regularly
- Secure PostgreSQL with strong passwords
- Restrict database access to localhost (or use firewall)
- Restrict file system access to output directory
- Enable SAP B1 SSL/TLS for production environments
- Use HTTPS for admin interface in production
- Regular security updates for PostgreSQL and Node.js

## Support

For issues, questions, or feature requests:
1. Check the troubleshooting section
2. Review [DATABASE_SETUP.md](DATABASE_SETUP.md) for database-specific issues
3. Review logs in `./logs/` directory
4. Check import status in admin UI
5. Enable debug logging: `LOG_LEVEL=debug`

## License

MIT

## Credits

- **Facebook Prophet**: Time series forecasting
- **SAP Business One**: ERP integration
- **PostgreSQL**: Database management
- **Express.js**: Web server for admin interface
- **SheetJS**: Excel file generation

---

**Version**: 2.0.0
**Last Updated**: November 2025
**Major Features**: PostgreSQL integration, Incremental loading, Admin web interface

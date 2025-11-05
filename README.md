# SAP B1 Sales Forecasting & Order Proposal System

A comprehensive Node.js application that reads sales and returns data from SAP Business One, uses Facebook Prophet for advanced time series forecasting, and generates intelligent order proposals for credit customers.

## Features

### Advanced Forecasting
- **Prophet Integration**: Leverages Facebook's Prophet library for robust time series forecasting
- **Multi-factor Analysis**: Considers weekday/weekend patterns, holidays, special events, and historical trends
- **Confidence Intervals**: Provides prediction ranges with configurable confidence levels

### Special Events Handling
- **Ramadan**: Automatic detection and adjustment for Ramadan period
- **Eid al-Adha**: Special handling for Eid holidays
- **Back to School**: Seasonal adjustments for back-to-school period
- **Custom Holidays**: Easy configuration for additional holidays and promotions

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

### Odoo ERP Integration (NEW!)
- **Automatic Order Creation**: Sends forecasts directly to Odoo as sale orders
- **Salesman Assignment**: Orders automatically assigned to appropriate salesmen
- **Mobile VAN Support**: Creates transfer requests for delivery vehicles
- **Dual Output**: Get both Excel reports AND Odoo orders
- **Flexible**: Can be enabled/disabled as needed
- **Auto-Confirmation**: Optional automatic order confirmation
- **See**: [ODOO_INTEGRATION.md](ODOO_INTEGRATION.md) for setup guide

### Automation
- **Scheduled Execution**: Automatic daily forecast generation
- **Configurable Schedule**: Set custom execution times
- **One-time Execution**: Run on-demand forecasts
- **Customer-specific Forecasts**: Generate forecasts for individual customers

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SAP B1 Service Layer                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Reader Module                       │
│         (Sales Documents & Returns Documents)               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Data Preprocessing Module                   │
│    (Aggregation, Time Series Creation, Feature Eng.)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Prophet Forecasting Engine (Python)            │
│     (Time Series Forecasting with Custom Regressors)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               Order Proposal Business Logic                 │
│  (Stockout/Overstock Detection, Dynamic Adjustments)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Excel Report Generator                    │
│            (Comprehensive Reports & Dashboards)             │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js**: Version 16.x or higher
- **Python**: Version 3.8 or higher
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

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Install Python Dependencies

```bash
pip3 install -r requirements.txt
```

Or using a virtual environment (recommended):

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Configure Environment

Copy the example environment file and edit it with your SAP B1 credentials:

```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

Required configuration:
```env
SAP_B1_SERVICE_LAYER_URL=https://your-server:50000/b1s/v1
SAP_B1_COMPANY_DB=SBODEMOUS
SAP_B1_USERNAME=manager
SAP_B1_PASSWORD=your_password
```

### 5. Verify Installation

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

### Forecasting Parameters

Adjust forecasting behavior in `.env`:

```env
FORECAST_HORIZON_DAYS=2           # Forecast for day after tomorrow
HISTORICAL_DATA_DAYS=365          # Use 1 year of historical data
MIN_HISTORICAL_RECORDS=30         # Minimum data points required
CONFIDENCE_INTERVAL=0.95          # 95% confidence interval
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

### Special Events

Configure special events and holidays:

```env
# Back to School
BACK_TO_SCHOOL_START_MONTH=8
BACK_TO_SCHOOL_START_DAY=15
BACK_TO_SCHOOL_DURATION_DAYS=30

# Ramadan (optional manual override)
# RAMADAN_START_DATE=2025-03-01
# RAMADAN_END_DATE=2025-03-30

# Eid al-Adha (optional manual override)
# EID_ADHA_START_DATE=2025-06-15
# EID_ADHA_DURATION_DAYS=4
```

### Scheduling

Configure automatic execution:

```env
FORECAST_GENERATION_TIME=06:00    # Run daily at 6:00 AM
ENABLE_SCHEDULER=true             # Enable automatic scheduling
TIMEZONE=Asia/Riyadh              # Your timezone
```

## Usage

### Scheduled Mode (Default)

Run the application in scheduled mode to automatically generate forecasts daily:

```bash
npm start
```

The system will run forecasting at the configured time each day.

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

### Development Mode

Run with auto-reload for development:

```bash
npm run dev
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

## Understanding the Output

### Adjustment Factors

The system applies various multipliers based on business logic:

- **Stockout (×1.3)**: High sales with zero returns
- **Overstock (×0.7)**: High return rate (>15%)
- **Increasing Trend (×1.1)**: Sales trending upward
- **Ramadan (×1.2)**: 20% increase during Ramadan
- **Eid al-Adha (×1.3)**: 30% increase during Eid
- **Back to School (×1.15)**: 15% increase
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

### Adding Custom Holidays

Edit `src/models/holidayCalendar.js` to add custom holidays:

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
- Check customer group code in `src/services/sapB1DataReader.js`
- Verify customers have sales/returns data in the historical period
- Adjust `HISTORICAL_DATA_DAYS` if needed

**Warning: Insufficient historical records**
- Reduce `MIN_HISTORICAL_RECORDS` in `.env`
- Increase `HISTORICAL_DATA_DAYS` to get more data

### Memory Issues

For large datasets:
- Reduce `HISTORICAL_DATA_DAYS`
- Process customers in batches
- Increase Node.js memory limit: `NODE_OPTIONS=--max-old-space-size=4096 npm start`

## Performance Optimization

### For Large Deployments

1. **Parallel Processing**: Modify orchestrator to process customers in parallel
2. **Database Indexing**: Ensure SAP B1 has proper indexes on DocDate, CardCode
3. **Caching**: Implement caching for holiday calendars and configurations
4. **Batch Processing**: Process customers in batches to reduce memory usage

### Recommended Settings

**Small deployment (< 100 customers):**
```env
HISTORICAL_DATA_DAYS=365
MIN_HISTORICAL_RECORDS=30
```

**Medium deployment (100-500 customers):**
```env
HISTORICAL_DATA_DAYS=180
MIN_HISTORICAL_RECORDS=20
```

**Large deployment (> 500 customers):**
```env
HISTORICAL_DATA_DAYS=90
MIN_HISTORICAL_RECORDS=15
```

## Best Practices

1. **Daily Execution**: Run forecasts daily for up-to-date predictions
2. **Review Alerts**: Always check high-severity alerts before placing orders
3. **Monitor Confidence**: Review items with low confidence manually
4. **Historical Data**: Maintain at least 90 days of historical data
5. **Backup Reports**: Archive generated reports for trend analysis
6. **Customer Feedback**: Regularly validate forecasts with customer feedback

## Security

- Store `.env` file securely and never commit to version control
- Use read-only SAP B1 credentials when possible
- Rotate passwords regularly
- Restrict file system access to output directory
- Enable SAP B1 SSL/TLS for production environments

## Support

For issues, questions, or feature requests:
1. Check the troubleshooting section
2. Review logs in `./logs/` directory
3. Enable debug logging: `LOG_LEVEL=debug`

## License

MIT

## Credits

- **Facebook Prophet**: Time series forecasting
- **SAP Business One**: ERP integration
- **SheetJS**: Excel file generation

---

**Version**: 1.0.0
**Last Updated**: November 2025

# Quick Start Guide

Get up and running with SAP B1 Sales Forecasting in 5 minutes!

## Prerequisites

- Node.js 16+ installed
- Python 3.8+ installed
- Access to SAP B1 Service Layer
- SAP B1 credentials

## Installation (5 steps)

### 1. Install Dependencies

```bash
# Install Node.js packages
npm install

# Install Python packages
pip3 install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit with your SAP B1 credentials
nano .env
```

**Required settings:**
```env
SAP_B1_SERVICE_LAYER_URL=https://your-server:50000/b1s/v1
SAP_B1_COMPANY_DB=SBODEMOUS
SAP_B1_USERNAME=your_username
SAP_B1_PASSWORD=your_password
```

### 3. Verify Setup

```bash
# Test Python Prophet
echo '{"data":[{"ds":"2024-01-01","y":10}],"config":{"horizon_days":1}}' | python3 src/forecasting/prophetEngine.py
```

Should output JSON with forecast results.

### 4. Run First Forecast

```bash
# Run forecast for all customers
npm run forecast
```

### 5. Check Results

```bash
# Find generated Excel report
ls -la data/output/

# View logs
cat logs/forecaster.log
```

## Daily Usage

### Scheduled Mode

Run automatically every day at configured time:

```bash
npm start
```

### Manual Forecast

Generate forecast on-demand:

```bash
npm run forecast
```

### Customer-Specific

Forecast for one customer:

```bash
npm start -- --customer C0001
```

## Understanding Results

Open the Excel file in `data/output/` directory.

### Key Worksheets

1. **Summary** - Overview and statistics
2. **All Proposals** - Detailed order proposals
3. **Alerts** - Items requiring attention

### Important Columns

- **Proposed Quantity** - Recommended order quantity
- **Confidence Level** - Forecast reliability (higher is better)
- **Alerts** - Stockout/overstock warnings
- **Adjustment Reasons** - Why the quantity was adjusted

### Alert Types

- 🔴 **STOCKOUT_RISK** - Customer may run out of stock
- 🟡 **OVERSTOCK_RISK** - Customer may be overstocked
- 🟢 **LARGE_ORDER** - Unusually large order detected

## Common Adjustments

### Change Forecast Date

Edit `.env`:
```env
FORECAST_HORIZON_DAYS=3  # Forecast 3 days ahead
```

### Change Historical Period

```env
HISTORICAL_DATA_DAYS=180  # Use 6 months of data
```

### Adjust Business Rules

```env
STOCKOUT_MULTIPLIER=1.5      # Increase by 50% for stockouts
OVERSTOCK_MULTIPLIER=0.6     # Decrease by 40% for overstock
SAFETY_STOCK_PERCENTAGE=0.15 # 15% safety stock
```

### Configure Special Events

```env
# Ramadan dates (optional)
RAMADAN_START_DATE=2025-03-01
RAMADAN_END_DATE=2025-03-30

# Back to school
BACK_TO_SCHOOL_START_MONTH=8
BACK_TO_SCHOOL_START_DAY=20
```

## Troubleshooting

### Can't connect to SAP B1?

Check:
1. Service Layer URL is correct
2. Username/password are correct
3. Network can reach SAP server
4. Service Layer is running

### No forecasts generated?

Check:
1. Customers have historical sales data
2. `MIN_HISTORICAL_RECORDS` is not too high
3. Customer group code filter in `sapB1DataReader.js`

### Python errors?

```bash
# Reinstall Python packages
pip3 install --upgrade -r requirements.txt

# Use virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Next Steps

1. ✅ Review first forecast results
2. ✅ Adjust business parameters if needed
3. ✅ Configure special events (Ramadan, Eid, etc.)
4. ✅ Set up daily scheduled execution
5. ✅ Create backup process for reports

## Getting Help

- 📖 Full documentation: [README.md](README.md)
- 🔧 Installation guide: [INSTALLATION.md](INSTALLATION.md)
- 📝 Check logs: `logs/forecaster.log`
- 🐛 Enable debug mode: `LOG_LEVEL=debug`

## Example Workflow

```bash
# Morning: Review yesterday's forecast
ls -la data/output/
open data/output/order_proposals_*.xlsx

# Adjust parameters if needed
nano .env

# Run new forecast
npm run forecast

# Review alerts
# Look at "Alerts" worksheet for high-priority items

# Place orders based on proposals
# Export to SAP or use as reference

# Evening: System runs automatically at scheduled time
npm start
```

## Tips

💡 **Start small**: Test with one customer first
💡 **Monitor closely**: Review first week of forecasts carefully
💡 **Adjust parameters**: Fine-tune based on results
💡 **Check alerts**: Always review high-severity alerts
💡 **Backup reports**: Keep historical reports for analysis
💡 **Customer feedback**: Validate with actual customer needs

---

Happy forecasting! 🎯📊

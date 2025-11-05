# Simulation and Parameter Optimization Guide

This guide explains how to use the backtesting and parameter tuning features to optimize your forecast accuracy.

## Table of Contents

1. [Overview](#overview)
2. [Backtesting](#backtesting)
3. [Parameter Tuning](#parameter-tuning)
4. [Understanding Metrics](#understanding-metrics)
5. [Best Practices](#best-practices)
6. [Examples](#examples)

## Overview

The simulation system allows you to:
- **Test forecast accuracy** against historical data
- **Compare** base Prophet forecasts vs. adjusted forecasts (with business logic)
- **Find optimal parameters** through automated testing
- **Validate** stockout/overstock detection accuracy
- **Improve** forecasting performance

### Key Features

✅ **Backtesting**: Simulate forecasts for past weeks and compare to actual sales
✅ **Accuracy Metrics**: MAPE, MAE, RMSE, R-squared, and more
✅ **Parameter Optimization**: Automated grid search to find best settings
✅ **Detection Validation**: Confusion matrices for stockout/overstock detection
✅ **Excel Reports**: Detailed reports with all results

## Backtesting

Backtesting simulates historical forecasts by:
1. Going back N weeks in time
2. Using only data available at that time
3. Generating a forecast
4. Comparing forecast to actual sales

### Running Backtest

#### Backtest All Customers (4 weeks)

```bash
npm run backtest
# or
npm start -- --backtest
```

#### Backtest with Custom Number of Weeks

```bash
npm start -- --backtest --weeks 8
```

#### Backtest Specific Customer

```bash
npm start -- --backtest --customer C0001 --weeks 4
```

### Backtest Reports

Generated Excel files contain:

#### 1. Summary Sheet
- Overall metrics (Base vs Adjusted)
- Improvement statistics
- Stockout/Overstock detection accuracy

#### 2. Item Details Sheet
- Per-item accuracy metrics
- MAPE, MAE, RMSE for each item
- Quality classification (Excellent/Good/Acceptable/Poor)

#### 3. Weekly Details Sheet
- Week-by-week comparison
- Actual vs Forecast vs Proposed
- Errors and adjustments
- Stockout/Overstock predictions

#### 4. Detection Accuracy Sheet
- Confusion matrices
- Precision and Recall
- True/False Positives/Negatives

### Example Output

```
SAP B1 Sales Forecasting - Backtesting Mode
================================================================================
Weeks to test: 4
This will simulate historical forecasts and compare to actual sales.
================================================================================

Fetching historical data...
✓ Fetched data for 25 customers
✓ Prepared data for 25 customers

Running backtest for all 25 customers...

================================================================================
✓ Backtesting completed!
================================================================================
Customers: 25
Total items: 342
Weeks tested: 4
Overall Base MAPE: 23.45%
Overall Adjusted MAPE: 18.32%
Overall Improvement: 5.13%
Reports generated in: ./data/output
================================================================================
```

## Parameter Tuning

Parameter tuning finds the best configuration by testing multiple parameter combinations.

### Quick Tuning (Recommended First)

Tests a limited set of common parameter variations:

```bash
npm run quick-tune
# or
npm start -- --quick-tune --weeks 4
```

**Parameters tested:**
- Prophet: changepoint_prior_scale (2 values), seasonality_prior_scale (2 values)
- Business Logic: stockout_multiplier (3 values), overstock_multiplier (2 values), safety_stock (2 values)
- **Total combinations**: ~24

**Duration**: 10-30 minutes (depends on data size)

### Full Tuning (Comprehensive)

Tests all parameter combinations in the default grid:

```bash
npm run tune-params
# or
npm start -- --tune-params --weeks 4
```

**Parameters tested:**
- Prophet: changepoint_prior_scale (4 values), seasonality_prior_scale (4 values), holidays_prior_scale (4 values)
- Business Logic: stockout_multiplier (5 values), overstock_multiplier (5 values), safety_stock (4 values)
- **Total combinations**: 64 × 100 = **6,400 combinations**

**Duration**: Several hours to days (depends on data size)

### Tuning Reports

Generated Excel files contain:

#### 1. Summary Sheet
- Best configuration found
- Worst configuration (for comparison)
- Improvement statistics

#### 2. All Configurations Sheet
- Every tested combination
- Ranked by MAPE (best to worst)
- All parameter values

#### 3. Top 10 Sheet
- Detailed view of top 10 configurations
- Easy to compare best options

### Example Output

```bash
SAP B1 Sales Forecasting - Quick Parameter Tuning
================================================================================
Weeks to test: 4
This will test multiple parameter combinations to find the best settings.
================================================================================

Fetching historical data...
✓ Fetched data for 25 customers
✓ Prepared data for 25 customers

Testing parameter combinations (this may take a while)...

Testing combination 1/24: {...}
Result: avgMAPE = 19.23%
Testing combination 2/24: {...}
Result: avgMAPE = 18.45%
...

================================================================================
✓ Parameter tuning completed!
================================================================================
Combinations tested: 24
Successful tests: 24
Best MAPE: 17.32%
Worst MAPE: 24.56%
Improvement: 7.24%

Best Configuration:
{
  "prophet": {
    "changepointPriorScale": 0.1,
    "seasonalityPriorScale": 10,
    "holidaysPriorScale": 10
  },
  "businessLogic": {
    "stockoutMultiplier": 1.3,
    "overstockMultiplier": 0.7,
    "safetyStockPercentage": 0.15
  }
}

Report: ./data/output/parameter_tuning_20241105_143022.xlsx
================================================================================
```

## Understanding Metrics

### Accuracy Metrics

#### MAPE (Mean Absolute Percentage Error)
- **Most Important Metric**
- Measures average error as percentage of actual
- **Lower is better**
- Industry standards:
  - < 10%: Excellent
  - 10-20%: Good
  - 20-30%: Acceptable
  - 30-50%: Poor
  - > 50%: Very Poor

**Formula**: `Mean(|Actual - Forecast| / Actual) × 100`

#### MAE (Mean Absolute Error)
- Average absolute difference between actual and forecast
- **Lower is better**
- In same units as your sales data

**Formula**: `Mean(|Actual - Forecast|)`

#### RMSE (Root Mean Square Error)
- Emphasizes large errors more than MAE
- **Lower is better**
- Useful for detecting outliers

**Formula**: `√(Mean((Actual - Forecast)²))`

#### WAPE (Weighted Absolute Percentage Error)
- Better than MAPE when dealing with zeros
- **Lower is better**

**Formula**: `Sum(|Actual - Forecast|) / Sum(Actual) × 100`

#### R-squared (Coefficient of Determination)
- Measures how well forecast explains variance
- **Higher is better** (0 to 1)
- 1.0 = perfect forecast
- 0.5 = explains 50% of variance

#### Bias
- Average error (can be positive or negative)
- Positive = over-forecasting
- Negative = under-forecasting
- **Closer to 0 is better**

### Detection Metrics

#### Confusion Matrix

For Stockout Detection:
```
                    Actual Stockout    Actual No Stockout
Predicted Stockout        TP                   FP
Predicted No Stockout     FN                   TN
```

- **TP (True Positive)**: Correctly predicted stockout
- **FP (False Positive)**: Incorrectly predicted stockout
- **TN (True Negative)**: Correctly predicted no stockout
- **FN (False Negative)**: Missed stockout

#### Accuracy
Percentage of correct predictions

**Formula**: `(TP + TN) / Total × 100`

#### Precision
Of all predicted stockouts, how many were correct?

**Formula**: `TP / (TP + FP)`

#### Recall (Sensitivity)
Of all actual stockouts, how many did we catch?

**Formula**: `TP / (TP + FN)`

## Best Practices

### 1. Start with Quick Tuning

Always start with quick tuning to get a sense of improvement potential:

```bash
npm run quick-tune
```

### 2. Test on Representative Data

- Use at least **4 weeks** of backtesting
- Ensure data includes:
  - Normal periods
  - Special events (if possible)
  - Weekends
  - Various product types

### 3. Interpret Results

**Good Results:**
- MAPE < 20%
- Improvement > 3-5%
- Stockout detection accuracy > 70%
- Overstock detection accuracy > 60%

**Consider Re-tuning if:**
- MAPE > 30%
- Improvement < 2%
- Detection accuracy < 60%

### 4. Apply Best Configuration

After finding best parameters:

1. Open the tuning report Excel file
2. Copy the best configuration
3. Update your `.env` file:

```env
# Prophet Parameters
PROPHET_CHANGEPOINT_PRIOR_SCALE=0.1
PROPHET_SEASONALITY_PRIOR_SCALE=10
PROPHET_HOLIDAYS_PRIOR_SCALE=10

# Business Logic Parameters
STOCKOUT_MULTIPLIER=1.3
OVERSTOCK_MULTIPLIER=0.7
SAFETY_STOCK_PERCENTAGE=0.15
```

4. Run a new forecast to verify

### 5. Re-tune Periodically

Re-run parameter tuning:
- **Quarterly**: Business patterns change
- **Seasonally**: Adjust for season-specific patterns
- **After major events**: Ramadan, promotions, etc.

### 6. Validate Results

After applying new parameters:

```bash
# Run backtest to verify improvement
npm run backtest

# Run actual forecast
npm run forecast

# Compare results
```

## Examples

### Example 1: Find Best Configuration

```bash
# Step 1: Run quick tuning
npm run quick-tune

# Review report: parameter_tuning_YYYYMMDD_HHMMSS.xlsx
# Best MAPE found: 17.32%

# Step 2: Update .env with best config
nano .env

# Step 3: Verify with backtest
npm run backtest

# Step 4: Run production forecast
npm run forecast
```

### Example 2: Backtest Specific Customer

```bash
# Test forecast accuracy for customer C0001 over 8 weeks
npm start -- --backtest --customer C0001 --weeks 8

# Review report: backtest_C0001_YYYYMMDD_HHMMSS.xlsx
```

### Example 3: Comprehensive Optimization

```bash
# Week 1: Run quick tune to identify promising ranges
npm run quick-tune --weeks 4

# Week 2: If results promising, run full tune
npm run tune-params --weeks 6

# Week 3: Apply best config and backtest
# Update .env
npm run backtest --weeks 8

# Week 4: Deploy to production
npm run forecast
```

### Example 4: Troubleshoot Poor Accuracy

```bash
# Check current accuracy
npm run backtest

# If MAPE > 30%, try parameter tuning
npm run quick-tune

# If still poor, check:
# 1. Data quality (returns in sapB1DataReader.js)
# 2. Historical data period (HISTORICAL_DATA_DAYS in .env)
# 3. Minimum records (MIN_HISTORICAL_RECORDS in .env)

# Adjust and retest
npm run backtest
```

## Advanced Usage

### Custom Parameter Grid

Edit `src/simulation/parameterTuner.js` to define custom grid:

```javascript
const CUSTOM_GRID = {
  prophet: {
    changepointPriorScale: [0.08, 0.09, 0.1, 0.11, 0.12],
    seasonalityPriorScale: [8, 9, 10, 11, 12],
    holidaysPriorScale: [10], // Keep constant
  },
  businessLogic: {
    stockoutMultiplier: [1.25, 1.3, 1.35],
    overstockMultiplier: [0.65, 0.7, 0.75],
    safetyStockPercentage: [0.12, 0.15, 0.18],
  },
};
```

### Test Single Parameter

To test just one parameter:

```bash
# Edit src/simulation/parameterTuner.js
# Use testParameter() function

# Example: Test different safety stock values
const result = await parameterTuner.testParameter(
  customerData,
  'safetyStockPercentage',
  [0.05, 0.1, 0.15, 0.2, 0.25],
  4
);
```

## Troubleshooting

### Issue: "Insufficient historical records"

**Solution:**
```env
# Reduce minimum required records
MIN_HISTORICAL_RECORDS=15

# Or increase historical period
HISTORICAL_DATA_DAYS=730  # 2 years
```

### Issue: Tuning takes too long

**Solutions:**
1. Use quick-tune instead of full tune
2. Reduce number of weeks: `--weeks 2`
3. Test on subset of customers first
4. Reduce parameter grid size

### Issue: Poor accuracy even after tuning

**Check:**
1. Data quality - Are sales/returns accurate?
2. Customer group filter - Are you getting right customers?
3. Special events - Are dates configured correctly?
4. Item selection - MIN_HISTORICAL_RECORDS too low?

### Issue: High variance in results

This is normal for:
- Products with sporadic sales
- New products (< 3 months data)
- Seasonal products

**Solutions:**
- Increase historical data period
- Adjust MIN_HISTORICAL_RECORDS
- Consider product-specific parameters

## Performance Tips

### For Large Datasets

```bash
# Use fewer weeks for tuning
npm start -- --quick-tune --weeks 2

# Process customers in batches
# (requires code modification)

# Reduce parameter grid
# Edit src/simulation/parameterTuner.js
```

### For Small Datasets

```bash
# Use more weeks for better reliability
npm start -- --backtest --weeks 8

# Use finer parameter granularity
# Add more values to parameter grid
```

## Interpreting Results

### Excellent Results
- MAPE: < 15%
- Improvement: > 5%
- Detection Accuracy: > 80%

**Action**: Apply configuration immediately

### Good Results
- MAPE: 15-20%
- Improvement: 3-5%
- Detection Accuracy: 70-80%

**Action**: Apply configuration, monitor performance

### Acceptable Results
- MAPE: 20-30%
- Improvement: 1-3%
- Detection Accuracy: 60-70%

**Action**: Apply configuration, plan for re-tuning

### Poor Results
- MAPE: > 30%
- Improvement: < 1%
- Detection Accuracy: < 60%

**Action**:
1. Check data quality
2. Review business logic
3. Consider external factors not captured
4. May need custom modeling approach

## Summary

1. **Always start with backtesting** to understand current performance
2. **Use quick-tune first** to get quick wins
3. **Apply best configuration** to .env
4. **Verify with backtest** before production use
5. **Re-tune periodically** as patterns change

---

**Next Steps:**
- Run your first backtest: `npm run backtest`
- Review the generated report
- Try quick parameter tuning: `npm run quick-tune`
- Apply the best configuration
- Start generating accurate forecasts!

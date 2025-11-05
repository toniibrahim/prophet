#!/usr/bin/env python3
"""
Prophet Forecasting Engine
This script is called from Node.js to perform Prophet forecasting
"""

import sys
import json
import pandas as pd
import numpy as np
from prophet import Prophet
from datetime import datetime, timedelta
import warnings

warnings.filterwarnings('ignore')


def forecast_item(data, config, holidays=None):
    """
    Forecast sales for a single item using Prophet

    Args:
        data: List of dicts with keys: ds, y, and optional regressors
        config: Prophet configuration dict
        holidays: DataFrame with holiday information

    Returns:
        Dict with forecast results
    """
    try:
        # Create DataFrame
        df = pd.DataFrame(data)

        # Ensure ds is datetime
        df['ds'] = pd.to_datetime(df['ds'])

        # Ensure y is numeric and handle negatives (set to 0)
        df['y'] = pd.to_numeric(df['y'])
        df.loc[df['y'] < 0, 'y'] = 0

        # Initialize Prophet model
        model = Prophet(
            growth='linear',
            changepoint_prior_scale=config.get('changepoint_prior_scale', 0.05),
            seasonality_prior_scale=config.get('seasonality_prior_scale', 10),
            holidays_prior_scale=config.get('holidays_prior_scale', 10),
            seasonality_mode=config.get('seasonality_mode', 'multiplicative'),
            daily_seasonality=config.get('daily_seasonality', False),
            weekly_seasonality=config.get('weekly_seasonality', True),
            yearly_seasonality=config.get('yearly_seasonality', True),
            interval_width=config.get('confidence_interval', 0.95)
        )

        # Add holidays if provided
        if holidays is not None and not holidays.empty:
            model.holidays = holidays

        # Add custom regressors if present
        regressor_columns = [col for col in df.columns if col not in ['ds', 'y']]
        for regressor in regressor_columns:
            model.add_regressor(regressor)

        # Fit the model
        model.fit(df)

        # Create future dataframe
        horizon_days = config.get('horizon_days', 2)
        future = model.make_future_dataframe(periods=horizon_days, freq='D')

        # Add regressors to future dataframe
        if regressor_columns:
            # For future dates, we need to provide regressor values
            # We'll use the last known values or averages
            for regressor in regressor_columns:
                # For simplicity, use the mean of the last 7 days
                recent_mean = df[regressor].tail(7).mean()
                future[regressor] = recent_mean

        # Make prediction
        forecast = model.predict(future)

        # Extract forecast results
        # Get only future dates
        forecast_future = forecast[forecast['ds'] > df['ds'].max()]

        results = {
            'success': True,
            'forecast': forecast_future[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].to_dict('records'),
            'historical_fit': forecast[forecast['ds'] <= df['ds'].max()][['ds', 'yhat']].to_dict('records'),
            'components': {
                'trend': forecast_future['trend'].tolist(),
                'weekly': forecast_future['weekly'].tolist() if 'weekly' in forecast_future.columns else None,
                'yearly': forecast_future['yearly'].tolist() if 'yearly' in forecast_future.columns else None,
            }
        }

        # Convert timestamps to strings
        for item in results['forecast']:
            item['ds'] = item['ds'].strftime('%Y-%m-%d')
        for item in results['historical_fit']:
            item['ds'] = item['ds'].strftime('%Y-%m-%d')

        return results

    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def main():
    """
    Main entry point
    Expects JSON input from stdin with:
    - data: time series data
    - config: Prophet configuration
    - holidays: optional holidays dataframe
    """
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())

        data = input_data.get('data', [])
        config = input_data.get('config', {})
        holidays_data = input_data.get('holidays', None)

        # Convert holidays to DataFrame if provided
        holidays = None
        if holidays_data:
            holidays = pd.DataFrame(holidays_data)
            holidays['ds'] = pd.to_datetime(holidays['ds'])

        # Perform forecast
        result = forecast_item(data, config, holidays)

        # Output result as JSON
        print(json.dumps(result))

    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == '__main__':
    main()

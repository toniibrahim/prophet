-- PostgreSQL Database Schema for SAP B1 Sales Forecasting System
-- Version: 1.0
-- Created: 2025-11-08

-- ============================================================
-- SALES AND RETURNS DATA TABLES
-- ============================================================

-- Sales transactions table
CREATE TABLE IF NOT EXISTS sales_data (
    id SERIAL PRIMARY KEY,
    customer_code VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    item_code VARCHAR(50) NOT NULL,
    item_description VARCHAR(500),
    doc_date DATE NOT NULL,
    doc_num VARCHAR(50),
    quantity DECIMAL(18, 4) NOT NULL DEFAULT 0,
    line_total DECIMAL(18, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sales UNIQUE (customer_code, item_code, doc_date, doc_num)
);

CREATE INDEX idx_sales_customer_date ON sales_data(customer_code, doc_date);
CREATE INDEX idx_sales_item_date ON sales_data(item_code, doc_date);
CREATE INDEX idx_sales_doc_date ON sales_data(doc_date);

-- Returns transactions table
CREATE TABLE IF NOT EXISTS returns_data (
    id SERIAL PRIMARY KEY,
    customer_code VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    item_code VARCHAR(50) NOT NULL,
    item_description VARCHAR(500),
    doc_date DATE NOT NULL,
    doc_num VARCHAR(50),
    quantity DECIMAL(18, 4) NOT NULL DEFAULT 0,
    line_total DECIMAL(18, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_returns UNIQUE (customer_code, item_code, doc_date, doc_num)
);

CREATE INDEX idx_returns_customer_date ON returns_data(customer_code, doc_date);
CREATE INDEX idx_returns_item_date ON returns_data(item_code, doc_date);
CREATE INDEX idx_returns_doc_date ON returns_data(doc_date);

-- ============================================================
-- IMPORT TRACKING TABLE
-- ============================================================

-- Tracks the last import date for each customer
CREATE TABLE IF NOT EXISTS import_log (
    id SERIAL PRIMARY KEY,
    customer_code VARCHAR(50) NOT NULL UNIQUE,
    customer_name VARCHAR(255),
    last_import_date DATE NOT NULL,
    initial_import_date DATE NOT NULL,
    records_imported INTEGER DEFAULT 0,
    import_status VARCHAR(20) DEFAULT 'success', -- success, failed, in_progress
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_import_customer ON import_log(customer_code);

-- ============================================================
-- HOLIDAYS AND SPECIAL EVENTS TABLES
-- ============================================================

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    holiday_name VARCHAR(100) NOT NULL,
    holiday_type VARCHAR(50) NOT NULL, -- fixed, islamic, custom
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    year INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    impact_multiplier DECIMAL(5, 2) DEFAULT 1.0, -- Expected sales multiplier
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_holiday UNIQUE (holiday_name, year, start_date)
);

CREATE INDEX idx_holidays_date_range ON holidays(start_date, end_date);
CREATE INDEX idx_holidays_year ON holidays(year);
CREATE INDEX idx_holidays_type ON holidays(holiday_type);

-- Ramadan dates table
CREATE TABLE IF NOT EXISTS ramadan_dates (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ramadan_year ON ramadan_dates(year);

-- Promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    promotion_name VARCHAR(255) NOT NULL,
    promotion_type VARCHAR(50), -- seasonal, flash, clearance, etc.
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    year INTEGER NOT NULL,
    item_codes TEXT[], -- Array of item codes affected (NULL = all items)
    customer_codes TEXT[], -- Array of customer codes affected (NULL = all customers)
    discount_percentage DECIMAL(5, 2),
    expected_uplift DECIMAL(5, 2) DEFAULT 1.0, -- Expected sales multiplier
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promotions_date_range ON promotions(start_date, end_date);
CREATE INDEX idx_promotions_year ON promotions(year);
CREATE INDEX idx_promotions_active ON promotions(is_active);

-- ============================================================
-- FORECAST RESULTS CACHE TABLE (OPTIONAL)
-- ============================================================

-- Cache forecast results to avoid re-running forecasts
CREATE TABLE IF NOT EXISTS forecast_cache (
    id SERIAL PRIMARY KEY,
    customer_code VARCHAR(50) NOT NULL,
    item_code VARCHAR(50) NOT NULL,
    forecast_date DATE NOT NULL,
    forecast_value DECIMAL(18, 4),
    lower_bound DECIMAL(18, 4),
    upper_bound DECIMAL(18, 4),
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_forecast UNIQUE (customer_code, item_code, forecast_date, created_at)
);

CREATE INDEX idx_forecast_customer_item ON forecast_cache(customer_code, item_code);
CREATE INDEX idx_forecast_date ON forecast_cache(forecast_date);

-- ============================================================
-- SYSTEM CONFIGURATION TABLE
-- ============================================================

-- Store system-wide configuration
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configurations
INSERT INTO system_config (config_key, config_value, description) VALUES
    ('initial_historical_days', '730', 'Number of days to fetch on initial import (default 2 years)'),
    ('incremental_fetch_enabled', 'true', 'Enable incremental data fetching'),
    ('forecast_cache_enabled', 'false', 'Enable forecast result caching')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================
-- VIEWS FOR REPORTING
-- ============================================================

-- Aggregated sales view
CREATE OR REPLACE VIEW v_daily_sales_summary AS
SELECT
    customer_code,
    customer_name,
    item_code,
    item_description,
    doc_date,
    SUM(quantity) as total_quantity,
    SUM(line_total) as total_value,
    COUNT(*) as transaction_count
FROM sales_data
GROUP BY customer_code, customer_name, item_code, item_description, doc_date;

-- Aggregated returns view
CREATE OR REPLACE VIEW v_daily_returns_summary AS
SELECT
    customer_code,
    customer_name,
    item_code,
    item_description,
    doc_date,
    SUM(quantity) as total_quantity,
    SUM(line_total) as total_value,
    COUNT(*) as transaction_count
FROM returns_data
GROUP BY customer_code, customer_name, item_code, item_description, doc_date;

-- Net sales view (sales - returns)
CREATE OR REPLACE VIEW v_net_sales AS
SELECT
    COALESCE(s.customer_code, r.customer_code) as customer_code,
    COALESCE(s.customer_name, r.customer_name) as customer_name,
    COALESCE(s.item_code, r.item_code) as item_code,
    COALESCE(s.item_description, r.item_description) as item_description,
    COALESCE(s.doc_date, r.doc_date) as doc_date,
    COALESCE(s.total_quantity, 0) as sales_quantity,
    COALESCE(r.total_quantity, 0) as returns_quantity,
    COALESCE(s.total_quantity, 0) - COALESCE(r.total_quantity, 0) as net_quantity,
    COALESCE(s.total_value, 0) as sales_value,
    COALESCE(r.total_value, 0) as returns_value,
    COALESCE(s.total_value, 0) - COALESCE(r.total_value, 0) as net_value
FROM v_daily_sales_summary s
FULL OUTER JOIN v_daily_returns_summary r
    ON s.customer_code = r.customer_code
    AND s.item_code = r.item_code
    AND s.doc_date = r.doc_date;

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_sales_data_updated_at BEFORE UPDATE ON sales_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_returns_data_updated_at BEFORE UPDATE ON returns_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_import_log_updated_at BEFORE UPDATE ON import_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_holidays_updated_at BEFORE UPDATE ON holidays
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ramadan_dates_updated_at BEFORE UPDATE ON ramadan_dates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

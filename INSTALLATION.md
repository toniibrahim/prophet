# Installation and Setup Guide

This guide will walk you through the complete installation and setup process for the SAP B1 Sales Forecasting System.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installing Prerequisites](#installing-prerequisites)
3. [Application Setup](#application-setup)
4. [SAP B1 Configuration](#sap-b1-configuration)
5. [Testing the Installation](#testing-the-installation)
6. [Common Issues](#common-issues)

## System Requirements

### Hardware Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Storage: 10 GB free space

**Recommended:**
- CPU: 4+ cores
- RAM: 8+ GB
- Storage: 20+ GB free space

### Software Requirements

- **Operating System**: Linux, macOS, or Windows
- **Node.js**: Version 16.x or higher
- **Python**: Version 3.8 or higher
- **SAP Business One**: Version 9.3 or higher with Service Layer enabled
- **Network**: Access to SAP B1 Service Layer (HTTPS)

## Installing Prerequisites

### 1. Install Node.js

#### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### macOS
```bash
brew install node
```

#### Windows
Download and install from [nodejs.org](https://nodejs.org/)

Verify installation:
```bash
node --version  # Should show v16.x or higher
npm --version
```

### 2. Install Python

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv
```

#### macOS
```bash
brew install python3
```

#### Windows
Download and install from [python.org](https://www.python.org/)

Verify installation:
```bash
python3 --version  # Should show 3.8 or higher
pip3 --version
```

### 3. Install Git (if not already installed)

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install -y git
```

#### macOS
```bash
brew install git
```

#### Windows
Download and install from [git-scm.com](https://git-scm.com/)

## Application Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd prophet
```

### Step 2: Install Node.js Dependencies

```bash
npm install
```

This will install all required Node.js packages including:
- axios (SAP B1 API communication)
- winston (logging)
- xlsx (Excel generation)
- date-fns (date manipulation)
- node-schedule (scheduling)
- and more...

### Step 3: Install Python Dependencies

We recommend using a virtual environment:

#### Create Virtual Environment

```bash
python3 -m venv venv
```

#### Activate Virtual Environment

**Linux/macOS:**
```bash
source venv/bin/activate
```

**Windows:**
```cmd
venv\Scripts\activate
```

#### Install Python Packages

```bash
pip install -r requirements.txt
```

This installs:
- prophet (Facebook Prophet forecasting)
- pandas (data manipulation)
- numpy (numerical computations)

**Note:** Prophet installation may take several minutes as it compiles some components.

### Step 4: Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```bash
nano .env  # or use your preferred editor
```

**Required Configuration:**

```env
# SAP B1 Connection
SAP_B1_SERVICE_LAYER_URL=https://your-sap-server:50000/b1s/v1
SAP_B1_COMPANY_DB=SBODEMOUS
SAP_B1_USERNAME=your_username
SAP_B1_PASSWORD=your_password

# Adjust other settings as needed
```

### Step 5: Create Required Directories

Directories should already exist, but verify:

```bash
ls -la data/input data/output logs
```

If any are missing:

```bash
mkdir -p data/input data/output logs
```

### Step 6: Set Permissions (Linux/macOS)

Make the Python script executable:

```bash
chmod +x src/forecasting/prophetEngine.py
```

## SAP B1 Configuration

### 1. Enable Service Layer

Ensure SAP B1 Service Layer is installed and running:

1. Open SAP B1 Administration Console
2. Navigate to Service Layer configuration
3. Verify it's enabled on port 50000 (default)
4. Note the Service Layer URL

### 2. Create Service Account (Recommended)

For security, create a dedicated service account:

1. Open SAP B1 Administration
2. Go to User Management
3. Create new user: `svc_forecasting`
4. Grant permissions:
   - Read access to Business Partners (OCRD)
   - Read access to Delivery Notes (ODLN, DLN1)
   - Read access to Returns (ORDN, RDN1)
   - Read access to Items (OITM)

### 3. Configure Customer Groups

The system filters credit customers by GroupCode. Update the filter in `src/services/sapB1DataReader.js` if needed:

```javascript
// Line ~18 in sapB1DataReader.js
filter: "CardType eq 'C' and GroupCode eq 100", // Adjust GroupCode
```

### 4. Network Configuration

Ensure your server can reach SAP B1 Service Layer:

```bash
# Test connectivity
curl -k https://your-sap-server:50000/b1s/v1

# Or use telnet
telnet your-sap-server 50000
```

### 5. SSL Certificate (Production)

For production, configure proper SSL certificates:

1. Export SAP B1 Service Layer certificate
2. Import to system trust store
3. Update `src/services/sapB1Client.js` to enable certificate validation

## Testing the Installation

### 1. Verify Python Integration

Test the Prophet engine directly:

```bash
echo '{"data": [{"ds": "2024-01-01", "y": 10}, {"ds": "2024-01-02", "y": 12}], "config": {"horizon_days": 1}}' | python3 src/forecasting/prophetEngine.py
```

Should output a JSON forecast result.

### 2. Test SAP B1 Connection

Create a simple test script `test-connection.js`:

```javascript
const sapB1Client = require('./src/services/sapB1Client');

async function test() {
  try {
    await sapB1Client.login();
    console.log('✓ Successfully connected to SAP B1');
    await sapB1Client.logout();
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
  }
}

test();
```

Run it:

```bash
node test-connection.js
```

### 3. Run a Test Forecast

If you have test data, run a forecast for one customer:

```bash
npm start -- --customer C0001
```

Replace `C0001` with an actual customer code from your SAP B1.

### 4. Check Logs

Verify logging is working:

```bash
ls -la logs/
cat logs/forecaster.log
```

## Common Issues

### Issue: "Cannot find module 'prophet'"

**Solution:**
```bash
# Activate virtual environment first
source venv/bin/activate  # Linux/macOS
# or venv\Scripts\activate on Windows

# Then install
pip install prophet
```

### Issue: "Python not found" or "python3: command not found"

**Solution:**

On Windows, try using `python` instead of `python3`:
- Edit `src/forecasting/forecaster.js`
- Change `spawn('python3', ...)` to `spawn('python', ...)`

Or add Python to PATH and restart terminal.

### Issue: "ECONNREFUSED" when connecting to SAP B1

**Solutions:**

1. Verify Service Layer URL:
   ```bash
   curl -k https://your-server:50000/b1s/v1
   ```

2. Check firewall rules

3. Verify SAP B1 Service Layer is running

4. Check if you need to use HTTP instead of HTTPS (dev environments)

### Issue: "Self-signed certificate" error

**Solution:**

For development/testing, the app already allows self-signed certificates. For production:

1. Install proper SSL certificates on SAP B1
2. Or configure certificate in Node.js trust store

### Issue: Prophet installation fails on Windows

**Solutions:**

1. Install Microsoft C++ Build Tools:
   - Download from [Microsoft](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Install "Desktop development with C++"

2. Or use conda:
   ```bash
   conda install -c conda-forge prophet
   ```

### Issue: "Insufficient historical records"

**Solution:**

Reduce the minimum required records:

```env
MIN_HISTORICAL_RECORDS=10  # Instead of 30
```

Or increase historical data range:

```env
HISTORICAL_DATA_DAYS=730  # 2 years instead of 1
```

### Issue: Memory errors with large datasets

**Solutions:**

1. Increase Node.js memory:
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 npm start
   ```

2. Reduce historical data range:
   ```env
   HISTORICAL_DATA_DAYS=90
   ```

3. Process customers in batches (requires code modification)

## Next Steps

After successful installation:

1. Review and adjust configuration in `.env`
2. Configure special events (Ramadan, Eid, etc.)
3. Customize business logic parameters
4. Set up scheduled execution
5. Run initial forecast and review results
6. Set up backup for generated reports

## Production Deployment

For production deployment:

1. **Use a process manager:**
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name sap-forecaster
   pm2 save
   pm2 startup
   ```

2. **Set up log rotation:**
   ```bash
   pm2 install pm2-logrotate
   ```

3. **Configure environment-specific settings:**
   - Use production SAP credentials
   - Enable proper SSL/TLS
   - Set appropriate log levels
   - Configure backup for reports

4. **Monitor the application:**
   ```bash
   pm2 monit
   pm2 logs sap-forecaster
   ```

5. **Set up alerts:**
   - Configure email notifications for errors
   - Set up monitoring (e.g., with Prometheus/Grafana)

## Support

If you encounter issues not covered here:

1. Check the main [README.md](README.md) for troubleshooting
2. Review application logs in `./logs/`
3. Enable debug logging: `LOG_LEVEL=debug`
4. Check SAP B1 Service Layer logs

## Security Checklist

Before going to production:

- [ ] Changed default credentials
- [ ] Using read-only SAP account
- [ ] `.env` file is not committed to git
- [ ] SSL/TLS properly configured
- [ ] Firewall rules in place
- [ ] Log files protected
- [ ] Output directory access restricted
- [ ] Regular password rotation configured
- [ ] Backup strategy in place

---

**Congratulations!** Your SAP B1 Sales Forecasting System should now be ready to use.

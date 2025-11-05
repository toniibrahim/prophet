# Odoo Integration Guide

This guide explains how to integrate the SAP B1 Sales Forecasting System with Odoo ERP to automatically create sales orders for your salesmen.

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Setup](#setup)
4. [Configuration](#configuration)
5. [Usage](#usage)
6. [Workflow](#workflow)
7. [Troubleshooting](#troubleshooting)

## Overview

The Odoo integration automatically creates sale orders in Odoo based on your forecast proposals. Orders are:
- **Grouped by customer**
- **Assigned to the appropriate salesman**
- **Ready for review and approval**
- **Can be auto-confirmed** (optional)
- **Can create transfer requests** to mobile VANs (optional)

### Benefits

✅ **Automated Order Creation**: No manual data entry
✅ **Salesman Assignment**: Orders automatically assigned to correct salesman
✅ **Mobile VAN Support**: Transfer requests for delivery vehicles
✅ **Excel + Odoo**: Get both Excel reports and Odoo orders
✅ **Audit Trail**: Full traceability in Odoo
✅ **Flexible**: Can be enabled/disabled anytime

## How It Works

### Data Flow

```
SAP B1 (Sales Data)
    ↓
Prophet Forecasting
    ↓
Business Logic (Adjustments)
    ↓
Order Proposals
    ↓
Excel Reports ← You are here
    ↓
Odoo (Sale Orders) ← NEW!
    ↓
Transfer Requests (Mobile VANs)
    ↓
SAP B1 (Fulfillment)
```

### Order Assignment Logic

1. **Customer Lookup**: System finds customer in Odoo by SAP customer code (stored in `ref` field)
2. **Salesman Detection**: Gets assigned salesman from customer record (`user_id` field)
3. **Fallback**: If no salesman assigned, uses `ODOO_DEFAULT_SALESMAN_ID` from config
4. **Order Creation**: Creates sale order in Odoo with all forecast items
5. **Optional Confirmation**: Can auto-confirm orders (creates delivery orders)

## Setup

### Prerequisites

- Odoo 14+ (any edition)
- Odoo user account with permissions:
  - Read/Write: `sale.order` (Sales Orders)
  - Read/Write: `res.partner` (Customers)
  - Read: `product.product` (Products)
  - Read: `res.users` (Users/Salesmen)
  - Optional: `stock.picking` (for transfer requests)

### Step 1: Prepare Odoo

#### 1.1 Create Integration User (Recommended)

In Odoo:
1. Go to **Settings** → **Users & Companies** → **Users**
2. Create new user: `sap_forecast_sync`
3. Assign permissions:
   - **Sales / User: Own Documents Only** (minimum)
   - Or **Sales / Administrator** (for full access)
4. Note the user's **login** and **password**

#### 1.2 Map Customers

Ensure SAP B1 customers exist in Odoo with matching references:

**Option A: Use Reference Field**
1. In Odoo, go to **Sales** → **Customers**
2. For each customer, set **Internal Reference** (`ref` field) to match SAP B1 customer code
3. Example: SAP customer `C0001` → Odoo Reference: `C0001`

**Option B: Auto-Create**
- System will auto-create customers if not found
- Uses customer name from SAP B1
- Sets reference automatically

#### 1.3 Assign Salesmen

For each customer in Odoo:
1. Open customer record
2. Set **Salesperson** field to appropriate salesman
3. This determines who gets the order in Odoo

#### 1.4 Map Products

Ensure products exist in Odoo:
1. Product **Internal Reference** (`default_code`) must match SAP B1 item code
2. Example: SAP item `MILK-001` → Odoo Internal Reference: `MILK-001`

**Note**: Products not found in Odoo will be skipped (logged as warning)

### Step 2: Configure Application

Edit your `.env` file:

```env
# Enable Odoo Integration
ODOO_ENABLED=true

# Odoo Connection
ODOO_URL=https://your-odoo-server.com
ODOO_DB=your_database_name
ODOO_USERNAME=sap_forecast_sync
ODOO_PASSWORD=your_password

# Default Salesman (fallback)
ODOO_DEFAULT_SALESMAN_ID=2

# Optional: Auto-confirm orders
ODOO_AUTO_CONFIRM_ORDERS=false

# Optional: Create transfer requests
ODOO_CREATE_TRANSFER_REQUESTS=false
```

### Step 3: Install Dependencies

```bash
npm install
```

The `xmlrpc` package will be installed automatically.

### Step 4: Test Connection

Create a test script `test-odoo.js`:

```javascript
const odooClient = require('./src/services/odoo/odooClient');

async function test() {
  try {
    await odooClient.connect();
    console.log('✓ Successfully connected to Odoo');

    // Test read access
    const users = await odooClient.search('res.users', [], { limit: 1 });
    console.log('✓ Can read data');

    console.log('Odoo integration is working!');
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
  }
}

test();
```

Run:
```bash
node test-odoo.js
```

## Configuration

### Required Settings

| Setting | Description | Example |
|---------|-------------|---------|
| `ODOO_ENABLED` | Enable/disable integration | `true` |
| `ODOO_URL` | Odoo server URL | `https://mycompany.odoo.com` |
| `ODOO_DB` | Database name | `mycompany_prod` |
| `ODOO_USERNAME` | API user login | `sap_forecast_sync` |
| `ODOO_PASSWORD` | API user password | `SecurePassword123!` |

### Optional Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `ODOO_DEFAULT_SALESMAN_ID` | Fallback salesman ID | `null` |
| `ODOO_AUTO_CONFIRM_ORDERS` | Auto-confirm after creation | `false` |
| `ODOO_CREATE_TRANSFER_REQUESTS` | Create stock pickings | `false` |

### Finding Salesman IDs

To find salesman IDs in Odoo:

**Method 1: Through URL**
1. Go to **Sales** → **Configuration** → **Salespeople**
2. Click on a salesperson
3. Check the URL: `https://your-odoo.com/web#id=5&...`
4. The number after `id=` is the salesman ID

**Method 2: Through Technical Info**
1. Enable Developer Mode: Settings → Activate Developer Mode
2. Go to salesperson record
3. Click debug icon → **View Metadata**
4. Note the **ID** field

## Usage

### Run Forecast with Odoo Integration

```bash
# Enable Odoo in .env first
ODOO_ENABLED=true

# Run normal forecast
npm run forecast
```

### Output Example

```
================================================================================
SAP B1 Sales Forecasting System
================================================================================
Step 1: Connecting to SAP B1 Service Layer...
✓ Connected to SAP B1

Step 2: Fetching historical sales and returns data...
✓ Fetched data for 25 customers

Step 3: Preprocessing and preparing data for forecasting...
✓ Prepared data for 25 customers

Step 4: Generating forecasts using Prophet...
✓ Generated forecasts for 25 customers

Step 5: Creating order proposals with business logic...
✓ Created order proposals for 25 customers

Step 6: Generating Excel reports...
✓ Main report generated: ./data/output/order_proposals_20241105_143022.xlsx

Step 7: Sending orders to Odoo...
Processing proposal for customer C0001...
Created sale order 1234 for customer C0001
Processing proposal for customer C0002...
Created sale order 1235 for customer C0002
...
✓ Odoo sync complete: 25 orders created
  - Salesmen: 5
  - Failed: 0

Step 8: Cleaning up...
✓ Disconnected from SAP B1

================================================================================
Forecasting completed successfully!
Duration: 45.23 seconds
Report: ./data/output/order_proposals_20241105_143022.xlsx
Odoo: 25 orders created for 5 salesmen
================================================================================
```

### Viewing Orders in Odoo

1. Log into Odoo
2. Go to **Sales** → **Orders**
3. Look for orders with origin: `SAP-FORECAST-YYYYMMDD`
4. Orders are in **Quotation** state (unless auto-confirm enabled)

### By Salesman

Each salesman can see their orders:
1. Log in as salesman
2. Go to **Sales** → **My Orders**
3. See only orders assigned to them

## Workflow

### Standard Workflow (Manual Approval)

```
1. Forecast Generation
   ↓
2. Excel Report + Odoo Orders Created
   ↓
3. Salesman Reviews Orders in Odoo
   ↓
4. Salesman Adjusts Quantities (if needed)
   ↓
5. Salesman Confirms Order
   ↓
6. Delivery Order Created
   ↓
7. Transfer to Mobile VAN
   ↓
8. Delivery to Customer
```

### Automated Workflow (Auto-Confirm)

Set `ODOO_AUTO_CONFIRM_ORDERS=true`

```
1. Forecast Generation
   ↓
2. Orders Created AND Confirmed Automatically
   ↓
3. Delivery Orders Created Automatically
   ↓
4. Ready for Transfer to Mobile VAN
   ↓
5. Delivery to Customer
```

### Salesman Daily Routine

**Morning (6:00 AM):**
- System generates forecasts
- Orders appear in Odoo

**Salesman Actions:**
1. Log into Odoo mobile app
2. Review assigned orders
3. Adjust quantities if needed
4. Confirm orders
5. Pick products for delivery
6. Load mobile VAN
7. Deliver to customers

## Advanced Features

### Auto-Confirmation

Enable automatic order confirmation:

```env
ODOO_AUTO_CONFIRM_ORDERS=true
```

**Effect:**
- Orders are confirmed immediately after creation
- Delivery orders are created automatically
- Stock is reserved
- Skips manual review step

**Use When:**
- High forecast accuracy
- Trust in business logic
- Need speed over manual control

### Transfer Requests

Create stock pickings automatically:

```env
ODOO_CREATE_TRANSFER_REQUESTS=true
```

**Effect:**
- Creates `stock.picking` records
- Assigns to appropriate warehouse/VAN
- Ready for picking
- Can be printed as pick lists

**Integration with Mobile VANs:**
- Each VAN can be a warehouse location in Odoo
- Transfer requests assign products to VAN
- Salesman sees pick list
- Confirms pickup
- Delivers to customer

### Custom Salesman Mapping

If your setup differs, modify `odooOrderService.js`:

```javascript
async function getSalesmanForCustomer(customerCode) {
  // Custom logic here
  // Example: Map by customer code prefix
  if (customerCode.startsWith('N')) {
    return 5; // North region salesman
  } else if (customerCode.startsWith('S')) {
    return 6; // South region salesman
  }

  // Fallback to customer's assigned salesman
  const customers = await odooClient.searchRead(
    'res.partner',
    [['ref', '=', customerCode]],
    ['user_id']
  );
  return customers[0]?.user_id?.[0] || config.odoo.defaultSalesmanId;
}
```

## Troubleshooting

### Connection Issues

**Error: "Cannot connect to Odoo"**

Solutions:
1. Check URL is correct: `https://your-odoo.com` (no trailing slash)
2. Verify port (default: 8069 for HTTP, 443 for HTTPS)
3. Test network connectivity: `curl https://your-odoo.com/web/login`
4. Check firewall rules

**Error: "Authentication failed"**

Solutions:
1. Verify username and password
2. Check database name is correct
3. Ensure user is not disabled
4. Try logging in through web interface first

### Permission Issues

**Error: "Access Denied"**

Solutions:
1. Check user has Sales permissions
2. Verify access rights:
   ```javascript
   // Test script
   const canCreate = await odooClient.checkAccessRights('sale.order', 'create');
   console.log('Can create orders:', canCreate);
   ```
3. Grant necessary permissions in Odoo

### Data Mapping Issues

**Warning: "Product not found: ITEM001"**

Solutions:
1. Ensure product exists in Odoo
2. Check `default_code` field matches SAP item code
3. Create missing products in Odoo
4. Or modify mapping logic in `getProductId()`

**Warning: "No salesman found for customer C0001"**

Solutions:
1. Set `ODOO_DEFAULT_SALESMAN_ID` in .env
2. Assign salesperson to customer in Odoo
3. Modify salesman mapping logic

**Error: "Customer not found"**

Solutions:
- System will auto-create customer
- Or manually create in Odoo with correct reference
- Check `ref` field matches SAP customer code

### Order Issues

**Orders Created but Empty**

Likely cause: Products not found in Odoo

Solution:
1. Check logs for "Product not found" warnings
2. Create missing products in Odoo
3. Ensure `default_code` matches SAP item codes

**Orders Not Visible to Salesman**

Likely cause: Salesman assignment

Solution:
1. Check customer has salesperson assigned
2. Verify `ODOO_DEFAULT_SALESMAN_ID` is set
3. Check user permissions in Odoo

## Integration with SAP B1

After orders are fulfilled in Odoo, they can be synced back to SAP B1:

### Option 1: Odoo-SAP Connector
Use an existing Odoo-SAP B1 connector to sync:
- Confirmed sale orders → SAP B1 sales orders
- Deliveries → SAP B1 delivery notes
- Invoices → SAP B1 invoices

### Option 2: Custom Sync
Develop custom sync module:
1. Listen for order confirmation in Odoo
2. Call SAP B1 Service Layer
3. Create corresponding documents

### Option 3: Manual Entry
- Export from Odoo
- Import to SAP B1
- Or manually create in SAP B1

## Best Practices

1. **Test First**: Start with `ODOO_ENABLED=false`, verify forecasts are correct
2. **Manual Approval**: Keep `ODOO_AUTO_CONFIRM_ORDERS=false` initially
3. **Monitor Daily**: Check for failed orders in logs
4. **Review Accuracy**: Compare Odoo orders to actual sales
5. **Train Salesmen**: Ensure they understand the new workflow
6. **Backup Plan**: Keep Excel reports as backup
7. **Gradual Rollout**: Enable for one salesman first, then expand

## Security

- Store Odoo credentials securely
- Use dedicated API user (not admin)
- Limit permissions to minimum required
- Use HTTPS for Odoo connection
- Rotate passwords regularly
- Monitor API access logs in Odoo

## Support

### Logs

Check logs for detailed information:
```bash
cat logs/forecaster.log | grep -i odoo
```

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

### Common Log Messages

- `✓ Odoo sync complete: 25 orders created` - Success
- `Failed to get product ITEM001` - Product not found
- `No salesman found for customer C0001` - Salesman mapping issue
- `Failed to create sale order` - Permission or data issue

## Summary

The Odoo integration allows you to:
- ✅ Automatically create sale orders from forecasts
- ✅ Assign orders to appropriate salesmen
- ✅ Support mobile VAN workflows
- ✅ Optionally auto-confirm and create transfers
- ✅ Keep Excel reports for reference
- ✅ Maintain full audit trail

**Next Steps:**
1. Configure Odoo connection in `.env`
2. Test connection: `node test-odoo.js`
3. Map customers and products
4. Run first forecast: `npm run forecast`
5. Check orders in Odoo
6. Train salesmen on new workflow

---

For additional help, check the logs or contact your system administrator.

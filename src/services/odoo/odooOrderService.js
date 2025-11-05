/**
 * Odoo Order Service
 * Sends forecast proposals to Odoo as sale orders/transfer requests
 */

const odooClient = require('./odooClient');
const logger = require('../../utils/logger');
const dateHelpers = require('../../utils/dateHelpers');
const config = require('../../config');
const _ = require('lodash');

/**
 * Get salesman ID from Odoo by SAP customer code
 * This maps SAP B1 customers to Odoo salesmen
 * @param {string} customerCode
 * @returns {Promise<number|null>} Salesman ID
 */
async function getSalesmanForCustomer(customerCode) {
  try {
    // Search for customer in Odoo (res.partner)
    const customers = await odooClient.searchRead(
      'res.partner',
      [['ref', '=', customerCode]], // ref field typically stores external reference
      ['user_id'] // user_id is the salesperson
    );

    if (customers.length > 0 && customers[0].user_id) {
      return customers[0].user_id[0]; // user_id is returned as [id, name]
    }

    // Fallback: Use default salesman from config
    if (config.odoo.defaultSalesmanId) {
      logger.warn(`No salesman found for customer ${customerCode}, using default`);
      return config.odoo.defaultSalesmanId;
    }

    logger.warn(`No salesman found for customer ${customerCode}`);
    return null;
  } catch (error) {
    logger.error(`Failed to get salesman for customer ${customerCode}`, {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get or create customer in Odoo
 * @param {string} customerCode
 * @param {string} customerName
 * @returns {Promise<number>} Partner ID
 */
async function getOrCreateCustomer(customerCode, customerName) {
  try {
    // Search for existing customer
    const partnerIds = await odooClient.search('res.partner', [['ref', '=', customerCode]]);

    if (partnerIds.length > 0) {
      return partnerIds[0];
    }

    // Create new customer
    logger.info(`Creating new customer in Odoo: ${customerCode} - ${customerName}`);
    const partnerId = await odooClient.create('res.partner', {
      name: customerName,
      ref: customerCode,
      customer_rank: 1, // Mark as customer
      is_company: true,
    });

    return partnerId;
  } catch (error) {
    logger.error(`Failed to get/create customer ${customerCode}`, { error: error.message });
    throw error;
  }
}

/**
 * Get product ID from Odoo by item code
 * @param {string} itemCode
 * @returns {Promise<number|null>}
 */
async function getProductId(itemCode) {
  try {
    const productIds = await odooClient.search('product.product', [
      ['default_code', '=', itemCode], // default_code is the internal reference
    ]);

    if (productIds.length > 0) {
      return productIds[0];
    }

    logger.warn(`Product not found in Odoo: ${itemCode}`);
    return null;
  } catch (error) {
    logger.error(`Failed to get product ${itemCode}`, { error: error.message });
    return null;
  }
}

/**
 * Create sale order in Odoo
 * @param {Object} orderData
 * @returns {Promise<number>} Sale order ID
 */
async function createSaleOrder(orderData) {
  try {
    const {
      partnerId,
      salesmanId,
      orderLines,
      deliveryDate,
      customerCode,
      customerName,
    } = orderData;

    logger.info(`Creating sale order in Odoo for customer ${customerCode}...`);

    // Prepare order values
    const orderValues = {
      partner_id: partnerId,
      user_id: salesmanId,
      date_order: dateHelpers.formatForSAP(dateHelpers.getCurrentDate()),
      commitment_date: deliveryDate, // Expected delivery date
      origin: `SAP-FORECAST-${dateHelpers.formatDate(dateHelpers.getCurrentDate(), 'yyyyMMdd')}`,
      note: `Automated forecast generated on ${dateHelpers.formatDate(dateHelpers.getCurrentDate())}`,
      order_line: orderLines.map(line => [
        0,
        0,
        {
          product_id: line.productId,
          name: line.description,
          product_uom_qty: line.quantity,
          price_unit: line.price || 0, // Price if available
        },
      ]),
    };

    // Create order
    const orderId = await odooClient.create('sale.order', orderValues);

    logger.info(`Created sale order ${orderId} for customer ${customerCode}`);

    return orderId;
  } catch (error) {
    logger.error('Failed to create sale order in Odoo', { error: error.message });
    throw error;
  }
}

/**
 * Convert order proposal to Odoo sale order
 * @param {Object} customerProposal
 * @returns {Promise<Object|null>}
 */
async function sendProposalToOdoo(customerProposal) {
  try {
    logger.info(`Processing proposal for customer ${customerProposal.customerCode}...`);

    // Get customer in Odoo
    const partnerId = await getOrCreateCustomer(
      customerProposal.customerCode,
      customerProposal.customerName
    );

    // Get salesman
    const salesmanId = await getSalesmanForCustomer(customerProposal.customerCode);

    if (!salesmanId) {
      logger.error(`Cannot create order without salesman for ${customerProposal.customerCode}`);
      return null;
    }

    // Prepare order lines
    const orderLines = [];
    for (const proposal of customerProposal.proposals) {
      const productId = await getProductId(proposal.itemCode);

      if (productId) {
        orderLines.push({
          productId,
          description: proposal.itemDescription,
          quantity: proposal.proposedQuantity,
          price: 0, // Price will be fetched from Odoo product
        });
      } else {
        logger.warn(
          `Skipping item ${proposal.itemCode} - not found in Odoo products`
        );
      }
    }

    if (orderLines.length === 0) {
      logger.warn(`No valid order lines for customer ${customerProposal.customerCode}`);
      return null;
    }

    // Create sale order
    const orderId = await createSaleOrder({
      partnerId,
      salesmanId,
      orderLines,
      deliveryDate: customerProposal.forecastDate,
      customerCode: customerProposal.customerCode,
      customerName: customerProposal.customerName,
    });

    return {
      success: true,
      orderId,
      customerCode: customerProposal.customerCode,
      customerName: customerProposal.customerName,
      salesmanId,
      itemCount: orderLines.length,
      totalQuantity: _.sumBy(orderLines, 'quantity'),
    };
  } catch (error) {
    logger.error(`Failed to send proposal to Odoo for ${customerProposal.customerCode}`, {
      error: error.message,
    });
    return {
      success: false,
      error: error.message,
      customerCode: customerProposal.customerCode,
    };
  }
}

/**
 * Send all proposals to Odoo
 * @param {Array} allProposals
 * @returns {Promise<Object>}
 */
async function sendAllProposalsToOdoo(allProposals) {
  logger.info(`Sending ${allProposals.length} proposals to Odoo...`);

  const results = [];

  for (const proposal of allProposals) {
    const result = await sendProposalToOdoo(proposal);
    if (result) {
      results.push(result);
    }
  }

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // Group by salesman
  const bySalesman = _.groupBy(successful, 'salesmanId');
  const salesmenCount = Object.keys(bySalesman).length;

  logger.info(
    `Odoo sync complete: ${successful.length} orders created, ${failed.length} failed`
  );

  return {
    totalProposals: allProposals.length,
    successful: successful.length,
    failed: failed.length,
    salesmenCount,
    bySalesman: Object.keys(bySalesman).map(salesmanId => ({
      salesmanId: parseInt(salesmanId),
      orderCount: bySalesman[salesmanId].length,
      totalItems: _.sumBy(bySalesman[salesmanId], 'itemCount'),
      totalQuantity: _.sumBy(bySalesman[salesmanId], 'totalQuantity'),
      customers: bySalesman[salesmanId].map(r => r.customerCode),
    })),
    successfulOrders: successful,
    failedOrders: failed,
  };
}

/**
 * Confirm sale orders in Odoo (optional)
 * @param {Array} orderIds
 * @returns {Promise<boolean>}
 */
async function confirmSaleOrders(orderIds) {
  try {
    logger.info(`Confirming ${orderIds.length} sale orders in Odoo...`);

    // Call action_confirm method on sale orders
    await odooClient.call('sale.order', 'action_confirm', orderIds);

    logger.info(`Confirmed ${orderIds.length} sale orders`);
    return true;
  } catch (error) {
    logger.error('Failed to confirm sale orders', { error: error.message });
    return false;
  }
}

/**
 * Create stock picking (transfer request) for orders
 * This is typically done automatically by Odoo when confirming sale orders
 * But can be called explicitly if needed
 * @param {Array} orderIds
 * @returns {Promise<Array>} Picking IDs
 */
async function createTransferRequests(orderIds) {
  try {
    logger.info(`Creating transfer requests for ${orderIds.length} orders...`);

    const pickingIds = [];

    for (const orderId of orderIds) {
      // Confirm order (creates picking automatically)
      await odooClient.call('sale.order', 'action_confirm', [orderId]);

      // Get pickings for this order
      const pickings = await odooClient.searchRead(
        'stock.picking',
        [['origin', '=', `SO${orderId}`]],
        ['id', 'name']
      );

      pickingIds.push(...pickings.map(p => p.id));
    }

    logger.info(`Created ${pickingIds.length} transfer requests`);

    return pickingIds;
  } catch (error) {
    logger.error('Failed to create transfer requests', { error: error.message });
    return [];
  }
}

/**
 * Get salesman name from Odoo
 * @param {number} salesmanId
 * @returns {Promise<string>}
 */
async function getSalesmanName(salesmanId) {
  try {
    const users = await odooClient.read('res.users', [salesmanId], ['name']);
    return users.length > 0 ? users[0].name : `Salesman ${salesmanId}`;
  } catch (error) {
    return `Salesman ${salesmanId}`;
  }
}

module.exports = {
  getSalesmanForCustomer,
  getOrCreateCustomer,
  getProductId,
  createSaleOrder,
  sendProposalToOdoo,
  sendAllProposalsToOdoo,
  confirmSaleOrders,
  createTransferRequests,
  getSalesmanName,
};

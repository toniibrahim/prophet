/**
 * Excel Report Generator
 * Creates Excel files with order proposals and analysis
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const config = require('../config');
const dateHelpers = require('../utils/dateHelpers');

/**
 * Ensure output directory exists
 */
function ensureOutputDirectory() {
  if (!fs.existsSync(config.output.path)) {
    fs.mkdirSync(config.output.path, { recursive: true });
  }
}

/**
 * Create summary worksheet
 * @param {Array} allProposals
 * @returns {Object}
 */
function createSummaryWorksheet(allProposals) {
  const summaryData = [];

  // Add header
  summaryData.push([
    'Report Generated',
    dateHelpers.formatDate(dateHelpers.getCurrentDate()),
  ]);
  summaryData.push([
    'Forecast Date',
    allProposals[0]?.forecastDate || dateHelpers.formatForSAP(dateHelpers.getDaysFromNow(2)),
  ]);
  summaryData.push([]);

  // Add overall statistics
  summaryData.push(['Overall Statistics']);
  summaryData.push(['Total Customers', allProposals.length]);
  summaryData.push([
    'Total Items',
    allProposals.reduce((sum, p) => sum + p.summary.totalItems, 0),
  ]);
  summaryData.push([
    'Total Quantity',
    allProposals.reduce((sum, p) => sum + p.summary.totalQuantity, 0),
  ]);
  summaryData.push([]);

  // Add customer summary table
  summaryData.push([
    'Customer Code',
    'Customer Name',
    'Total Items',
    'Total Quantity',
    'Avg Confidence %',
    'Stockout Risks',
    'Overstock Risks',
    'Items with Alerts',
  ]);

  allProposals.forEach(proposal => {
    summaryData.push([
      proposal.customerCode,
      proposal.customerName,
      proposal.summary.totalItems,
      proposal.summary.totalQuantity,
      Math.round(proposal.summary.averageConfidence),
      proposal.summary.stockoutRisks,
      proposal.summary.overstockRisks,
      proposal.summary.itemsWithAlerts,
    ]);
  });

  return XLSX.utils.aoa_to_sheet(summaryData);
}

/**
 * Create customer worksheet
 * @param {Object} customerProposal
 * @returns {Object}
 */
function createCustomerWorksheet(customerProposal) {
  const worksheetData = [];

  // Add customer header
  worksheetData.push(['Customer Code', customerProposal.customerCode]);
  worksheetData.push(['Customer Name', customerProposal.customerName]);
  worksheetData.push(['Forecast Date', customerProposal.forecastDate]);
  worksheetData.push(['Generated At', customerProposal.generatedAt]);
  worksheetData.push([]);

  // Add summary
  worksheetData.push(['Summary']);
  worksheetData.push(['Total Items', customerProposal.summary.totalItems]);
  worksheetData.push(['Total Quantity', customerProposal.summary.totalQuantity]);
  worksheetData.push(['Average Confidence', `${Math.round(customerProposal.summary.averageConfidence)}%`]);
  worksheetData.push(['Items with Alerts', customerProposal.summary.itemsWithAlerts]);
  worksheetData.push([]);

  // Add proposals table
  worksheetData.push([
    'Item Code',
    'Item Description',
    'Proposed Qty',
    'Base Forecast',
    'Adjustment Factor',
    'Confidence %',
    'Avg Daily Sales',
    'Return Rate %',
    'Special Events',
    'Alerts',
    'Adjustment Reasons',
  ]);

  customerProposal.proposals.forEach(proposal => {
    worksheetData.push([
      proposal.itemCode,
      proposal.itemDescription,
      proposal.proposedQuantity,
      proposal.baseForecast,
      proposal.adjustmentFactor.toFixed(2),
      proposal.confidenceLevel,
      proposal.historicalContext.averageDailySales.toFixed(2),
      (proposal.historicalContext.recentReturnRate * 100).toFixed(1),
      proposal.specialEvents.join(', '),
      proposal.alerts.map(a => `[${a.severity.toUpperCase()}] ${a.message}`).join('; '),
      proposal.adjustmentReasons.join('; '),
    ]);
  });

  return XLSX.utils.aoa_to_sheet(worksheetData);
}

/**
 * Create detailed proposals worksheet (all customers in one sheet)
 * @param {Array} allProposals
 * @returns {Object}
 */
function createDetailedProposalsWorksheet(allProposals) {
  const worksheetData = [];

  // Add header
  worksheetData.push([
    'Customer Code',
    'Customer Name',
    'Item Code',
    'Item Description',
    'Delivery Date',
    'Proposed Qty',
    'Base Forecast',
    'Adjustment Factor',
    'Confidence %',
    'Avg Daily Sales',
    'Return Rate %',
    'Total Hist Sales',
    'Total Hist Returns',
    'Special Events',
    'Alerts Count',
    'High Priority Alerts',
    'Adjustment Reasons',
  ]);

  allProposals.forEach(customerProposal => {
    customerProposal.proposals.forEach(proposal => {
      const highPriorityAlerts = proposal.alerts
        .filter(a => a.severity === 'high')
        .map(a => a.message)
        .join('; ');

      worksheetData.push([
        customerProposal.customerCode,
        customerProposal.customerName,
        proposal.itemCode,
        proposal.itemDescription,
        proposal.deliveryDate,
        proposal.proposedQuantity,
        proposal.baseForecast,
        proposal.adjustmentFactor.toFixed(2),
        proposal.confidenceLevel,
        proposal.historicalContext.averageDailySales.toFixed(2),
        (proposal.historicalContext.recentReturnRate * 100).toFixed(1),
        proposal.historicalContext.totalHistoricalSales,
        proposal.historicalContext.totalHistoricalReturns,
        proposal.specialEvents.join(', '),
        proposal.alerts.length,
        highPriorityAlerts,
        proposal.adjustmentReasons.join('; '),
      ]);
    });
  });

  return XLSX.utils.aoa_to_sheet(worksheetData);
}

/**
 * Create alerts worksheet
 * @param {Array} allProposals
 * @returns {Object}
 */
function createAlertsWorksheet(allProposals) {
  const worksheetData = [];

  // Add header
  worksheetData.push([
    'Priority',
    'Customer Code',
    'Customer Name',
    'Item Code',
    'Item Description',
    'Alert Type',
    'Severity',
    'Message',
    'Proposed Qty',
  ]);

  const allAlerts = [];

  allProposals.forEach(customerProposal => {
    customerProposal.proposals.forEach(proposal => {
      proposal.alerts.forEach(alert => {
        allAlerts.push({
          customerCode: customerProposal.customerCode,
          customerName: customerProposal.customerName,
          itemCode: proposal.itemCode,
          itemDescription: proposal.itemDescription,
          alertType: alert.type,
          severity: alert.severity,
          message: alert.message,
          proposedQuantity: proposal.proposedQuantity,
          severityOrder: alert.severity === 'high' ? 1 : alert.severity === 'medium' ? 2 : 3,
        });
      });
    });
  });

  // Sort by severity
  allAlerts.sort((a, b) => a.severityOrder - b.severityOrder);

  allAlerts.forEach((alert, index) => {
    worksheetData.push([
      index + 1,
      alert.customerCode,
      alert.customerName,
      alert.itemCode,
      alert.itemDescription,
      alert.alertType,
      alert.severity.toUpperCase(),
      alert.message,
      alert.proposedQuantity,
    ]);
  });

  return XLSX.utils.aoa_to_sheet(worksheetData);
}

/**
 * Generate Excel report
 * @param {Array} allProposals
 * @returns {string} Path to generated file
 */
function generateReport(allProposals) {
  try {
    logger.info('Generating Excel report...');

    ensureOutputDirectory();

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Add summary worksheet
    const summarySheet = createSummaryWorksheet(allProposals);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Add detailed proposals worksheet
    const detailedSheet = createDetailedProposalsWorksheet(allProposals);
    XLSX.utils.book_append_sheet(workbook, detailedSheet, 'All Proposals');

    // Add alerts worksheet
    const alertsSheet = createAlertsWorksheet(allProposals);
    XLSX.utils.book_append_sheet(workbook, alertsSheet, 'Alerts');

    // Add individual customer worksheets (limit to first 20 to avoid too many sheets)
    const maxCustomerSheets = 20;
    allProposals.slice(0, maxCustomerSheets).forEach(customerProposal => {
      const customerSheet = createCustomerWorksheet(customerProposal);
      // Excel sheet names are limited to 31 characters
      const sheetName = `${customerProposal.customerCode}`.substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, customerSheet, sheetName);
    });

    // Generate filename with timestamp
    const timestamp = dateHelpers.formatDate(dateHelpers.getCurrentDate(), 'yyyyMMdd_HHmmss');
    const filename = `order_proposals_${timestamp}.xlsx`;
    const filepath = path.join(config.output.path, filename);

    // Write file
    XLSX.writeFile(workbook, filepath);

    logger.info(`Excel report generated: ${filepath}`);

    return filepath;
  } catch (error) {
    logger.error('Failed to generate Excel report', { error: error.message });
    throw error;
  }
}

/**
 * Generate individual customer reports
 * @param {Array} allProposals
 * @returns {Array} Paths to generated files
 */
function generateCustomerReports(allProposals) {
  const generatedFiles = [];

  ensureOutputDirectory();

  allProposals.forEach(customerProposal => {
    try {
      const workbook = XLSX.utils.book_new();

      // Add customer worksheet
      const customerSheet = createCustomerWorksheet(customerProposal);
      XLSX.utils.book_append_sheet(workbook, customerSheet, 'Order Proposal');

      // Generate filename
      const timestamp = dateHelpers.formatDate(dateHelpers.getCurrentDate(), 'yyyyMMdd');
      const filename = `${customerProposal.customerCode}_${timestamp}.xlsx`;
      const filepath = path.join(config.output.path, filename);

      // Write file
      XLSX.writeFile(workbook, filepath);

      generatedFiles.push(filepath);
      logger.debug(`Generated report for customer ${customerProposal.customerCode}`);
    } catch (error) {
      logger.error(`Failed to generate report for customer ${customerProposal.customerCode}`, {
        error: error.message,
      });
    }
  });

  logger.info(`Generated ${generatedFiles.length} individual customer reports`);

  return generatedFiles;
}

module.exports = {
  generateReport,
  generateCustomerReports,
};

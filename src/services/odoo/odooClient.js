/**
 * Odoo XML-RPC Client
 * Connects to Odoo via XML-RPC API
 */

const xmlrpc = require('xmlrpc');
const logger = require('../../utils/logger');
const config = require('../../config');

class OdooClient {
  constructor() {
    this.url = null;
    this.db = null;
    this.username = null;
    this.password = null;
    this.uid = null;
    this.commonClient = null;
    this.objectClient = null;
  }

  /**
   * Initialize Odoo connection
   */
  async connect() {
    try {
      if (!config.odoo.url || !config.odoo.db || !config.odoo.username || !config.odoo.password) {
        throw new Error('Odoo configuration is incomplete. Please check .env file.');
      }

      this.url = config.odoo.url;
      this.db = config.odoo.db;
      this.username = config.odoo.username;
      this.password = config.odoo.password;

      // Parse URL to get host and port
      const urlObj = new URL(this.url);
      const host = urlObj.hostname;
      const port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 8069);
      const isSecure = urlObj.protocol === 'https:';

      // Create XML-RPC clients
      this.commonClient = isSecure
        ? xmlrpc.createSecureClient({ host, port, path: '/xmlrpc/2/common' })
        : xmlrpc.createClient({ host, port, path: '/xmlrpc/2/common' });

      this.objectClient = isSecure
        ? xmlrpc.createSecureClient({ host, port, path: '/xmlrpc/2/object' })
        : xmlrpc.createClient({ host, port, path: '/xmlrpc/2/object' });

      logger.info('Authenticating with Odoo...');

      // Authenticate
      this.uid = await this.authenticate();

      logger.info(`Successfully connected to Odoo as user ID: ${this.uid}`);

      return true;
    } catch (error) {
      logger.error('Failed to connect to Odoo', { error: error.message });
      throw error;
    }
  }

  /**
   * Authenticate with Odoo
   * @returns {Promise<number>} User ID
   */
  authenticate() {
    return new Promise((resolve, reject) => {
      this.commonClient.methodCall(
        'authenticate',
        [this.db, this.username, this.password, {}],
        (error, uid) => {
          if (error) {
            reject(error);
          } else if (!uid) {
            reject(new Error('Authentication failed - invalid credentials'));
          } else {
            resolve(uid);
          }
        }
      );
    });
  }

  /**
   * Execute a method on Odoo
   * @param {string} model - Odoo model (e.g., 'res.partner', 'sale.order')
   * @param {string} method - Method name (e.g., 'search', 'read', 'create')
   * @param {Array} args - Method arguments
   * @returns {Promise<any>}
   */
  execute(model, method, args = []) {
    return new Promise((resolve, reject) => {
      this.objectClient.methodCall(
        'execute_kw',
        [this.db, this.uid, this.password, model, method, args],
        (error, result) => {
          if (error) {
            logger.error(`Odoo execute error: ${model}.${method}`, { error: error.message });
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Execute a method with keyword arguments
   * @param {string} model
   * @param {string} method
   * @param {Array} args
   * @param {Object} kwargs
   * @returns {Promise<any>}
   */
  executeKw(model, method, args = [], kwargs = {}) {
    return new Promise((resolve, reject) => {
      this.objectClient.methodCall(
        'execute_kw',
        [this.db, this.uid, this.password, model, method, args, kwargs],
        (error, result) => {
          if (error) {
            logger.error(`Odoo execute_kw error: ${model}.${method}`, { error: error.message });
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Search records
   * @param {string} model
   * @param {Array} domain - Search domain
   * @param {Object} options - { limit, offset, order }
   * @returns {Promise<Array>} Array of record IDs
   */
  async search(model, domain = [], options = {}) {
    return this.executeKw(model, 'search', [domain], options);
  }

  /**
   * Read records
   * @param {string} model
   * @param {Array} ids - Record IDs
   * @param {Array} fields - Fields to read
   * @returns {Promise<Array>}
   */
  async read(model, ids, fields = []) {
    return this.execute(model, 'read', [ids, fields]);
  }

  /**
   * Search and read records
   * @param {string} model
   * @param {Array} domain
   * @param {Array} fields
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async searchRead(model, domain = [], fields = [], options = {}) {
    return this.executeKw(model, 'search_read', [domain], { fields, ...options });
  }

  /**
   * Create a record
   * @param {string} model
   * @param {Object} values
   * @returns {Promise<number>} New record ID
   */
  async create(model, values) {
    return this.execute(model, 'create', [values]);
  }

  /**
   * Update records
   * @param {string} model
   * @param {Array} ids
   * @param {Object} values
   * @returns {Promise<boolean>}
   */
  async write(model, ids, values) {
    return this.execute(model, 'write', [ids, values]);
  }

  /**
   * Delete records
   * @param {string} model
   * @param {Array} ids
   * @returns {Promise<boolean>}
   */
  async unlink(model, ids) {
    return this.execute(model, 'unlink', [ids]);
  }

  /**
   * Call a custom method
   * @param {string} model
   * @param {string} method
   * @param {Array} recordIds
   * @param {Object} kwargs
   * @returns {Promise<any>}
   */
  async call(model, method, recordIds = [], kwargs = {}) {
    return this.executeKw(model, method, [recordIds], kwargs);
  }

  /**
   * Get fields information
   * @param {string} model
   * @param {Array} fields
   * @returns {Promise<Object>}
   */
  async fieldsGet(model, fields = []) {
    return this.execute(model, 'fields_get', [fields, { attributes: ['string', 'type', 'required'] }]);
  }

  /**
   * Check access rights
   * @param {string} model
   * @param {string} operation - 'read', 'write', 'create', 'unlink'
   * @returns {Promise<boolean>}
   */
  async checkAccessRights(model, operation) {
    return this.execute(model, 'check_access_rights', [[operation], { raise_exception: false }]);
  }
}

// Create singleton instance
const odooClient = new OdooClient();

module.exports = odooClient;

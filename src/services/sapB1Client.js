/**
 * SAP Business One Service Layer Client
 * Handles authentication and API requests to SAP B1
 */

const axios = require('axios');
const https = require('https');
const config = require('../config');
const logger = require('../utils/logger');

class SAPB1Client {
  constructor() {
    this.baseURL = config.sapB1.serviceLayerUrl;
    this.sessionId = null;
    this.sessionTimeout = null;

    // Create axios instance with custom config
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      // Allow self-signed certificates (for dev/test environments)
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          logger.error('SAP B1 API Error', {
            status: error.response.status,
            data: error.response.data,
            url: error.config.url,
          });
        } else if (error.request) {
          logger.error('SAP B1 Network Error', {
            message: error.message,
            url: error.config?.url,
          });
        }
        throw error;
      }
    );
  }

  /**
   * Login to SAP B1 Service Layer
   * @returns {Promise<boolean>}
   */
  async login() {
    try {
      logger.info('Logging in to SAP B1 Service Layer...');

      const response = await this.client.post('/Login', {
        CompanyDB: config.sapB1.companyDb,
        UserName: config.sapB1.username,
        Password: config.sapB1.password,
      });

      this.sessionId = response.data.SessionId;

      // Set session cookie for subsequent requests
      this.client.defaults.headers.common['Cookie'] = `B1SESSION=${this.sessionId}`;

      logger.info('Successfully logged in to SAP B1');

      // Set session timeout (SAP B1 sessions typically expire after 30 minutes)
      this.resetSessionTimeout();

      return true;
    } catch (error) {
      logger.error('Failed to login to SAP B1', { error: error.message });
      throw error;
    }
  }

  /**
   * Reset session timeout
   */
  resetSessionTimeout() {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }

    // Re-login after 25 minutes (before 30-minute timeout)
    this.sessionTimeout = setTimeout(() => {
      logger.info('Session timeout approaching, re-authenticating...');
      this.login();
    }, 25 * 60 * 1000);
  }

  /**
   * Logout from SAP B1 Service Layer
   */
  async logout() {
    try {
      if (this.sessionId) {
        await this.client.post('/Logout');
        this.sessionId = null;
        delete this.client.defaults.headers.common['Cookie'];
        logger.info('Logged out from SAP B1');
      }

      if (this.sessionTimeout) {
        clearTimeout(this.sessionTimeout);
      }
    } catch (error) {
      logger.error('Failed to logout from SAP B1', { error: error.message });
    }
  }

  /**
   * Ensure we have a valid session
   */
  async ensureLoggedIn() {
    if (!this.sessionId) {
      await this.login();
    }
  }

  /**
   * Execute a GET request
   * @param {string} endpoint
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async get(endpoint, params = {}) {
    await this.ensureLoggedIn();
    this.resetSessionTimeout();

    const response = await this.client.get(endpoint, { params });
    return response.data;
  }

  /**
   * Execute a POST request
   * @param {string} endpoint
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async post(endpoint, data) {
    await this.ensureLoggedIn();
    this.resetSessionTimeout();

    const response = await this.client.post(endpoint, data);
    return response.data;
  }

  /**
   * Execute a PATCH request
   * @param {string} endpoint
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async patch(endpoint, data) {
    await this.ensureLoggedIn();
    this.resetSessionTimeout();

    const response = await this.client.patch(endpoint, data);
    return response.data;
  }

  /**
   * Query with OData parameters
   * @param {string} endpoint
   * @param {Object} options - { select, filter, orderby, top, skip }
   * @returns {Promise<Object>}
   */
  async query(endpoint, options = {}) {
    const params = {};

    if (options.select) {
      params.$select = Array.isArray(options.select) ? options.select.join(',') : options.select;
    }

    if (options.filter) {
      params.$filter = options.filter;
    }

    if (options.orderby) {
      params.$orderby = options.orderby;
    }

    if (options.top) {
      params.$top = options.top;
    }

    if (options.skip) {
      params.$skip = options.skip;
    }

    return this.get(endpoint, params);
  }

  /**
   * Query all results with pagination
   * @param {string} endpoint
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async queryAll(endpoint, options = {}) {
    const allResults = [];
    let skip = 0;
    const top = 100; // Batch size

    while (true) {
      const batchOptions = {
        ...options,
        top,
        skip,
      };

      const response = await this.query(endpoint, batchOptions);
      const results = response.value || [];

      if (results.length === 0) {
        break;
      }

      allResults.push(...results);

      if (results.length < top) {
        // Last batch
        break;
      }

      skip += top;
    }

    logger.debug(`Retrieved ${allResults.length} records from ${endpoint}`);
    return allResults;
  }
}

// Create singleton instance
const sapB1Client = new SAPB1Client();

module.exports = sapB1Client;

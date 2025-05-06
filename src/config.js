/**
 * Configuration handling for the Agora connector
 */
const logger = require('./utils/logger');

/**
 * Schema for the connector configuration
 */
const configSchema = {
  type: 'object',
  required: ['app_id', 'customer_id', 'customer_secret', 'endpoint_url', 'start_date'],
  properties: {
    app_id: {
      type: 'string',
      title: 'App ID',
      description: 'Agora App ID'
    },
    customer_id: {
      type: 'string',
      title: 'Customer ID',
      description: 'Agora Customer ID'
    },
    customer_secret: {
      type: 'string',
      title: 'Customer Secret',
      description: 'Agora Customer Secret',
      airbyte_secret: true
    },
    endpoint_url: {
      type: 'string',
      title: 'API Endpoint URL',
      description: 'Agora API endpoint URL',
      default: 'https://api.agora.io'
    },
    region: {
      type: 'string',
      title: 'Region',
      description: 'Agora region (na, eu, ap, cn, or global)',
      default: 'global',
      enum: ['global', 'na', 'eu', 'ap', 'cn']
    },
    start_date: {
      type: 'string',
      title: 'Start Date',
      description: 'Date from which to start syncing data (format: YYYY-MM-DD)',
      pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
      examples: ['2025-01-01']
    },
    streams: {
      type: 'array',
      title: 'Streams',
      description: 'List of streams to sync (leave empty to sync all streams)',
      items: {
        type: 'string',
        enum: ['usage', 'call_quality', 'recordings', 'channels', 'events']
      },
      default: []
    }
  }
};

/**
 * Validates the provided configuration against the schema
 * @param {Object} config - The configuration to validate
 * @throws {Error} If the configuration is invalid
 */
function validateConfig(config) {
  logger.info('Validating configuration...');
  
  // Ensure configuration is provided and is an object
  if (!config) {
    throw new Error('Configuration is required. Please provide a valid JSON configuration object.');
  }
  if (typeof config !== 'object') {
    throw new Error('Configuration must be a valid JSON object with key-value pairs.');
  }
  
  // Check required fields with detailed error messages
  for (const field of configSchema.required) {
    if (!config[field]) {
      let errorMessage = `Missing required configuration field: ${field}`;
      
      // Add specific guidance based on the missing field
      switch (field) {
        case 'app_id':
          errorMessage += '. Please provide your Agora App ID which can be found in your Agora Console under Project Management.';
          break;
        case 'customer_id':
          errorMessage += '. Please provide your Agora Customer ID which can be found in your Agora Console under Account Settings.';
          break;
        case 'customer_secret':
          errorMessage += '. Please provide your Agora Customer Secret which can be found in your Agora Console under Account Settings.';
          break;
        case 'endpoint_url':
          errorMessage += '. Please provide the URL of your Agora API endpoint (default: https://api.agora.io).';
          break;
        case 'start_date':
          errorMessage += '. Please provide a valid start date in YYYY-MM-DD format.';
          break;
        default:
          errorMessage += '.';
      }
      
      throw new Error(errorMessage);
    }
  }
  
  // Validate start date format with detailed error message
  const dateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
  if (!dateRegex.test(config.start_date)) {
    throw new Error('Invalid start_date format. Expected format: YYYY-MM-DD (e.g., 2025-01-01). Please provide a valid date.');
  }
  
  // Check if date is valid (not just the format)
  const dateParts = config.start_date.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(dateParts[2], 10);
  
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    throw new Error(`Invalid date: ${config.start_date}. Please provide a valid calendar date.`);
  }
  
  // Check if date is in the future
  if (date > new Date()) {
    logger.warn('Start date is in the future. This may result in no data being replicated until that date is reached.');
  }
  
  // Validate region if provided with detailed error message
  if (config.region && !['global', 'na', 'eu', 'ap', 'cn'].includes(config.region)) {
    throw new Error(`Invalid region: "${config.region}". Must be one of: global (Global), na (North America), eu (Europe), ap (Asia Pacific), cn (China). Please select a valid region for your Agora service.`);
  }
  
  // Check if endpoint URL was provided and region is not global
  if (config.endpoint_url && config.endpoint_url !== 'https://api.agora.io' && config.region && config.region !== 'global') {
    logger.warn(`Both custom endpoint URL (${config.endpoint_url}) and specific region (${config.region}) provided. The endpoint URL will take precedence over region selection.`);
  }
  
  logger.info('Configuration validation successful');
  return true;
}

/**
 * Returns the default configuration for the connector
 * @returns {Object} The default configuration
 */
function getDefaultConfig() {
  return {
    endpoint_url: 'https://api.agora.io',
    region: 'global',
    streams: []
  };
}

/**
 * Merges provided configuration with defaults
 * @param {Object} config - The provided configuration
 * @returns {Object} The merged configuration
 */
function mergeWithDefaults(config) {
  const defaults = getDefaultConfig();
  return {
    ...defaults,
    ...config
  };
}

module.exports = {
  configSchema,
  validateConfig,
  getDefaultConfig,
  mergeWithDefaults
};

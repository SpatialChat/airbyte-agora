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
  
  // Check required fields
  for (const field of configSchema.required) {
    if (!config[field]) {
      throw new Error(`Missing required configuration field: ${field}`);
    }
  }
  
  // Validate start date format
  const dateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
  if (!dateRegex.test(config.start_date)) {
    throw new Error('Invalid start_date format. Expected format: YYYY-MM-DD');
  }
  
  // Validate region if provided
  if (config.region && !['global', 'na', 'eu', 'ap', 'cn'].includes(config.region)) {
    throw new Error('Invalid region. Must be one of: global, na, eu, ap, cn');
  }
  
  logger.info('Configuration validation successful');
  return true;
}

module.exports = {
  configSchema,
  validateConfig
};

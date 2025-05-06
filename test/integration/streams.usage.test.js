/**
 * Integration tests for the Usage stream
 */
const UsageStream = require('../../src/streams/usage');
const { createStreamIntegrationTests } = require('./base.test');

// Define required fields to verify in records
const requiredFields = [
  'usage_id',
  'timestamp',
  'date',
  'app_id',
  'resource_type',
  'unit',
  'quantity',
  'region'
];

// Define additional validation checks
const validationChecks = [
  // Check that resource_type is valid
  (data) => {
    const validResourceTypes = [
      'audio_minutes',
      'video_sd_minutes',
      'video_hd_minutes',
      'video_hd_plus_minutes',
      'recording_minutes',
      'bandwidth_usage',
      'cloud_recording_storage'
    ];
    expect(validResourceTypes).toContain(data.resource_type);
  }
];

// Create the integration tests
createStreamIntegrationTests('usage', UsageStream, requiredFields, validationChecks);

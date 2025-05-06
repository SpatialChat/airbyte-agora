/**
 * Integration tests for the Channels stream
 */
const ChannelsStream = require('../../src/streams/channels');
const { createStreamIntegrationTests } = require('./base.test');

// Define required fields to verify in records
const requiredFields = [
  'channel_id',
  'timestamp',
  'app_id',
  'channel_name',
  'create_time'
];

// Define additional validation checks
const validationChecks = [
  // Check that duration is calculated correctly if end_time exists
  (data) => {
    if (data.end_time !== null) {
      const calculatedDuration = Math.floor(data.end_time / 1000) - Math.floor(data.create_time / 1000);
      expect(data.duration).toBe(calculatedDuration);
    }
  },
  
  // Check that active_status is consistent with end_time
  (data) => {
    if (data.end_time === null) {
      expect(data.active_status).toBe(true);
    } else {
      // If end_time is in the future, it should be active
      const now = Math.floor(Date.now() / 1000);
      const endTimeSeconds = Math.floor(data.end_time / 1000);
      expect(data.active_status).toBe(endTimeSeconds > now);
    }
  }
];

// Create the integration tests
createStreamIntegrationTests('channels', ChannelsStream, requiredFields, validationChecks);

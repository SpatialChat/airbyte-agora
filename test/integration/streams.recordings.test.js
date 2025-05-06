/**
 * Integration tests for the Recordings stream
 */
const RecordingsStream = require('../../src/streams/recordings');
const { createStreamIntegrationTests } = require('./base.test');

// Define required fields to verify in records
const requiredFields = [
  'recording_id',
  'timestamp',
  'app_id',
  'channel_id',
  'start_time',
  'recording_type',
  'status'
];

// Define additional validation checks
const validationChecks = [
  // Check that recording_type is valid
  (data) => {
    const validRecordingTypes = ['cloud', 'individual', 'web', 'composite'];
    expect(validRecordingTypes).toContain(data.recording_type);
  },
  
  // Check that status is valid
  (data) => {
    const validStatuses = ['pending', 'in_progress', 'completed', 'failed', 'expired'];
    expect(validStatuses).toContain(data.status);
  }
];

// Create the integration tests
createStreamIntegrationTests('recordings', RecordingsStream, requiredFields, validationChecks);

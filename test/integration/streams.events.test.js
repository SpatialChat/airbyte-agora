/**
 * Integration tests for the Events stream
 */
const EventsStream = require('../../src/streams/events');
const { createStreamIntegrationTests } = require('./base.test');

// Define required fields to verify in records
const requiredFields = [
  'event_id',
  'timestamp',
  'app_id',
  'event_type',
  'event_name',
  'severity'
];

// Define additional validation checks
const validationChecks = [
  // Check that severity is valid
  (data) => {
    const validSeverities = ['debug', 'info', 'warning', 'error', 'critical'];
    expect(validSeverities).toContain(data.severity);
  }
];

// Create the integration tests
createStreamIntegrationTests('events', EventsStream, requiredFields, validationChecks);

/**
 * Integration tests for the Call Quality stream
 */
const CallQualityStream = require('../../src/streams/call_quality');
const { createStreamIntegrationTests } = require('./base.test');

// Define required fields to verify in records
const requiredFields = [
  'quality_id',
  'timestamp',
  'call_id',
  'channel_id',
  'user_id',
  'app_id',
  'start_time',
  'audio_quality_score',
  'video_quality_score',
  'overall_quality_score'
];

// Define additional validation checks
const validationChecks = [
  // Check that quality scores are in valid range
  (data) => {
    if (data.audio_quality_score !== null) {
      expect(data.audio_quality_score).toBeGreaterThanOrEqual(0);
      expect(data.audio_quality_score).toBeLessThanOrEqual(5);
    }
    if (data.video_quality_score !== null) {
      expect(data.video_quality_score).toBeGreaterThanOrEqual(0);
      expect(data.video_quality_score).toBeLessThanOrEqual(5);
    }
    if (data.overall_quality_score !== null) {
      expect(data.overall_quality_score).toBeGreaterThanOrEqual(0);
      expect(data.overall_quality_score).toBeLessThanOrEqual(5);
    }
  }
];

// Create the integration tests
createStreamIntegrationTests('call_quality', CallQualityStream, requiredFields, validationChecks);

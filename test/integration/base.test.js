/**
 * Base setup for integration tests for the Agora source connector
 * 
 * Note: These tests require valid Agora credentials and will make actual API calls.
 * To run these tests, you need to set the following environment variables:
 * - AGORA_APP_ID: Your Agora App ID
 * - AGORA_CUSTOMER_ID: Your Agora Customer ID
 * - AGORA_CUSTOMER_SECRET: Your Agora Customer Secret
 * - AGORA_ENDPOINT_URL: Your Agora API endpoint URL (optional)
 */

// Check if required environment variables are set
const requiredEnvVars = [
  'AGORA_APP_ID',
  'AGORA_CUSTOMER_ID',
  'AGORA_CUSTOMER_SECRET'
];

// Skip integration tests if environment variables are not set
const missingEnvVars = requiredEnvVars.filter(name => !process.env[name]);
const SKIP_INTEGRATION_TESTS = missingEnvVars.length > 0;

if (SKIP_INTEGRATION_TESTS) {
  console.warn(`Skipping integration tests. Missing environment variables: ${missingEnvVars.join(', ')}`);
}

// Base configuration for integration tests
const baseConfig = {
  app_id: process.env.AGORA_APP_ID,
  customer_id: process.env.AGORA_CUSTOMER_ID,
  customer_secret: process.env.AGORA_CUSTOMER_SECRET,
  endpoint_url: process.env.AGORA_ENDPOINT_URL || 'https://api.agora.io',
  start_date: '2025-01-01'
};

/**
 * Base test suite for stream integration tests
 * @param {String} streamName - Name of the stream
 * @param {Class} StreamClass - Stream class to test
 * @param {Array<String>} requiredFields - Required fields to verify in records
 * @param {Array<String>} validationChecks - Additional validation checks to perform
 */
function createStreamIntegrationTests(streamName, StreamClass, requiredFields, validationChecks = []) {
  describe(`${streamName} Stream Integration Tests`, () => {
    let stream;
    
    beforeEach(() => {
      // Create a new stream instance for each test
      stream = new StreamClass(baseConfig);
      
      // Mock console.log to capture emitted records
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    
    afterEach(() => {
      jest.clearAllMocks();
    });
    
    // Skip all tests if environment variables are not set
    if (SKIP_INTEGRATION_TESTS) {
      it.skip('Integration tests skipped due to missing environment variables', () => {});
      return;
    }
    
    describe('testConnection', () => {
      it('should successfully connect to the Agora API', async () => {
        const result = await stream.testConnection();
        expect(result).toBe(true);
      });
    });
    
    describe('read', () => {
      it(`should fetch and process ${streamName} data from Agora API`, async () => {
        // Set a timeout for this test to allow for API delays
        jest.setTimeout(60000);
        
        // Execute the read method
        const state = await stream.read();
        
        // We can't make strict assertions about the API response, since it depends
        // on the actual data in the Agora instance, but we can verify the structure
        expect(state).toBeDefined();
        
        // Get all the console.log calls
        const calls = console.log.mock.calls;
        
        // Find all emitted records
        const records = calls
          .map(call => {
            try {
              return JSON.parse(call[0]);
            } catch (e) {
              return null;
            }
          })
          .filter(item => item && item.type === 'RECORD');
        
        // Records may be empty if there is no data in the date range
        // But if there are records, check their structure
        if (records.length > 0) {
          // Check that records have the expected structure
          for (const record of records) {
            expect(record.record).toHaveProperty('stream', streamName);
            expect(record.record).toHaveProperty('data');
            
            // Check required fields
            for (const field of requiredFields) {
              expect(record.record.data).toHaveProperty(field);
            }
            
            // Run additional validation checks
            for (const validateFn of validationChecks) {
              validateFn(record.record.data);
            }
          }
          
          // Check if state was emitted
          const stateEmissions = calls
            .map(call => {
              try {
                return JSON.parse(call[0]);
              } catch (e) {
                return null;
              }
            })
            .filter(item => item && item.type === 'STATE');
          
          // Verify that the state was emitted at least once
          expect(stateEmissions.length).toBeGreaterThan(0);
          expect(stateEmissions[0].state.data).toHaveProperty(streamName);
          expect(stateEmissions[0].state.data[streamName]).toHaveProperty('timestamp');
        }
      });
    });
  });
}

module.exports = { 
  SKIP_INTEGRATION_TESTS,
  baseConfig,
  createStreamIntegrationTests
};

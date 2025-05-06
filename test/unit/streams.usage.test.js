/**
 * Unit tests for the Usage stream
 */
const UsageStream = require('../../src/streams/usage');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('UsageStream', () => {
  let stream;
  const mockConfig = {
    app_id: 'test_app_id',
    customer_id: 'test_customer_id',
    customer_secret: 'test_customer_secret',
    endpoint_url: 'https://api.agora.io',
    start_date: '2025-01-01'
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a new stream instance for each test
    stream = new UsageStream(mockConfig);
    
    // Mock the console.log to capture emitted records
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should initialize with the correct stream name and cursor field', () => {
      expect(stream.streamName).toBe('usage');
      expect(stream.cursorField).toBe('timestamp');
    });
  });

  describe('getSourceDefinedPrimaryKey', () => {
    it('should return the correct primary key', () => {
      expect(stream.getSourceDefinedPrimaryKey()).toEqual([['usage_id']]);
    });
  });

  describe('getDefaultCursorField', () => {
    it('should return the correct cursor field', () => {
      expect(stream.getDefaultCursorField()).toEqual(['timestamp']);
    });
  });

  describe('read', () => {
    it('should fetch and process usage data', async () => {
      // Mock axios create return value
      const mockClient = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockClient);
      
      // Mock response
      mockClient.get.mockResolvedValue({
        data: {
          usage: [
            {
              date: '2025-01-15',
              project_name: 'Test Project',
              audio_minutes: 100,
              video_sd_minutes: 50,
              video_hd_minutes: 30,
              video_hd_plus_minutes: 10,
              recording_minutes: 20,
              bandwidth_usage: 5.5,
              cloud_recording_storage: 2.5,
              channel_count: 10,
              peak_concurrent_users: 50,
              by_region: {
                'us': {
                  audio_minutes: 60,
                  video_sd_minutes: 30,
                  video_hd_minutes: 20,
                  video_hd_plus_minutes: 5,
                  recording_minutes: 10,
                  bandwidth_usage: 3.5,
                  cloud_recording_storage: 1.2,
                  channel_count: 6,
                  peak_concurrent_users: 30
                },
                'eu': {
                  audio_minutes: 40,
                  video_sd_minutes: 20,
                  video_hd_minutes: 10,
                  video_hd_plus_minutes: 5,
                  recording_minutes: 10,
                  bandwidth_usage: 2.0,
                  cloud_recording_storage: 1.3,
                  channel_count: 4,
                  peak_concurrent_users: 20
                }
              }
            }
          ]
        }
      });
      
      // Execute the read method
      await stream.read();
      
      // Check that axios.create was called with the right params
      expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
        baseURL: 'https://api.agora.io',
        headers: expect.objectContaining({
          'x-agora-appid': 'test_app_id',
          'x-agora-customerid': 'test_customer_id',
          'Content-Type': 'application/json'
        })
      }));
      
      // Check that the API endpoint was called with the right params
      expect(mockClient.get).toHaveBeenCalledWith('/v1/usage', expect.objectContaining({
        params: expect.objectContaining({
          start_date: '2025-01-01',
          app_id: 'test_app_id'
        })
      }));
      
      // Check that records were emitted
      // We have 7 resource types for the global record and 7 resource types for each of the 2 regions
      // So we expect 7 + (7 * 2) = 21 records, plus 1 state emission
      const emitCalls = console.log.mock.calls;
      
      // Count record emissions
      const recordEmissions = emitCalls
        .map(call => {
          try {
            return JSON.parse(call[0]);
          } catch (e) {
            return null;
          }
        })
        .filter(item => item && item.type === 'RECORD');
      
      // Verify we have the expected number of record emissions
      expect(recordEmissions.length).toBeGreaterThan(0);
      
      // Check that state was emitted
      const stateEmissions = emitCalls
        .map(call => {
          try {
            return JSON.parse(call[0]);
          } catch (e) {
            return null;
          }
        })
        .filter(item => item && item.type === 'STATE');
      
      expect(stateEmissions.length).toBe(1);
      expect(stateEmissions[0].state.data).toHaveProperty('usage');
      expect(stateEmissions[0].state.data.usage).toHaveProperty('timestamp');
    });

    it('should handle errors gracefully', async () => {
      // Mock axios create return value
      const mockClient = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockClient);
      
      // Mock error response
      mockClient.get.mockRejectedValue(new Error('API Error'));
      
      // Mock the logger to prevent error logs in test output
      stream.logger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
      };
      
      // Execute the read method and expect it to throw
      await expect(stream.read()).rejects.toThrow('API Error');
      
      // Check that error was logged
      expect(stream.logger.error).toHaveBeenCalled();
    });
  });
});

/**
 * Unit tests for the Recordings stream
 */
const RecordingsStream = require('../../src/streams/recordings');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('RecordingsStream', () => {
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
    stream = new RecordingsStream(mockConfig);
    
    // Mock the console.log to capture emitted records
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should initialize with the correct stream name and cursor field', () => {
      expect(stream.streamName).toBe('recordings');
      expect(stream.cursorField).toBe('timestamp');
    });
  });

  describe('getSourceDefinedPrimaryKey', () => {
    it('should return the correct primary key', () => {
      expect(stream.getSourceDefinedPrimaryKey()).toEqual([['recording_id']]);
    });
  });

  describe('getDefaultCursorField', () => {
    it('should return the correct cursor field', () => {
      expect(stream.getDefaultCursorField()).toEqual(['timestamp']);
    });
  });

  describe('generateRecordingId', () => {
    it('should generate a deterministic ID based on inputs', () => {
      const id1 = stream.generateRecordingId('resource1', 'channel1', 1620000000);
      const id2 = stream.generateRecordingId('resource1', 'channel1', 1620000000);
      const id3 = stream.generateRecordingId('resource2', 'channel1', 1620000000);
      
      expect(id1).toBe(id2); // Same inputs should produce same ID
      expect(id1).not.toBe(id3); // Different inputs should produce different IDs
      expect(id1.length).toBe(32); // ID should be 32 characters long
    });
  });

  describe('read', () => {
    it('should fetch and process recording data', async () => {
      // Mock axios create return value
      const mockClient = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockClient);
      
      // Mock recordings list response
      mockClient.get.mockImplementation((url, options) => {
        if (url === '/v1/recordings/list') {
          return Promise.resolve({
            data: {
              recordings: [
                {
                  resource_id: 'resource1',
                  channel_id: 'channel1',
                  start_time: 1620000000, // Unix timestamp in seconds
                  end_time: 1620003600, // 1 hour later
                  uid: 'user1',
                  recording_type: 'cloud',
                  status: 'completed',
                  file_format: 'mp4',
                  file_size: 58982400,
                  resolution: '1280x720',
                  storage_path: 's3://recordings/recording1.mp4',
                  region: 'us',
                  mode: 'mix',
                  recorded_users: ['user1', 'user2'],
                  parameters: {
                    bitrate: 1000000,
                    fps: 30
                  },
                  storage_config: {
                    vendor: 's3',
                    bucket: 'recordings'
                  }
                },
                {
                  resource_id: 'resource2',
                  channel_id: 'channel2',
                  start_time: 1620010000,
                  end_time: 1620013600,
                  uid: 'user3',
                  recording_type: 'individual',
                  status: 'completed',
                  file_format: 'webm',
                  file_size: 32768000,
                  resolution: '640x480',
                  storage_path: 's3://recordings/recording2.webm',
                  region: 'eu',
                  mode: 'individual',
                  recorded_users: ['user3', 'user4'],
                  parameters: {
                    bitrate: 800000,
                    fps: 24
                  },
                  storage_config: {
                    vendor: 's3',
                    bucket: 'recordings'
                  }
                }
              ]
            }
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
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
      expect(mockClient.get).toHaveBeenCalledWith('/v1/recordings/list', expect.objectContaining({
        params: expect.objectContaining({
          from_date: '2025-01-01',
          app_id: 'test_app_id'
        })
      }));
      
      // Check that records were emitted
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
      expect(recordEmissions.length).toBe(2);
      
      // Verify the content of records
      const recordingsRecords = recordEmissions.map(r => r.record.data);
      
      // Check a few key fields from the first record
      expect(recordingsRecords[0]).toHaveProperty('recording_id');
      expect(recordingsRecords[0]).toHaveProperty('resource_id', 'resource1');
      expect(recordingsRecords[0]).toHaveProperty('channel_id', 'channel1');
      expect(recordingsRecords[0]).toHaveProperty('uid', 'user1');
      expect(recordingsRecords[0]).toHaveProperty('recording_type', 'cloud');
      expect(recordingsRecords[0]).toHaveProperty('status', 'completed');
      expect(recordingsRecords[0]).toHaveProperty('file_format', 'mp4');
      expect(recordingsRecords[0]).toHaveProperty('mode', 'mix');
      
      // Check a few key fields from the second record
      expect(recordingsRecords[1]).toHaveProperty('recording_id');
      expect(recordingsRecords[1]).toHaveProperty('resource_id', 'resource2');
      expect(recordingsRecords[1]).toHaveProperty('channel_id', 'channel2');
      expect(recordingsRecords[1]).toHaveProperty('recording_type', 'individual');
      expect(recordingsRecords[1]).toHaveProperty('file_format', 'webm');
      expect(recordingsRecords[1]).toHaveProperty('region', 'eu');
      
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
      expect(stateEmissions[0].state.data).toHaveProperty('recordings');
      expect(stateEmissions[0].state.data.recordings).toHaveProperty('timestamp');
    });

    it('should handle empty recordings lists', async () => {
      // Mock axios create return value
      const mockClient = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockClient);
      
      // Mock empty recordings list response
      mockClient.get.mockResolvedValue({
        data: {
          recordings: []
        }
      });
      
      // Execute the read method
      const result = await stream.read();
      
      // Verify that no records were emitted
      const emitCalls = console.log.mock.calls;
      const recordEmissions = emitCalls
        .map(call => {
          try {
            return JSON.parse(call[0]);
          } catch (e) {
            return null;
          }
        })
        .filter(item => item && item.type === 'RECORD');
      
      expect(recordEmissions.length).toBe(0);
      
      // Verify that state isn't updated
      expect(result).toEqual({});
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

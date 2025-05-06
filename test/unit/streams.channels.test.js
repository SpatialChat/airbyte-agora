/**
 * Unit tests for the Channels stream
 */
const ChannelsStream = require('../../src/streams/channels');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('ChannelsStream', () => {
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
    stream = new ChannelsStream(mockConfig);
    
    // Mock the console.log to capture emitted records
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should initialize with the correct stream name and cursor field', () => {
      expect(stream.streamName).toBe('channels');
      expect(stream.cursorField).toBe('timestamp');
    });
  });

  describe('getSourceDefinedPrimaryKey', () => {
    it('should return the correct primary key', () => {
      expect(stream.getSourceDefinedPrimaryKey()).toEqual([['channel_id']]);
    });
  });

  describe('getDefaultCursorField', () => {
    it('should return the correct cursor field', () => {
      expect(stream.getDefaultCursorField()).toEqual(['timestamp']);
    });
  });

  describe('generateChannelId', () => {
    it('should generate a deterministic ID based on inputs', () => {
      const id1 = stream.generateChannelId('channel1', 1620000000, 'app1');
      const id2 = stream.generateChannelId('channel1', 1620000000, 'app1');
      const id3 = stream.generateChannelId('channel2', 1620000000, 'app1');
      
      expect(id1).toBe(id2); // Same inputs should produce same ID
      expect(id1).not.toBe(id3); // Different inputs should produce different IDs
      expect(id1.length).toBe(32); // ID should be 32 characters long
    });
  });

  describe('read', () => {
    it('should fetch and process channel data', async () => {
      // Mock axios create return value
      const mockClient = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockClient);
      
      // Mock channel list response for the first page
      mockClient.get.mockImplementationOnce((url, options) => {
        if (url === '/v1/channel/list') {
          return Promise.resolve({
            data: {
              channels: [
                {
                  channel_id: 'channel1',
                  channel_name: 'Test Channel 1',
                  create_time: 1620000000, // Unix timestamp in seconds
                  end_time: 1620003600, // 1 hour later
                  peak_users: 10,
                  total_users: 15,
                  audio_minutes: 120,
                  video_minutes: 100,
                  recording_minutes: 60,
                  region: 'us',
                  mode: 'communication',
                  encryption_enabled: true,
                  has_recordings: true,
                  quality_score: 4.5,
                  user_join_count: 20,
                  user_leave_count: 15,
                  error_count: 0,
                  channel_type: 'video',
                  tags: ['meeting', 'team'],
                  metadata: {
                    created_by: 'admin',
                    purpose: 'team meeting'
                  }
                },
                {
                  channel_id: 'channel2',
                  channel_name: 'Test Channel 2',
                  create_time: 1620010000,
                  end_time: null, // Still active
                  peak_users: 5,
                  total_users: 8,
                  audio_minutes: 60,
                  video_minutes: 45,
                  recording_minutes: 0,
                  region: 'eu',
                  mode: 'live_broadcasting',
                  encryption_enabled: false,
                  has_recordings: false,
                  quality_score: 4.8,
                  user_join_count: 10,
                  user_leave_count: 5,
                  error_count: 1,
                  channel_type: 'video',
                  tags: ['broadcast'],
                  metadata: {
                    created_by: 'user123',
                    purpose: 'live demo'
                  }
                }
              ]
            }
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
      
      // Mock empty response for the second page to end pagination
      mockClient.get.mockImplementationOnce((url, options) => {
        if (url === '/v1/channel/list') {
          return Promise.resolve({
            data: {
              channels: []
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
      expect(mockClient.get).toHaveBeenCalledWith('/v1/channel/list', expect.objectContaining({
        params: expect.objectContaining({
          from_date: '2025-01-01',
          app_id: 'test_app_id'
        })
      }));
      
      // Check that pagination was handled correctly
      expect(mockClient.get).toHaveBeenCalledTimes(2);
      
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
      const channelsRecords = recordEmissions.map(r => r.record.data);
      
      // Check a few key fields from the first record
      expect(channelsRecords[0]).toHaveProperty('channel_id', 'channel1');
      expect(channelsRecords[0]).toHaveProperty('channel_name', 'Test Channel 1');
      expect(channelsRecords[0]).toHaveProperty('create_time', 1620000000 * 1000); // Should be in ms
      expect(channelsRecords[0]).toHaveProperty('end_time', 1620003600 * 1000); // Should be in ms
      expect(channelsRecords[0]).toHaveProperty('peak_users', 10);
      expect(channelsRecords[0]).toHaveProperty('active_status', false); // Since end_time exists
      expect(channelsRecords[0]).toHaveProperty('mode', 'communication');
      expect(channelsRecords[0]).toHaveProperty('encryption_enabled', true);
      expect(channelsRecords[0]).toHaveProperty('tags').toEqual(['meeting', 'team']);
      
      // Check a few key fields from the second record
      expect(channelsRecords[1]).toHaveProperty('channel_id', 'channel2');
      expect(channelsRecords[1]).toHaveProperty('channel_name', 'Test Channel 2');
      expect(channelsRecords[1]).toHaveProperty('create_time', 1620010000 * 1000); // Should be in ms
      expect(channelsRecords[1]).toHaveProperty('end_time', null); // Still active
      expect(channelsRecords[1]).toHaveProperty('active_status', true); // Since end_time is null
      expect(channelsRecords[1]).toHaveProperty('mode', 'live_broadcasting');
      expect(channelsRecords[1]).toHaveProperty('encryption_enabled', false);
      expect(channelsRecords[1]).toHaveProperty('tags').toEqual(['broadcast']);
      
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
      expect(stateEmissions[0].state.data).toHaveProperty('channels');
      expect(stateEmissions[0].state.data.channels).toHaveProperty('timestamp');
    });

    it('should handle empty channel lists', async () => {
      // Mock axios create return value
      const mockClient = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockClient);
      
      // Mock empty channel list response
      mockClient.get.mockResolvedValue({
        data: {
          channels: []
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

/**
 * Unit tests for the Call Quality stream
 */
const CallQualityStream = require('../../src/streams/call_quality');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('CallQualityStream', () => {
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
    stream = new CallQualityStream(mockConfig);
    
    // Mock the console.log to capture emitted records
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should initialize with the correct stream name and cursor field', () => {
      expect(stream.streamName).toBe('call_quality');
      expect(stream.cursorField).toBe('timestamp');
    });
  });

  describe('getSourceDefinedPrimaryKey', () => {
    it('should return the correct primary key', () => {
      expect(stream.getSourceDefinedPrimaryKey()).toEqual([['quality_id']]);
    });
  });

  describe('getDefaultCursorField', () => {
    it('should return the correct cursor field', () => {
      expect(stream.getDefaultCursorField()).toEqual(['timestamp']);
    });
  });

  describe('generateQualityId', () => {
    it('should generate a deterministic ID based on inputs', () => {
      const id1 = stream.generateQualityId('call1', 'user1', 1620000000000);
      const id2 = stream.generateQualityId('call1', 'user1', 1620000000000);
      const id3 = stream.generateQualityId('call2', 'user1', 1620000000000);
      
      expect(id1).toBe(id2); // Same inputs should produce same ID
      expect(id1).not.toBe(id3); // Different inputs should produce different IDs
      expect(id1.length).toBe(32); // ID should be 32 characters long
    });
  });

  describe('read', () => {
    it('should fetch and process call quality data', async () => {
      // Mock axios create return value
      const mockClient = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockClient);
      
      // Mock call list response
      mockClient.get.mockImplementation((url, options) => {
        if (url === '/v1/call/lists') {
          return Promise.resolve({
            data: {
              calls: [
                {
                  call_id: 'call1',
                  channel_id: 'channel1',
                  start_time: 1620000000, // Unix timestamp in seconds
                  end_time: 1620003600 // 1 hour later
                },
                {
                  call_id: 'call2',
                  channel_id: 'channel2',
                  start_time: 1620010000,
                  end_time: 1620013600
                }
              ]
            }
          });
        } else if (url === '/v1/call/quality') {
          const callId = options.params.call_id;
          if (callId === 'call1') {
            return Promise.resolve({
              data: {
                call_id: 'call1',
                user_metrics: [
                  {
                    user_id: 'user1',
                    latest_metric_time: 1620003600,
                    network_type: 'wifi',
                    device_type: 'Android',
                    sdk_version: '3.5.0',
                    os_version: 'Android 11',
                    region: 'us',
                    audio_quality: 4.5,
                    video_quality: 4.2,
                    overall_quality: 4.3,
                    latency: 120,
                    packet_loss_rate: 0.5,
                    jitter: 15,
                    audio_bitrate: 48,
                    video_bitrate: 600,
                    audio_packet_loss_rate: 0.3,
                    video_packet_loss_rate: 0.7,
                    audio_freeze_count: 0,
                    video_freeze_count: 1,
                    cpu_usage: 35,
                    memory_usage: 15,
                    video_resolution: '640x480',
                    frame_rate: 30,
                    issue_description: '',
                    has_issues: false
                  },
                  {
                    user_id: 'user2',
                    latest_metric_time: 1620003600,
                    network_type: '4g',
                    device_type: 'iOS',
                    sdk_version: '3.5.0',
                    os_version: 'iOS 14',
                    region: 'eu',
                    audio_quality: 4.8,
                    video_quality: 4.0,
                    overall_quality: 4.4,
                    latency: 150,
                    packet_loss_rate: 0.8,
                    jitter: 20,
                    audio_bitrate: 48,
                    video_bitrate: 500,
                    audio_packet_loss_rate: 0.5,
                    video_packet_loss_rate: 1.0,
                    audio_freeze_count: 0,
                    video_freeze_count: 2,
                    cpu_usage: 40,
                    memory_usage: 18,
                    video_resolution: '640x480',
                    frame_rate: 25,
                    issue_description: 'Occasional video freezes',
                    has_issues: true
                  }
                ]
              }
            });
          } else {
            return Promise.resolve({
              data: {
                call_id: 'call2',
                user_metrics: [
                  {
                    user_id: 'user3',
                    latest_metric_time: 1620013600,
                    network_type: 'wifi',
                    device_type: 'Desktop',
                    sdk_version: '3.5.0',
                    os_version: 'Windows 10',
                    region: 'us',
                    audio_quality: 4.9,
                    video_quality: 4.8,
                    overall_quality: 4.85,
                    latency: 90,
                    packet_loss_rate: 0.2,
                    jitter: 10,
                    audio_bitrate: 48,
                    video_bitrate: 800,
                    audio_packet_loss_rate: 0.1,
                    video_packet_loss_rate: 0.3,
                    audio_freeze_count: 0,
                    video_freeze_count: 0,
                    cpu_usage: 25,
                    memory_usage: 12,
                    video_resolution: '1280x720',
                    frame_rate: 30,
                    issue_description: '',
                    has_issues: false
                  }
                ]
              }
            });
          }
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
      
      // Check that the API endpoints were called with the right params
      expect(mockClient.get).toHaveBeenCalledWith('/v1/call/lists', expect.objectContaining({
        params: expect.objectContaining({
          from_date: '2025-01-01',
          app_id: 'test_app_id'
        })
      }));
      
      expect(mockClient.get).toHaveBeenCalledWith('/v1/call/quality', expect.objectContaining({
        params: expect.objectContaining({
          call_id: 'call1',
          app_id: 'test_app_id'
        })
      }));
      
      expect(mockClient.get).toHaveBeenCalledWith('/v1/call/quality', expect.objectContaining({
        params: expect.objectContaining({
          call_id: 'call2',
          app_id: 'test_app_id'
        })
      }));
      
      // Check that records were emitted
      // We have 3 user metrics in total across 2 calls
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
      expect(recordEmissions.length).toBe(3);
      
      // Verify the content of records
      const qualityRecords = recordEmissions.map(r => r.record.data);
      
      // Check a few key fields from the first record
      expect(qualityRecords[0]).toHaveProperty('quality_id');
      expect(qualityRecords[0]).toHaveProperty('call_id', 'call1');
      expect(qualityRecords[0]).toHaveProperty('channel_id', 'channel1');
      expect(qualityRecords[0]).toHaveProperty('user_id', 'user1');
      expect(qualityRecords[0]).toHaveProperty('audio_quality_score', 4.5);
      expect(qualityRecords[0]).toHaveProperty('video_quality_score', 4.2);
      
      // Check a few key fields from the second record
      expect(qualityRecords[1]).toHaveProperty('quality_id');
      expect(qualityRecords[1]).toHaveProperty('call_id', 'call1');
      expect(qualityRecords[1]).toHaveProperty('channel_id', 'channel1');
      expect(qualityRecords[1]).toHaveProperty('user_id', 'user2');
      expect(qualityRecords[1]).toHaveProperty('issue_description', 'Occasional video freezes');
      expect(qualityRecords[1]).toHaveProperty('has_issues', true);
      
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
      expect(stateEmissions[0].state.data).toHaveProperty('call_quality');
      expect(stateEmissions[0].state.data.call_quality).toHaveProperty('timestamp');
    });

    it('should handle empty call lists', async () => {
      // Mock axios create return value
      const mockClient = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockClient);
      
      // Mock empty call list response
      mockClient.get.mockResolvedValue({
        data: {
          calls: []
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

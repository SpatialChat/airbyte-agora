/**
 * Unit tests for the Events stream
 */
const EventsStream = require('../../src/streams/events');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('EventsStream', () => {
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
    stream = new EventsStream(mockConfig);
    
    // Mock the console.log to capture emitted records
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should initialize with the correct stream name and cursor field', () => {
      expect(stream.streamName).toBe('events');
      expect(stream.cursorField).toBe('timestamp');
    });
  });

  describe('getSourceDefinedPrimaryKey', () => {
    it('should return the correct primary key', () => {
      expect(stream.getSourceDefinedPrimaryKey()).toEqual([['event_id']]);
    });
  });

  describe('getDefaultCursorField', () => {
    it('should return the correct cursor field', () => {
      expect(stream.getDefaultCursorField()).toEqual(['timestamp']);
    });
  });

  describe('generateEventId', () => {
    it('should generate a deterministic ID based on inputs', () => {
      const id1 = stream.generateEventId('join', 'channel1', 'user1', 1620000000);
      const id2 = stream.generateEventId('join', 'channel1', 'user1', 1620000000);
      const id3 = stream.generateEventId('leave', 'channel1', 'user1', 1620000000);
      
      expect(id1).toBe(id2); // Same inputs should produce same ID
      expect(id1).not.toBe(id3); // Different inputs should produce different IDs
      expect(id1.length).toBe(32); // ID should be 32 characters long
    });
  });

  describe('read', () => {
    it('should fetch and process event data', async () => {
      // Mock axios create return value
      const mockClient = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockClient);
      
      // Mock events list response for the first page
      mockClient.get.mockImplementationOnce((url, options) => {
        if (url === '/v1/events') {
          return Promise.resolve({
            data: {
              events: [
                {
                  event_id: 'event1',
                  timestamp: 1620000000, // Unix timestamp in seconds
                  event_type: 'join',
                  event_name: 'User Joined',
                  event_description: 'User successfully joined the channel',
                  channel_id: 'channel1',
                  user_id: 'user1',
                  severity: 'info',
                  device_type: 'Android',
                  os_version: 'Android 11',
                  sdk_version: '3.5.0',
                  network_type: 'wifi',
                  client_ip: '192.168.1.1',
                  region: 'us',
                  error_code: null,
                  error_message: null,
                  duration: 0,
                  properties: {
                    browser: 'Chrome',
                    browser_version: '90.0.4430.212'
                  },
                  related_events: [],
                  resolution: null
                },
                {
                  event_id: 'event2',
                  timestamp: 1620003600,
                  event_type: 'error',
                  event_name: 'Connection Error',
                  event_description: 'User experienced a connection error',
                  channel_id: 'channel1',
                  user_id: 'user2',
                  severity: 'error',
                  device_type: 'iOS',
                  os_version: 'iOS 14',
                  sdk_version: '3.5.0',
                  network_type: '4g',
                  client_ip: '192.168.1.2',
                  region: 'us',
                  error_code: 1001,
                  error_message: 'Network disconnected',
                  duration: 5000,
                  properties: {
                    retry_count: 3
                  },
                  related_events: ['event1'],
                  resolution: 'reconnected'
                }
              ]
            }
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
      
      // Mock empty response for the second page to end pagination
      mockClient.get.mockImplementationOnce((url, options) => {
        if (url === '/v1/events') {
          return Promise.resolve({
            data: {
              events: []
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
      expect(mockClient.get).toHaveBeenCalledWith('/v1/events', expect.objectContaining({
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
      const eventsRecords = recordEmissions.map(r => r.record.data);
      
      // Check a few key fields from the first record
      expect(eventsRecords[0]).toHaveProperty('event_id', 'event1');
      expect(eventsRecords[0]).toHaveProperty('event_type', 'join');
      expect(eventsRecords[0]).toHaveProperty('event_name', 'User Joined');
      expect(eventsRecords[0]).toHaveProperty('channel_id', 'channel1');
      expect(eventsRecords[0]).toHaveProperty('user_id', 'user1');
      expect(eventsRecords[0]).toHaveProperty('severity', 'info');
      expect(eventsRecords[0]).toHaveProperty('timestamp', 1620000000 * 1000); // Should be in ms
      
      // Check a few key fields from the second record
      expect(eventsRecords[1]).toHaveProperty('event_id', 'event2');
      expect(eventsRecords[1]).toHaveProperty('event_type', 'error');
      expect(eventsRecords[1]).toHaveProperty('error_code', 1001);
      expect(eventsRecords[1]).toHaveProperty('error_message', 'Network disconnected');
      expect(eventsRecords[1]).toHaveProperty('severity', 'error');
      expect(eventsRecords[1]).toHaveProperty('resolution', 'reconnected');
      
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
      expect(stateEmissions[0].state.data).toHaveProperty('events');
      expect(stateEmissions[0].state.data.events).toHaveProperty('timestamp');
    });

    it('should handle empty event lists', async () => {
      // Mock axios create return value
      const mockClient = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockClient);
      
      // Mock empty event list response
      mockClient.get.mockResolvedValue({
        data: {
          events: []
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

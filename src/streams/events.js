/**
 * Implementation of the Events stream for Agora
 */
const BaseStream = require('./base');
const moment = require('moment');
const crypto = require('crypto');

class EventsStream extends BaseStream {
  constructor(config, streamConfig = {}, state = {}) {
    super(config, streamConfig, state);
    this.streamName = 'events';
    this.cursorField = 'timestamp';
  }

  /**
   * Get the source defined primary key for this stream
   * @returns {Array} The primary key fields as a nested array
   */
  getSourceDefinedPrimaryKey() {
    return [['event_id']];
  }

  /**
   * Get the default cursor field for this stream
   * @returns {Array} The default cursor field
   */
  getDefaultCursorField() {
    return [this.cursorField];
  }

  /**
   * Generate a unique event ID
   * @param {String} eventType - Event type
   * @param {String} channelId - Channel ID
   * @param {String} userId - User ID
   * @param {Number} timestamp - Timestamp
   * @returns {String} The unique event ID
   */
  generateEventId(eventType, channelId, userId, timestamp) {
    const hash = crypto.createHash('sha256');
    hash.update(`${eventType}:${channelId || 'none'}:${userId || 'none'}:${timestamp}`);
    return hash.digest('hex').substring(0, 32);
  }

  /**
   * Read records from the events stream
   */
  async read() {
    const client = this.createClient();
    let state = this.state || {};
    
    try {
      this.emitLog('INFO', `Starting sync for events stream`);
      
      // Determine start date
      let startDate = this.config.start_date;
      if (state[this.cursorField]) {
        // If we have a state, use it as the start date
        startDate = moment(parseInt(state[this.cursorField])).format('YYYY-MM-DD');
      }
      
      const endDate = moment().format('YYYY-MM-DD');
      this.emitLog('INFO', `Fetching events data from ${startDate} to ${endDate}`);
      
      // Set up query parameters
      const params = {
        from_date: startDate,
        to_date: endDate,
        app_id: this.config.app_id,
        limit: 100,
        order: 'desc'
      };
      
      // Get list of events
      const eventsResponse = await client.get('/v1/events', { params });
      const events = eventsResponse.data?.events || [];
      
      if (events.length === 0) {
        this.emitLog('INFO', 'No events found for the specified time period');
        return state;
      }
      
      let latestTimestamp = state[this.cursorField] || 0;
      let page = 1;
      let hasMorePages = true;
      
      // Process events with pagination
      while (hasMorePages) {
        // Update pagination parameters
        params.page = page;
        
        const eventsResponse = page === 1 
          ? { data: { events } } // Use the already fetched events for first page
          : await client.get('/v1/events', { params });
        
        const pageEvents = eventsResponse.data?.events || [];
        
        if (pageEvents.length === 0) {
          hasMorePages = false;
          break;
        }
        
        // Process each event
        for (const event of pageEvents) {
          const eventType = event.event_type || 'info';
          const channelId = event.channel_id || null;
          const userId = event.user_id || null;
          const eventTime = event.timestamp || Math.floor(Date.now() / 1000);
          
          // Convert to milliseconds for timestamp
          const timestamp = eventTime * 1000;
          
          // Skip events that are older than our state
          if (timestamp <= latestTimestamp && latestTimestamp > 0) {
            continue;
          }
          
          // Generate or use the event ID
          const eventId = event.event_id || this.generateEventId(eventType, channelId, userId, eventTime);
          
          // Create the event record
          const record = {
            event_id: eventId,
            timestamp,
            app_id: this.config.app_id,
            channel_id: channelId,
            user_id: userId,
            event_type: eventType,
            event_name: event.event_name || '',
            event_description: event.event_description || '',
            severity: event.severity || 'info',
            device_type: event.device_type || null,
            os_version: event.os_version || null,
            sdk_version: event.sdk_version || null,
            network_type: event.network_type || null,
            client_ip: event.client_ip || null,
            region: event.region || null,
            error_code: event.error_code || null,
            error_message: event.error_message || null,
            duration: event.duration || null,
            properties: event.properties || {},
            related_events: event.related_events || [],
            resolution: event.resolution || null
          };
          
          // Emit the record
          this.emitRecord(record);
          
          // Update latest timestamp for state
          if (timestamp > latestTimestamp) {
            latestTimestamp = timestamp;
          }
        }
        
        // Check if there are more pages
        hasMorePages = pageEvents.length === params.limit;
        page += 1;
      }
      
      // Update and emit state
      if (latestTimestamp > 0) {
        state = { [this.cursorField]: latestTimestamp };
        this.emitState(state);
      }
      
      this.emitLog('INFO', `Completed sync for events stream`);
      return state;
      
    } catch (error) {
      this.emitLog('ERROR', `Error syncing events: ${error.message}`);
      throw error;
    }
  }
}

module.exports = EventsStream;

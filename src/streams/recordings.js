/**
 * Implementation of the Recordings stream for Agora
 */
const BaseStream = require('./base');
const moment = require('moment');
const crypto = require('crypto');

class RecordingsStream extends BaseStream {
  constructor(config, streamConfig = {}, state = {}) {
    super(config, streamConfig, state);
    this.streamName = 'recordings';
    this.cursorField = 'timestamp';
  }

  /**
   * Get the source defined primary key for this stream
   * @returns {Array} The primary key fields as a nested array
   */
  getSourceDefinedPrimaryKey() {
    return [['recording_id']];
  }

  /**
   * Get the default cursor field for this stream
   * @returns {Array} The default cursor field
   */
  getDefaultCursorField() {
    return [this.cursorField];
  }

  /**
   * Generate a unique recording ID
   * @param {String} resourceId - Resource ID
   * @param {String} channelId - Channel ID
   * @param {Number} startTime - Start timestamp
   * @returns {String} The unique recording ID
   */
  generateRecordingId(resourceId, channelId, startTime) {
    const hash = crypto.createHash('sha256');
    hash.update(`${resourceId}:${channelId}:${startTime}`);
    return hash.digest('hex').substring(0, 32);
  }

  /**
   * Read records from the recordings stream
   */
  async read() {
    const client = this.createClient();
    let state = this.state || {};
    
    try {
      this.emitLog('INFO', `Starting sync for recordings stream`);
      
      // Determine start date
      let startDate = this.config.start_date;
      if (state[this.cursorField]) {
        // If we have a state, use it as the start date
        startDate = moment(parseInt(state[this.cursorField])).format('YYYY-MM-DD');
      }
      
      const endDate = moment().format('YYYY-MM-DD');
      this.emitLog('INFO', `Fetching recording data from ${startDate} to ${endDate}`);
      
      // Set up query parameters
      const params = {
        from_date: startDate,
        to_date: endDate,
        app_id: this.config.app_id,
        limit: 100,
        order: 'desc'
      };
      
      // Get list of recordings
      const recordingsResponse = await client.get('/v1/recordings/list', { params });
      const recordings = recordingsResponse.data?.recordings || [];
      
      if (recordings.length === 0) {
        this.emitLog('INFO', 'No recordings found for the specified time period');
        return state;
      }
      
      let latestTimestamp = state[this.cursorField] || 0;
      
      // Process each recording
      for (const recording of recordings) {
        const resourceId = recording.resource_id || '';
        const channelId = recording.channel_id || '';
        const startTime = recording.start_time || Math.floor(Date.now() / 1000);
        const endTime = recording.end_time || Math.floor(Date.now() / 1000);
        
        // Convert to milliseconds for timestamp
        const timestamp = startTime * 1000;
        
        // Skip recordings that are older than our state
        if (timestamp <= latestTimestamp && latestTimestamp > 0) {
          continue;
        }
        
        // Generate a unique ID for this recording
        const recordingId = this.generateRecordingId(resourceId, channelId, startTime);
        
        // Create the recording record
        const record = {
          recording_id: recordingId,
          timestamp,
          app_id: this.config.app_id,
          channel_id: channelId,
          uid: recording.uid || '',
          start_time: startTime * 1000,
          end_time: endTime * 1000,
          duration: endTime - startTime,
          recording_type: recording.recording_type || 'cloud',
          status: recording.status || 'completed',
          file_format: recording.file_format || 'mp4',
          file_size: recording.file_size || 0,
          resolution: recording.resolution || '',
          storage_path: recording.storage_path || '',
          resource_id: resourceId,
          region: recording.region || 'global',
          error_code: recording.error_code || null,
          error_message: recording.error_message || null,
          parameters: recording.parameters || {},
          mode: recording.mode || 'mix',
          recorded_users: recording.recorded_users || [],
          storage_config: recording.storage_config || {}
        };
        
        // Emit the record
        this.emitRecord(record);
        
        // Update latest timestamp for state
        if (timestamp > latestTimestamp) {
          latestTimestamp = timestamp;
        }
      }
      
      // Update and emit state
      if (latestTimestamp > 0) {
        state = { [this.cursorField]: latestTimestamp };
        this.emitState(state);
      }
      
      this.emitLog('INFO', `Completed sync for recordings stream`);
      return state;
      
    } catch (error) {
      this.emitLog('ERROR', `Error syncing recordings: ${error.message}`);
      throw error;
    }
  }
}

module.exports = RecordingsStream;

/**
 * Implementation of the Call Quality stream for Agora
 */
const BaseStream = require('./base');
const moment = require('moment');
const crypto = require('crypto');

class CallQualityStream extends BaseStream {
  constructor(config, streamConfig = {}, state = {}) {
    super(config, streamConfig, state);
    this.streamName = 'call_quality';
    this.cursorField = 'timestamp';
  }

  /**
   * Get the source defined primary key for this stream
   * @returns {Array} The primary key fields as a nested array
   */
  getSourceDefinedPrimaryKey() {
    return [['quality_id']];
  }

  /**
   * Get the default cursor field for this stream
   * @returns {Array} The default cursor field
   */
  getDefaultCursorField() {
    return [this.cursorField];
  }

  /**
   * Generate a unique quality ID
   * @param {String} callId - Call ID
   * @param {String} userId - User ID
   * @param {Number} timestamp - Timestamp
   * @returns {String} The unique quality ID
   */
  generateQualityId(callId, userId, timestamp) {
    const hash = crypto.createHash('sha256');
    hash.update(`${callId}:${userId}:${timestamp}`);
    return hash.digest('hex').substring(0, 32);
  }

  /**
   * Read records from the call quality stream
   */
  async read() {
    const client = this.createClient();
    let state = this.state || {};
    
    try {
      this.emitLog('INFO', `Starting sync for call quality stream`);
      
      // Determine start date
      let startDate = this.config.start_date;
      if (state[this.cursorField]) {
        // If we have a state, use it as the start date
        startDate = moment(parseInt(state[this.cursorField])).format('YYYY-MM-DD');
      }
      
      const endDate = moment().format('YYYY-MM-DD');
      this.emitLog('INFO', `Fetching call quality data from ${startDate} to ${endDate}`);
      
      // Set up query parameters
      const params = {
        from_date: startDate,
        to_date: endDate,
        app_id: this.config.app_id,
        limit: 100,
        order: 'desc'
      };
      
      // Get list of calls first
      const callsResponse = await client.get('/v1/call/lists', { params });
      const calls = callsResponse.data?.calls || [];
      
      if (calls.length === 0) {
        this.emitLog('INFO', 'No calls found for the specified time period');
        return state;
      }
      
      let latestTimestamp = state[this.cursorField] || 0;
      
      // Process each call to get quality metrics
      for (const call of calls) {
        const callId = call.call_id;
        const channelId = call.channel_id;
        const callStartTime = call.start_time;
        const callEndTime = call.end_time || Math.floor(Date.now() / 1000);
        
        // Skip calls that are older than our state
        if (callEndTime * 1000 <= latestTimestamp && latestTimestamp > 0) {
          continue;
        }
        
        // Get quality metrics for this call
        const qualityParams = {
          call_id: callId,
          app_id: this.config.app_id
        };
        
        const qualityResponse = await client.get('/v1/call/quality', { params: qualityParams });
        const qualityData = qualityResponse.data || {};
        
        // Process user quality metrics
        const userMetrics = qualityData.user_metrics || [];
        for (const user of userMetrics) {
          const userId = user.user_id;
          
          // Calculate timestamp for this record (use the latest metric time or call end time)
          const timestamp = (user.latest_metric_time || callEndTime) * 1000;
          
          // Skip records older than our state
          if (timestamp <= latestTimestamp && latestTimestamp > 0) {
            continue;
          }
          
          // Create the quality record
          const record = {
            quality_id: this.generateQualityId(callId, userId, timestamp),
            timestamp,
            channel_id: channelId,
            call_id: callId,
            user_id: userId,
            app_id: this.config.app_id,
            start_time: callStartTime * 1000,
            end_time: callEndTime * 1000,
            duration: callEndTime - callStartTime,
            network_type: user.network_type || '',
            device_type: user.device_type || '',
            sdk_version: user.sdk_version || '',
            os_version: user.os_version || '',
            region: user.region || '',
            audio_quality_score: user.audio_quality || 0,
            video_quality_score: user.video_quality || 0,
            overall_quality_score: user.overall_quality || 0,
            latency: user.latency || 0,
            packet_loss_rate: user.packet_loss_rate || 0,
            jitter: user.jitter || 0,
            audio_bitrate: user.audio_bitrate || 0,
            video_bitrate: user.video_bitrate || 0,
            audio_packet_loss_rate: user.audio_packet_loss_rate || 0,
            video_packet_loss_rate: user.video_packet_loss_rate || 0,
            audio_freeze_count: user.audio_freeze_count || 0,
            video_freeze_count: user.video_freeze_count || 0,
            cpu_usage: user.cpu_usage || 0,
            memory_usage: user.memory_usage || 0,
            video_resolution: user.video_resolution || '',
            frame_rate: user.frame_rate || 0,
            issue_description: user.issue_description || '',
            has_issues: !!user.has_issues
          };
          
          // Emit the record
          this.emitRecord(record);
          
          // Update latest timestamp for state
          if (timestamp > latestTimestamp) {
            latestTimestamp = timestamp;
          }
        }
      }
      
      // Update and emit state
      if (latestTimestamp > 0) {
        state = { [this.cursorField]: latestTimestamp };
        this.emitState(state);
      }
      
      this.emitLog('INFO', `Completed sync for call quality stream`);
      return state;
      
    } catch (error) {
      this.emitLog('ERROR', `Error syncing call quality: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CallQualityStream;

/**
 * Implementation of the Channels stream for Agora
 */
const BaseStream = require('./base');
const moment = require('moment');
const crypto = require('crypto');

class ChannelsStream extends BaseStream {
  constructor(config, streamConfig = {}, state = {}) {
    super(config, streamConfig, state);
    this.streamName = 'channels';
    this.cursorField = 'timestamp';
  }

  /**
   * Get the source defined primary key for this stream
   * @returns {Array} The primary key fields as a nested array
   */
  getSourceDefinedPrimaryKey() {
    return [['channel_id']];
  }

  /**
   * Get the default cursor field for this stream
   * @returns {Array} The default cursor field
   */
  getDefaultCursorField() {
    return [this.cursorField];
  }

  /**
   * Generate a unique channel ID if one is not provided
   * @param {String} channelName - Channel name
   * @param {Number} createTime - Creation timestamp
   * @param {String} appId - App ID
   * @returns {String} The unique channel ID
   */
  generateChannelId(channelName, createTime, appId) {
    const hash = crypto.createHash('sha256');
    hash.update(`${channelName}:${createTime}:${appId}`);
    return hash.digest('hex').substring(0, 32);
  }

  /**
   * Read records from the channels stream
   */
  async read() {
    const client = this.createClient();
    let state = this.state || {};
    
    try {
      this.emitLog('INFO', `Starting sync for channels stream`);
      
      // Determine start date
      let startDate = this.config.start_date;
      if (state[this.cursorField]) {
        // If we have a state, use it as the start date
        startDate = moment(parseInt(state[this.cursorField])).format('YYYY-MM-DD');
      }
      
      const endDate = moment().format('YYYY-MM-DD');
      this.emitLog('INFO', `Fetching channel data from ${startDate} to ${endDate}`);
      
      // Set up query parameters
      const params = {
        from_date: startDate,
        to_date: endDate,
        app_id: this.config.app_id,
        limit: 100,
        order: 'desc'
      };
      
      // Get list of channels
      const channelsResponse = await client.get('/v1/channel/list', { params });
      const channels = channelsResponse.data?.channels || [];
      
      if (channels.length === 0) {
        this.emitLog('INFO', 'No channels found for the specified time period');
        return state;
      }
      
      let latestTimestamp = state[this.cursorField] || 0;
      let page = 1;
      let hasMorePages = true;
      
      // Process channels with pagination
      while (hasMorePages) {
        // Update pagination parameters
        params.page = page;
        
        const channelsResponse = page === 1 
          ? { data: { channels } } // Use the already fetched channels for first page
          : await client.get('/v1/channel/list', { params });
        
        const pageChannels = channelsResponse.data?.channels || [];
        
        if (pageChannels.length === 0) {
          hasMorePages = false;
          break;
        }
        
        // Process each channel
        for (const channel of pageChannels) {
          const channelName = channel.channel_name || '';
          const createTime = channel.create_time || Math.floor(Date.now() / 1000);
          const endTime = channel.end_time || null;
          
          // Convert to milliseconds for timestamp
          const timestamp = createTime * 1000;
          
          // Skip channels that are older than our state
          if (timestamp <= latestTimestamp && latestTimestamp > 0) {
            continue;
          }
          
          // Generate or use the channel ID
          const channelId = channel.channel_id || this.generateChannelId(channelName, createTime, this.config.app_id);
          
          // Create the channel record
          const record = {
            channel_id: channelId,
            timestamp,
            app_id: this.config.app_id,
            channel_name: channelName,
            create_time: timestamp,
            end_time: endTime ? endTime * 1000 : null,
            duration: endTime ? endTime - createTime : Math.floor(Date.now() / 1000) - createTime,
            active_status: endTime === null || endTime > Math.floor(Date.now() / 1000),
            peak_users: channel.peak_users || 0,
            total_users: channel.total_users || 0,
            audio_minutes: channel.audio_minutes || 0,
            video_minutes: channel.video_minutes || 0,
            recording_minutes: channel.recording_minutes || 0,
            region: channel.region || 'global',
            mode: channel.mode || 'communication',
            encryption_enabled: !!channel.encryption_enabled,
            has_recordings: !!channel.has_recordings,
            quality_score: channel.quality_score || 0,
            user_join_count: channel.user_join_count || 0,
            user_leave_count: channel.user_leave_count || 0,
            error_count: channel.error_count || 0,
            channel_type: channel.channel_type || 'video',
            tags: channel.tags || [],
            metadata: channel.metadata || {}
          };
          
          // Emit the record
          this.emitRecord(record);
          
          // Update latest timestamp for state
          if (timestamp > latestTimestamp) {
            latestTimestamp = timestamp;
          }
        }
        
        // Check if there are more pages
        hasMorePages = pageChannels.length === params.limit;
        page += 1;
      }
      
      // Update and emit state
      if (latestTimestamp > 0) {
        state = { [this.cursorField]: latestTimestamp };
        this.emitState(state);
      }
      
      this.emitLog('INFO', `Completed sync for channels stream`);
      return state;
      
    } catch (error) {
      this.emitLog('ERROR', `Error syncing channels: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ChannelsStream;

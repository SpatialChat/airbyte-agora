/**
 * Implementation of the Usage stream for Agora
 */
const BaseStream = require('./base');
const moment = require('moment');
const crypto = require('crypto');

class UsageStream extends BaseStream {
  constructor(config, streamConfig = {}, state = {}) {
    super(config, streamConfig, state);
    this.streamName = 'usage';
    this.cursorField = 'timestamp';
  }

  /**
   * Get the source defined primary key for this stream
   * @returns {Array} The primary key fields as a nested array
   */
  getSourceDefinedPrimaryKey() {
    return [['usage_id']];
  }

  /**
   * Get the default cursor field for this stream
   * @returns {Array} The default cursor field
   */
  getDefaultCursorField() {
    return [this.cursorField];
  }

  /**
   * Generate a unique usage ID
   * @param {String} appId - App ID
   * @param {String} date - Date string
   * @param {String} resourceType - Resource type
   * @param {String} region - Region (optional)
   * @returns {String} The unique usage ID
   */
  generateUsageId(appId, date, resourceType, region = 'global') {
    const hash = crypto.createHash('sha256');
    hash.update(`${appId}:${date}:${resourceType}:${region}`);
    return hash.digest('hex').substring(0, 32);
  }

  /**
   * Read records from the usage stream
   */
  async read() {
    const client = this.createClient();
    let state = this.state || {};
    
    try {
      this.emitLog('INFO', `Starting sync for usage stream`);
      
      // Determine start date
      let startDate = this.config.start_date;
      if (state[this.cursorField]) {
        // If we have a state, use it as the start date
        startDate = moment(state[this.cursorField]).format('YYYY-MM-DD');
      }
      
      const endDate = moment().format('YYYY-MM-DD');
      this.emitLog('INFO', `Fetching usage data from ${startDate} to ${endDate}`);
      
      // Set up query parameters
      const params = {
        start_date: startDate,
        end_date: endDate,
        app_id: this.config.app_id
      };
      
      // Make API request to get usage data
      // Note: Adjust the endpoint path as per Agora's actual API documentation
      const response = await client.get('/v1/usage', { params });
      const usageData = response.data || {};
      
      let latestTimestamp = state[this.cursorField] || 0;
      
      // Process daily usage
      const dailyUsage = usageData.usage || [];
      for (const dayUsage of dailyUsage) {
        const date = dayUsage.date;
        const dateObj = moment(date, 'YYYY-MM-DD');
        const timestamp = dateObj.valueOf(); // Convert to milliseconds
        
        // Skip records older than our state
        if (timestamp <= latestTimestamp && latestTimestamp > 0) {
          continue;
        }
        
        // Create usage records by resource type
        const resourceTypes = [
          { type: 'audio_minutes', value: dayUsage.audio_minutes || 0, unit: 'minutes' },
          { type: 'video_sd_minutes', value: dayUsage.video_sd_minutes || 0, unit: 'minutes' },
          { type: 'video_hd_minutes', value: dayUsage.video_hd_minutes || 0, unit: 'minutes' },
          { type: 'video_hd_plus_minutes', value: dayUsage.video_hd_plus_minutes || 0, unit: 'minutes' },
          { type: 'recording_minutes', value: dayUsage.recording_minutes || 0, unit: 'minutes' },
          { type: 'bandwidth_usage', value: dayUsage.bandwidth_usage || 0, unit: 'GB' },
          { type: 'cloud_recording_storage', value: dayUsage.cloud_recording_storage || 0, unit: 'GB' }
        ];
        
        // Process usage by region if available
        const regions = dayUsage.by_region || {};
        for (const region in regions) {
          const regionData = regions[region];
          
          for (const resource of resourceTypes) {
            // Only emit if we have data for this resource in this region
            if (regionData[resource.type] && regionData[resource.type] > 0) {
              const record = {
                usage_id: this.generateUsageId(this.config.app_id, date, resource.type, region),
                timestamp,
                date,
                app_id: this.config.app_id,
                project_name: dayUsage.project_name || '',
                resource_type: resource.type,
                unit: resource.unit,
                quantity: regionData[resource.type] || 0,
                audio_minutes: regionData.audio_minutes || 0,
                video_sd_minutes: regionData.video_sd_minutes || 0,
                video_hd_minutes: regionData.video_hd_minutes || 0,
                video_hd_plus_minutes: regionData.video_hd_plus_minutes || 0,
                recording_minutes: regionData.recording_minutes || 0,
                bandwidth_usage: regionData.bandwidth_usage || 0,
                cloud_recording_storage: regionData.cloud_recording_storage || 0,
                channel_count: regionData.channel_count || 0,
                peak_concurrent_users: regionData.peak_concurrent_users || 0,
                region
              };
              
              // Emit the record
              this.emitRecord(record);
            }
          }
        }
        
        // Also emit global usage records
        for (const resource of resourceTypes) {
          // Only emit if we have data for this resource
          if (dayUsage[resource.type] && dayUsage[resource.type] > 0) {
            const record = {
              usage_id: this.generateUsageId(this.config.app_id, date, resource.type),
              timestamp,
              date,
              app_id: this.config.app_id,
              project_name: dayUsage.project_name || '',
              resource_type: resource.type,
              unit: resource.unit,
              quantity: dayUsage[resource.type] || 0,
              audio_minutes: dayUsage.audio_minutes || 0,
              video_sd_minutes: dayUsage.video_sd_minutes || 0,
              video_hd_minutes: dayUsage.video_hd_minutes || 0,
              video_hd_plus_minutes: dayUsage.video_hd_plus_minutes || 0,
              recording_minutes: dayUsage.recording_minutes || 0,
              bandwidth_usage: dayUsage.bandwidth_usage || 0,
              cloud_recording_storage: dayUsage.cloud_recording_storage || 0,
              channel_count: dayUsage.channel_count || 0,
              peak_concurrent_users: dayUsage.peak_concurrent_users || 0,
              region: 'global'
            };
            
            // Emit the record
            this.emitRecord(record);
          }
        }
        
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
      
      this.emitLog('INFO', `Completed sync for usage stream`);
      return state;
      
    } catch (error) {
      this.emitLog('ERROR', `Error syncing usage: ${error.message}`);
      throw error;
    }
  }
}

module.exports = UsageStream;

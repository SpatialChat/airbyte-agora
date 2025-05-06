/**
 * Logger utility for the Agora connector
 */
const winston = require('winston');

/**
 * Creates a Winston logger with the specified log level
 * @param {string} level - Log level (default: 'info')
 * @returns {Object} Winston logger
 */
function createLogger(level = 'info') {
  return winston.createLogger({
    level: level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

}

// Create default logger
const defaultLogger = createLogger();

// Set up global error handlers
process.on('uncaughtException', (error) => {
  defaultLogger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  defaultLogger.error('Unhandled promise rejection:', reason);
});

// Export logger and factory function
module.exports = defaultLogger;
module.exports.createLogger = createLogger;

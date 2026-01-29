/**
 * Logging utility with configurable log levels
 *
 * Usage:
 *   import logger from './utils/logger'
 *   logger.debug('Detailed debug info')
 *   logger.info('General information')
 *   logger.warn('Warning message')
 *   logger.error('Error message')
 *
 * To change log level in browser console:
 *   localStorage.setItem('LOG_LEVEL', 'DEBUG')  // Show all logs
 *   localStorage.setItem('LOG_LEVEL', 'INFO')   // Default, show info and above
 *   localStorage.setItem('LOG_LEVEL', 'WARN')   // Only warnings and errors
 *   localStorage.setItem('LOG_LEVEL', 'ERROR')  // Only errors
 *   localStorage.setItem('LOG_LEVEL', 'OFF')    // Disable all logs
 *
 * Then refresh the page.
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  OFF: 4
}

class Logger {
  constructor() {
    // Get log level from localStorage (browser) or environment (Node.js), default to INFO
    // In Node.js, default to OFF for silent operation
    const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined'
    const savedLevel = isBrowser ? localStorage.getItem('LOG_LEVEL') : (process.env.LOG_LEVEL || 'OFF')
    this.level = LOG_LEVELS[savedLevel] !== undefined ? LOG_LEVELS[savedLevel] : LOG_LEVELS.INFO

    // Show current log level on startup (only in browser dev mode)
    if (isBrowser && typeof import.meta.env !== 'undefined' && import.meta.env.DEV && this.level !== LOG_LEVELS.OFF) {
      console.log(`[Logger] Log level: ${this.getLevelName()} (change with localStorage.setItem('LOG_LEVEL', 'DEBUG|INFO|WARN|ERROR|OFF'))`)
    }
  }

  getLevelName() {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === this.level)
  }

  debug(...args) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.log('[DEBUG]', ...args)
    }
  }

  info(...args) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log('[INFO]', ...args)
    }
  }

  warn(...args) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn('[WARN]', ...args)
    }
  }

  error(...args) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error('[ERROR]', ...args)
    }
  }

  setLevel(level) {
    const upperLevel = level.toUpperCase()
    if (LOG_LEVELS[upperLevel] !== undefined) {
      this.level = LOG_LEVELS[upperLevel]
      const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined'
      if (isBrowser) {
        localStorage.setItem('LOG_LEVEL', upperLevel)
      }
      console.log(`[Logger] Log level changed to: ${upperLevel}`)
    } else {
      console.error(`[Logger] Invalid log level: ${level}. Use DEBUG, INFO, WARN, ERROR, or OFF`)
    }
  }
}

// Export singleton instance
const logger = new Logger()
export default logger

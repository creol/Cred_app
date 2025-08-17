const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

class Logger {
  constructor(config) {
    this.config = config;
    this.logsDir = config.getLogsDir();
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;
    
    this.ensureLogsDirectory();
  }

  ensureLogsDirectory() {
    try {
      fs.ensureDirSync(this.logsDir);
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  getLogFilePath(level = 'app') {
    const date = moment().format('YYYY-MM-DD');
    return path.join(this.logsDir, `${level}-${date}.log`);
  }

  async rotateLogs(logFilePath) {
    try {
      if (await fs.pathExists(logFilePath)) {
        const stats = await fs.stat(logFilePath);
        if (stats.size > this.maxLogSize) {
          const dir = path.dirname(logFilePath);
          const ext = path.extname(logFilePath);
          const base = path.basename(logFilePath, ext);
          
          // Remove oldest log file if we have too many
          const logFiles = await fs.readdir(dir);
          const levelLogs = logFiles.filter(f => f.startsWith(base) && f.endsWith(ext));
          
          if (levelLogs.length >= this.maxLogFiles) {
            const oldestLog = levelLogs.sort()[0];
            await fs.remove(path.join(dir, oldestLog));
          }
          
          // Rename current log file
          const timestamp = moment().format('HH-mm-ss');
          const newName = `${base}-${timestamp}${ext}`;
          await fs.move(logFilePath, path.join(dir, newName));
        }
      }
    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  async writeToFile(logFilePath, formattedMessage) {
    try {
      await this.rotateLogs(logFilePath);
      await fs.appendFile(logFilePath, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(level, message, meta = {}) {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Console output
    const consoleMethod = level === 'error' ? 'error' : 
                         level === 'warn' ? 'warn' : 
                         level === 'info' ? 'info' : 'log';
    
    console[consoleMethod](formattedMessage);
    
    // File output
    const logFilePath = this.getLogFilePath(level);
    this.writeToFile(logFilePath, formattedMessage);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  // Specialized logging methods
  logEvent(eventType, eventData = {}) {
    this.info(`Event: ${eventType}`, {
      type: 'event',
      eventType,
      ...eventData
    });
  }

  logCredentialing(contactId, action, details = {}) {
    this.info(`Credentialing: ${action}`, {
      type: 'credentialing',
      contactId,
      action,
      ...details
    });
  }

  logPrinting(contactId, templateId, details = {}) {
    this.info(`Printing: ${templateId}`, {
      type: 'printing',
      contactId,
      templateId,
      ...details
    });
  }

  logTemplateAction(action, templateId, details = {}) {
    this.info(`Template: ${action}`, {
      type: 'template',
      action,
      templateId,
      ...details
    });
  }

  logCSVImport(fileName, recordCount, details = {}) {
    this.info(`CSV Import: ${fileName}`, {
      type: 'csv_import',
      fileName,
      recordCount,
      ...details
    });
  }

  logExport(eventName, recordCount, details = {}) {
    this.info(`Export: ${eventName}`, {
      type: 'export',
      eventName,
      recordCount,
      ...details
    });
  }

  // Performance logging
  logPerformance(operation, duration, details = {}) {
    this.debug(`Performance: ${operation}`, {
      type: 'performance',
      operation,
      duration,
      ...details
    });
  }

  // Error logging with stack traces
  logError(error, context = {}) {
    this.error(error.message, {
      type: 'error',
      stack: error.stack,
      name: error.name,
      ...context
    });
  }

  // Get recent logs for display
  async getRecentLogs(level = 'app', limit = 100) {
    try {
      const logFilePath = this.getLogFilePath(level);
      if (await fs.pathExists(logFilePath)) {
        const content = await fs.readFile(logFilePath, 'utf8');
        const lines = content.trim().split('\n').reverse();
        return lines.slice(0, limit).map(line => {
          try {
            // Parse log line format: [timestamp] [LEVEL] message {meta}
            const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+?)( \{.*\})?$/);
            if (match) {
              return {
                timestamp: match[1],
                level: match[2],
                message: match[3],
                meta: match[4] ? JSON.parse(match[4]) : {}
              };
            }
            return { raw: line };
          } catch (e) {
            return { raw: line };
          }
        });
      }
      return [];
    } catch (error) {
      this.error('Failed to read recent logs', { error: error.message });
      return [];
    }
  }

  // Clear old log files
  async cleanupOldLogs(daysToKeep = 30) {
    try {
      const files = await fs.readdir(this.logsDir);
      const cutoffDate = moment().subtract(daysToKeep, 'days');
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.logsDir, file);
          const stats = await fs.stat(filePath);
          const fileDate = moment(stats.mtime);
          
          if (fileDate.isBefore(cutoffDate)) {
            await fs.remove(filePath);
            this.info(`Cleaned up old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      this.error('Failed to cleanup old logs', { error: error.message });
    }
  }
}

module.exports = Logger;

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class Config {
  constructor() {
    this.configFile = this.getConfigPath();
    this.config = this.loadConfig();
  }

  getConfigPath() {
    const appDir = this.getAppDir();
    return path.join(appDir, 'config', 'app.json');
  }

  getAppDir() {
    if (process.platform === 'win32') {
      return path.join(process.env.USERPROFILE, 'CredentialsApp');
    }
    return path.join(os.homedir(), 'CredentialsApp');
  }

  getDataDir() {
    return path.join(this.getAppDir(), 'data');
  }

  getTemplatesDir() {
    return path.join(this.getAppDir(), 'templates');
  }

  getExportsDir() {
    return path.join(this.getAppDir(), 'exports');
  }

  getLogsDir() {
    return path.join(this.getAppDir(), 'logs');
  }

  getCacheDir() {
    return path.join(this.getAppDir(), 'cache');
  }

  getUploadsDir() {
    return path.join(this.getDataDir(), 'uploads');
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const configData = fs.readJsonSync(this.configFile);
        return this.mergeWithDefaults(configData);
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error.message);
    }

    return this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      appName: 'Credentialing App',
      version: '1.0.0',
      port: 3000,
      printer: {
        type: 'Comer RX106HD',
        labelSize: '4x6',
        foldOver: true,
        width: 4,
        height: 6,
        dpi: 203
      },
      paths: {
        appDir: this.getAppDir(),
        dataDir: this.getDataDir(),
        templatesDir: this.getTemplatesDir(),
        exportsDir: this.getExportsDir(),
        logsDir: this.getLogsDir(),
        cacheDir: this.getCacheDir(),
        uploadsDir: this.getUploadsDir()
      },
      github: {
        enabled: false,
        repo: '',
        branch: 'main',
        path: 'templates',
        token: '',
        username: ''
      },
      search: {
        maxResults: 50,
        fuzzyThreshold: 0.6,
        debounceMs: 250
      },
      performance: {
        maxContacts: 10000,
        searchTimeoutMs: 250,
        previewTimeoutMs: 100,
        printTimeoutMs: 1000
      }
    };
  }

  mergeWithDefaults(userConfig) {
    const defaults = this.getDefaultConfig();
    return this.deepMerge(defaults, userConfig);
  }

  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  async saveConfig() {
    try {
      await fs.ensureDir(path.dirname(this.configFile));
      await fs.writeJson(this.configFile, this.config, { spaces: 2 });
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      return false;
    }
  }

  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
    this.saveConfig();
  }

  getAppName() {
    return this.config.appName;
  }

  getVersion() {
    return this.config.version;
  }

  getPort() {
    return this.config.port;
  }

  getPrinterConfig() {
    return this.config.printer;
  }

  getSearchConfig() {
    return this.config.search;
  }

  getPerformanceConfig() {
    return this.config.performance;
  }

  getGitHubConfig() {
    return this.config.github;
  }

  async updateGitHubConfig(githubConfig) {
    this.config.github = { ...this.config.github, ...githubConfig };
    return await this.saveConfig();
  }

  async updatePrinterConfig(printerConfig) {
    this.config.printer = { ...this.config.printer, ...printerConfig };
    return await this.saveConfig();
  }

  // Validate configuration
  validate() {
    const errors = [];
    
    if (!this.config.appName || this.config.appName.trim() === '') {
      errors.push('App name is required');
    }
    
    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }
    
    if (this.config.printer.width <= 0 || this.config.printer.height <= 0) {
      errors.push('Printer dimensions must be positive numbers');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get all configuration as a flat object for the frontend
  getFlatConfig() {
    return {
      appName: this.config.appName,
      version: this.config.version,
      port: this.config.port,
      printer: this.config.printer,
      search: this.config.search,
      performance: this.config.performance,
      github: this.config.github,
      paths: this.config.paths
    };
  }
}

module.exports = Config;

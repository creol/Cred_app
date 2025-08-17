const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

// Import route modules
const eventRoutes = require('./routes/events');
const contactsRoutes = require('./routes/contacts');
const templatesRoutes = require('./routes/templates');
const printingRoutes = require('./routes/printing');
const exportRoutes = require('./routes/exports');

// Import database and utilities
const Database = require('./database/database');
const Config = require('./utils/config');
const Logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize configuration and database
const config = new Config();
const database = new Database(config);
const logger = new Logger(config);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(config.getAppDir(), 'data', 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.getVersion()
  });
});

// API routes
app.use('/api/events', eventRoutes(database, config, logger, upload));
app.use('/api/contacts', contactsRoutes(database, config, logger));
app.use('/api/templates', templatesRoutes(database, config, logger));
app.use('/api/printing', printingRoutes(database, config, logger));
app.use('/api/exports', exportRoutes(database, config, logger));

// Serve the main application
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// Initialize database and start server
async function startServer() {
  try {
    // Ensure app directories exist
    await fs.ensureDir(config.getAppDir());
    await fs.ensureDir(config.getDataDir());
    await fs.ensureDir(config.getTemplatesDir());
    await fs.ensureDir(config.getExportsDir());
    await fs.ensureDir(config.getLogsDir());

    // Initialize database
    await database.initialize();
    logger.info('Database initialized successfully');

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Credentialing App server running on port ${PORT}`);
      logger.info(`📁 App directory: ${config.getAppDir()}`);
      logger.info(`🌐 Open http://localhost:${PORT} in your browser`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  try {
    await database.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');
  try {
    await database.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();

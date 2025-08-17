const express = require('express');
const csv = require('csv-parser');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

module.exports = function(database, config, logger, upload) {
  const router = express.Router();

  // Get all events
  router.get('/', async (req, res) => {
    try {
      const events = await database.getAllEvents();
      res.json(events);
    } catch (error) {
      logger.error('Failed to get events', { error: error.message });
      res.status(500).json({ error: 'Failed to get events' });
    }
  });

  // Get specific event
  router.get('/:eventId', async (req, res) => {
    try {
      const event = await database.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json(event);
    } catch (error) {
      logger.error('Failed to get event', { error: error.message, eventId: req.params.eventId });
      res.status(500).json({ error: 'Failed to get event' });
    }
  });

  // Create new event
  router.post('/', async (req, res) => {
    try {
      const { name, date, description } = req.body;
      
      if (!name || !date) {
        return res.status(400).json({ error: 'Event name and date are required' });
      }

      // Validate date format
      if (!moment(date, moment.ISO_8601, true).isValid()) {
        return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' });
      }

      const event = await database.createEvent({ name, date, description });
      
      logger.logEvent('event_created', { eventId: event.id, eventName: event.name });
      
      res.status(201).json(event);
    } catch (error) {
      logger.error('Failed to create event', { error: error.message });
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  // Update event
  router.put('/:eventId', async (req, res) => {
    try {
      const { name, date, description } = req.body;
      
      if (!name || !date) {
        return res.status(400).json({ error: 'Event name and date are required' });
      }

      // Validate date format
      if (!moment(date, moment.ISO_8601, true).isValid()) {
        return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' });
      }

      const event = await database.updateEvent(req.params.eventId, { name, date, description });
      
      logger.logEvent('event_updated', { eventId: event.id, eventName: event.name });
      
      res.json(event);
    } catch (error) {
      logger.error('Failed to update event', { error: error.message, eventId: req.params.eventId });
      res.status(500).json({ error: 'Failed to update event' });
    }
  });

  // Delete event
  router.delete('/:eventId', async (req, res) => {
    try {
      // Check if event has contacts
      const contacts = await database.all('SELECT COUNT(*) as count FROM contacts WHERE event_id = ?', [req.params.eventId]);
      
      if (contacts[0].count > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete event with existing contacts. Export data first or use reset instead.' 
        });
      }

      await database.run('DELETE FROM events WHERE id = ?', [req.params.eventId]);
      
      logger.logEvent('event_deleted', { eventId: req.params.eventId });
      
      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete event', { error: error.message, eventId: req.params.eventId });
      res.status(500).json({ error: 'Failed to delete event' });
    }
  });

  // Import CSV for event
  router.post('/:eventId/import-csv', upload.single('csvFile'), async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const event = await database.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No CSV file provided' });
      }

      const startTime = Date.now();
      
      // Parse CSV file
      const contacts = [];
      const headers = [];
      let isFirstRow = true;
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('headers', (headerList) => {
            headers.push(...headerList);
          })
          .on('data', (row) => {
            if (isFirstRow) {
              isFirstRow = false;
            }
            contacts.push(row);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      if (contacts.length === 0) {
        return res.status(400).json({ error: 'CSV file contains no data' });
      }

      // Create working copy
      const workingCopyDir = path.join(config.getDataDir(), 'working_copies');
      await fs.ensureDir(workingCopyDir);
      
      const workingCopyPath = path.join(workingCopyDir, `event_${eventId}_${Date.now()}.csv`);
      
      // Write working copy with normalized headers
      const normalizedHeaders = headers.map(header => 
        header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      );
      
      const csvContent = [
        normalizedHeaders.join(','),
        ...contacts.map(row => 
          normalizedHeaders.map(header => 
            JSON.stringify(row[headers[normalizedHeaders.indexOf(header)]] || '')
          ).join(',')
        )
      ].join('\n');
      
      await fs.writeFile(workingCopyPath, csvContent);

      // Import contacts to database
      const contactIds = await database.importContacts(eventId, contacts);
      
      // Record CSV import
      const csvImport = await database.recordCSVImport({
        event_id: eventId,
        original_filename: req.file.originalname,
        working_copy_path: workingCopyPath,
        record_count: contacts.length,
        headers: normalizedHeaders,
        import_date: moment().toISOString()
      });

      // Clean up uploaded file
      await fs.remove(req.file.path);

      const duration = Date.now() - startTime;
      logger.logPerformance('csv_import', duration, { 
        eventId, 
        recordCount: contacts.length,
        csvImportId: csvImport.id 
      });
      
      logger.logCSVImport(req.file.originalname, contacts.length, { 
        eventId, 
        csvImportId: csvImport.id,
        workingCopyPath 
      });

      res.json({
        message: `Successfully imported ${contacts.length} contacts`,
        contactCount: contacts.length,
        headers: normalizedHeaders,
        workingCopyPath,
        csvImportId: csvImport.id,
        duration: `${duration}ms`
      });

    } catch (error) {
      logger.error('CSV import failed', { 
        error: error.message, 
        eventId: req.params.eventId,
        fileName: req.file?.originalname 
      });
      
      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fs.remove(req.file.path);
        } catch (cleanupError) {
          logger.error('Failed to cleanup uploaded file', { error: cleanupError.message });
        }
      }
      
      res.status(500).json({ error: 'CSV import failed', details: error.message });
    }
  });

  // Get event statistics
  router.get('/:eventId/statistics', async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const event = await database.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const stats = await database.getEventStatistics(eventId);
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get event statistics', { 
        error: error.message, 
        eventId: req.params.eventId 
      });
      res.status(500).json({ error: 'Failed to get event statistics' });
    }
  });

  // Reset event (clear all contacts and credentials)
  router.post('/:eventId/reset', async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const event = await database.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Get current statistics before reset
      const stats = await database.getEventStatistics(eventId);
      
      // Clear all contacts and credentials for this event
      await database.run('DELETE FROM credentials WHERE event_id = ?', [eventId]);
      await database.run('DELETE FROM contacts WHERE event_id = ?', [eventId]);
      
      logger.logEvent('event_reset', { 
        eventId, 
        eventName: event.name,
        previousStats: stats 
      });
      
      res.json({ 
        message: 'Event reset successfully',
        previousStats: stats
      });
    } catch (error) {
      logger.error('Failed to reset event', { 
        error: error.message, 
        eventId: req.params.eventId 
      });
      res.status(500).json({ error: 'Failed to reset event' });
    }
  });

  // Get working copy path for event
  router.get('/:eventId/working-copy', async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const csvImport = await database.get(`
        SELECT working_copy_path, original_filename, record_count, import_date 
        FROM csv_imports 
        WHERE event_id = ? 
        ORDER BY import_date DESC 
        LIMIT 1
      `, [eventId]);
      
      if (!csvImport) {
        return res.status(404).json({ error: 'No CSV import found for this event' });
      }

      res.json({
        workingCopyPath: csvImport.working_copy_path,
        originalFilename: csvImport.original_filename,
        recordCount: csvImport.record_count,
        importDate: csvImport.import_date
      });
    } catch (error) {
      logger.error('Failed to get working copy info', { 
        error: error.message, 
        eventId: req.params.eventId 
      });
      res.status(500).json({ error: 'Failed to get working copy info' });
    }
  });

  return router;
};

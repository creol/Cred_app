const express = require('express');
const csv = require('csv-writer').createObjectCsvWriter;
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

module.exports = function(database, config, logger) {
  const router = express.Router();

  // Export credentialed contacts to CSV
  router.post('/export-credentialed', async (req, res) => {
    try {
      const { eventId, includeInactive = false } = req.body;
      
      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const event = await database.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const startTime = Date.now();

      // Get the original CSV headers for this event
      const csvImport = await database.get(`
        SELECT headers FROM csv_imports 
        WHERE event_id = ? 
        ORDER BY import_date DESC 
        LIMIT 1
      `, [eventId]);

      let originalHeaders = [];
      if (csvImport && csvImport.headers) {
        try {
          originalHeaders = JSON.parse(csvImport.headers);
        } catch (e) {
          logger.warn('Failed to parse CSV headers for export', { error: e.message, eventId });
        }
      }

      // Get credentialed contacts
      let sql = `
        SELECT c.*, cr.id as credential_id, cr.printed_at, cr.template_id, cr.status as credential_status
        FROM contacts c
        INNER JOIN credentials cr ON c.id = cr.contact_id
        WHERE c.event_id = ? AND cr.status = ?
      `;
      
      const statusFilter = includeInactive ? 'inactive' : 'active';
      const contacts = await database.all(sql, [eventId, statusFilter]);

      if (contacts.length === 0) {
        return res.status(404).json({ error: 'No credentialed contacts found for export' });
      }

      // Generate filename
      const eventName = event.name.replace(/[^a-zA-Z0-9]/g, '_');
      const eventDate = moment(event.date).format('YYYY-MM-DD');
      const timestamp = moment().format('HH-mm-ss');
      const filename = `Credentialed_${eventName}_${eventDate}_${timestamp}.csv`;
      
      // Create exports directory if it doesn't exist
      const exportsDir = config.getExportsDir();
      await fs.ensureDir(exportsDir);
      
      const filePath = path.join(exportsDir, filename);

      // Build CSV headers: start with original CSV headers, then add credentialing info
      const csvHeaders = [];
      
      // Add original CSV headers first
      if (originalHeaders.length > 0) {
        originalHeaders.forEach(header => {
          csvHeaders.push({ id: header, title: header });
        });
      }
      
      // Add credentialing information columns
      csvHeaders.push(
        { id: 'credential_id', title: 'Credential ID' },
        { id: 'printed_at', title: 'Credentialed Date' },
        { id: 'template_id', title: 'Template Used' },
        { id: 'credential_status', title: 'Credential Status' }
      );

      // Process contacts to flatten custom_fields and add credentialing data
      const processedContacts = contacts.map(contact => {
        const processed = { ...contact };
        
        // Parse custom_fields JSON and merge with main contact data
        if (contact.custom_fields) {
          try {
            const customFields = JSON.parse(contact.custom_fields);
            Object.assign(processed, customFields);
          } catch (e) {
            logger.warn('Failed to parse custom fields for export', { error: e.message, contactId: contact.id });
          }
        }
        
        return processed;
      });

      // Create CSV writer
      const csvWriter = csv({
        path: filePath,
        header: csvHeaders
      });

      // Write CSV file
      await csvWriter.writeRecords(processedContacts);

      // Record export in database
      const exportRecord = await database.recordExport({
        event_id: eventId,
        filename: filename,
        file_path: filePath,
        record_count: contacts.length,
        export_date: moment().toISOString()
      });

      // Log the export action
      await database.logAudit({
        action: 'export_credentialed',
        entity_type: 'export',
        entity_id: exportRecord.id,
        details: {
          eventId,
          filename,
          recordCount: contacts.length,
          includeInactive
        }
      });

      const duration = Date.now() - startTime;
      logger.logPerformance('csv_export', duration, {
        eventId,
        recordCount: contacts.length,
        filename
      });

      logger.logExport(event.name, contacts.length, {
        eventId,
        exportId: exportRecord.id,
        filename,
        includeInactive
      });

      res.json({
        message: `Successfully exported ${contacts.length} credentialed contacts`,
        filename: filename,
        filePath: filePath,
        recordCount: contacts.length,
        exportId: exportRecord.id,
        duration: `${duration}ms`
      });

    } catch (error) {
      logger.error('Failed to export credentialed contacts', { 
        error: error.message,
        eventId: req.body.eventId 
      });
      res.status(500).json({ error: 'Export failed', details: error.message });
    }
  });

  // Export all contacts (including non-credentialed)
  router.post('/export-all-contacts', async (req, res) => {
    try {
      const { eventId } = req.body;
      
      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      const event = await database.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const startTime = Date.now();

      // Get the original CSV headers for this event
      const csvImport = await database.get(`
        SELECT headers FROM csv_imports 
        WHERE event_id = ? 
        ORDER BY import_date DESC 
        LIMIT 1
      `, [eventId]);

      let originalHeaders = [];
      if (csvImport && csvImport.headers) {
        try {
          originalHeaders = JSON.parse(csvImport.headers);
        } catch (e) {
          logger.warn('Failed to parse CSV headers for export', { error: e.message, eventId });
        }
      }

      // Get all contacts with credentialing status
      const contacts = await database.all(`
        SELECT c.*, 
               CASE WHEN cr.id IS NOT NULL THEN 'Yes' ELSE 'No' END as is_credentialed,
               cr.printed_at as credential_date,
               cr.template_id as template_used
        FROM contacts c
        LEFT JOIN credentials cr ON c.id = cr.contact_id AND cr.status = 'active'
        WHERE c.event_id = ?
        ORDER BY c.last_name, c.first_name
      `, [eventId]);

      if (contacts.length === 0) {
        return res.status(404).json({ error: 'No contacts found for export' });
      }

      // Generate filename
      const eventName = event.name.replace(/[^a-zA-Z0-9]/g, '_');
      const eventDate = moment(event.date).format('YYYY-MM-DD');
      const timestamp = moment().format('HH-mm-ss');
      const filename = `AllContacts_${eventName}_${eventDate}_${timestamp}.csv`;
      
      // Create exports directory if it doesn't exist
      const exportsDir = config.getExportsDir();
      await fs.ensureDir(exportsDir);
      
      const filePath = path.join(exportsDir, filename);

      // Build CSV headers: start with original CSV headers, then add credentialing info
      const csvHeaders = [];
      
      // Add original CSV headers first
      if (originalHeaders.length > 0) {
        originalHeaders.forEach(header => {
          csvHeaders.push({ id: header, title: header });
        });
      }
      
      // Add credentialing information columns
      csvHeaders.push(
        { id: 'is_credentialed', title: 'Is Credentialed' },
        { id: 'credential_date', title: 'Credential Date' },
        { id: 'template_used', title: 'Template Used' }
      );

      // Process contacts to flatten custom_fields and add credentialing data
      const processedContacts = contacts.map(contact => {
        const processed = { ...contact };
        
        // Parse custom_fields JSON and merge with main contact data
        if (contact.custom_fields) {
          try {
            const customFields = JSON.parse(contact.custom_fields);
            Object.assign(processed, customFields);
          } catch (e) {
            logger.warn('Failed to parse custom fields for export', { error: e.message, contactId: contact.id });
          }
        }
        
        return processed;
      });

      // Create CSV writer
      const csvWriter = csv({
        path: filePath,
        header: csvHeaders
      });

      // Write CSV file
      await csvWriter.writeRecords(processedContacts);

      // Record export in database
      const exportRecord = await database.recordExport({
        event_id: eventId,
        filename: filename,
        file_path: filePath,
        record_count: contacts.length,
        export_date: moment().toISOString()
      });

      // Log the export action
      await database.logAudit({
        action: 'export_all_contacts',
        entity_type: 'export',
        entity_id: exportRecord.id,
        details: {
          eventId,
          filename,
          recordCount: contacts.length
        }
      });

      const duration = Date.now() - startTime;
      logger.logPerformance('csv_export_all', duration, {
        eventId,
        recordCount: contacts.length,
        filename
      });

      logger.logExport(event.name, contacts.length, {
        eventId,
        exportId: exportRecord.id,
        filename,
        type: 'all_contacts'
      });

      res.json({
        message: `Successfully exported ${contacts.length} contacts`,
        filename: filename,
        filePath: filePath,
        recordCount: contacts.length,
        exportId: exportRecord.id,
        duration: `${duration}ms`
      });

    } catch (error) {
      logger.error('Failed to export all contacts', { 
        error: error.message,
        eventId: req.body.eventId 
      });
      res.status(500).json({ error: 'Export failed', details: error.message });
    }
  });

  // Get export history for an event
  router.get('/history/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Get exports with pagination
      const exports = await database.all(`
        SELECT * FROM exports 
        WHERE event_id = ? 
        ORDER BY export_date DESC 
        LIMIT ? OFFSET ?
      `, [eventId, parseInt(limit), offset]);
      
      // Get total count
      const countResult = await database.get(`
        SELECT COUNT(*) as total FROM exports WHERE event_id = ?
      `, [eventId]);
      
      res.json({
        exports: exports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Failed to get export history', { 
        error: error.message,
        eventId: req.params.eventId 
      });
      res.status(500).json({ error: 'Failed to get export history' });
    }
  });

  // Download export file
  router.get('/download/:exportId', async (req, res) => {
    try {
      const { exportId } = req.params;
      
      const exportRecord = await database.get('SELECT * FROM exports WHERE id = ?', [exportId]);
      if (!exportRecord) {
        return res.status(404).json({ error: 'Export not found' });
      }

      // Check if file exists
      if (!await fs.pathExists(exportRecord.file_path)) {
        return res.status(404).json({ error: 'Export file not found' });
      }

      // Log download
      await database.logAudit({
        action: 'export_downloaded',
        entity_type: 'export',
        entity_id: exportId,
        details: {
          filename: exportRecord.filename,
          eventId: exportRecord.event_id
        }
      });

      // Send file
      res.download(exportRecord.file_path, exportRecord.filename);
      
    } catch (error) {
      logger.error('Failed to download export', { 
        error: error.message,
        exportId: req.params.exportId 
      });
      res.status(500).json({ error: 'Download failed' });
    }
  });

  // Print statistics label
  router.post('/print-statistics', async (req, res) => {
    try {
      const { eventId, templateId } = req.body;
      
      if (!eventId || !templateId) {
        return res.status(400).json({ error: 'Event ID and Template ID are required' });
      }

      const event = await database.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const template = await database.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Get event statistics
      const stats = await database.getEventStatistics(eventId);
      
      // Generate statistics label data
      const statsData = {
        eventName: event.name,
        eventDate: event.date,
        totalContacts: stats.total_contacts,
        credentialedCount: stats.credentialed_count,
        credentialedPercentage: stats.credentialed_percentage,
        manuallyAddedCount: stats.manually_added_count,
        printDate: moment().format('YYYY-MM-DD HH:mm:ss'),
        generatedBy: 'Credentialing App'
      };

      // Simulate printing statistics label
      const printResult = await simulateStatisticsPrint(statsData);
      
      if (!printResult.success) {
        throw new Error(`Statistics printing failed: ${printResult.error}`);
      }

      // Log the action
      await database.logAudit({
        action: 'statistics_printed',
        entity_type: 'export',
        entity_id: eventId,
        details: {
          eventId,
          templateId,
          stats: statsData
        }
      });

      res.json({
        message: 'Statistics label printed successfully',
        stats: statsData,
        printResult: printResult
      });

    } catch (error) {
      logger.error('Failed to print statistics', { 
        error: error.message,
        eventId: req.body.eventId 
      });
      res.status(500).json({ error: 'Failed to print statistics', details: error.message });
    }
  });

  // Reset event data (clear working state)
  router.post('/:eventId/reset', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { forceDownload = false } = req.body;
      
      const event = await database.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Get current statistics before reset
      const stats = await database.getEventStatistics(eventId);
      
      // Force download current export if requested
      if (forceDownload && stats.credentialed_count > 0) {
        // Create a quick export before reset
        const eventName = event.name.replace(/[^a-zA-Z0-9]/g, '_');
        const eventDate = moment(event.date).format('YYYY-MM-DD');
        const timestamp = moment().format('HH-mm-ss');
        const filename = `PreReset_${eventName}_${eventDate}_${timestamp}.csv`;
        
        const exportsDir = config.getExportsDir();
        await fs.ensureDir(exportsDir);
        const filePath = path.join(exportsDir, filename);
        
        // Get the original CSV headers for this event
        const csvImport = await database.get(`
          SELECT headers FROM csv_imports 
          WHERE event_id = ? 
          ORDER BY import_date DESC 
          LIMIT 1
        `, [eventId]);

        let originalHeaders = [];
        if (csvImport && csvImport.headers) {
          try {
            originalHeaders = JSON.parse(csvImport.headers);
          } catch (e) {
            logger.warn('Failed to parse CSV headers for pre-reset export', { error: e.message, eventId });
          }
        }
        
        // Export current credentialed contacts
        const credentialedContacts = await database.all(`
          SELECT c.*, cr.id as credential_id, cr.printed_at, cr.template_id
          FROM contacts c
          INNER JOIN credentials cr ON c.id = cr.contact_id
          WHERE c.event_id = ? AND cr.status = 'active'
        `, [eventId]);
        
        if (credentialedContacts.length > 0) {
          // Build CSV headers: start with original CSV headers, then add credentialing info
          const csvHeaders = [];
          
          // Add original CSV headers first
          if (originalHeaders.length > 0) {
            originalHeaders.forEach(header => {
              csvHeaders.push({ id: header, title: header });
            });
          }
          
          // Add credentialing information columns
          csvHeaders.push(
            { id: 'credential_id', title: 'Credential ID' },
            { id: 'printed_at', title: 'Credentialed Date' },
            { id: 'template_id', title: 'Template Used' }
          );
          
          // Process contacts to flatten custom_fields
          const processedContacts = credentialedContacts.map(contact => {
            const processed = { ...contact };
            
            // Parse custom_fields JSON and merge with main contact data
            if (contact.custom_fields) {
              try {
                const customFields = JSON.parse(contact.custom_fields);
                Object.assign(processed, customFields);
              } catch (e) {
                logger.warn('Failed to parse custom fields for pre-reset export', { error: e.message, contactId: contact.id });
              }
            }
            
            return processed;
          });
          
          const csvWriter = csv({
            path: filePath,
            header: csvHeaders
          });
          
          await csvWriter.writeRecords(processedContacts);
          
          // Record the pre-reset export
          await database.recordExport({
            event_id: eventId,
            filename: filename,
            file_path: filePath,
            record_count: credentialedContacts.length,
            export_date: moment().toISOString()
          });
        }
      }
      
      // Clear all contacts and credentials for this event
      await database.run('DELETE FROM credentials WHERE event_id = ?', [eventId]);
      await database.run('DELETE FROM contacts WHERE event_id = ?', [eventId]);
      
      // Log the reset action
      await database.logAudit({
        action: 'event_reset',
        entity_type: 'event',
        entity_id: eventId,
        details: {
          eventId,
          eventName: event.name,
          previousStats: stats,
          forceDownload
        }
      });
      
      logger.logEvent('event_reset', { 
        eventId, 
        eventName: event.name,
        previousStats: stats,
        forceDownload
      });
      
      res.json({ 
        message: 'Event reset successfully',
        previousStats: stats,
        forceDownload: forceDownload
      });
    } catch (error) {
      logger.error('Failed to reset event', { 
        error: error.message, 
        eventId: req.params.eventId 
      });
      res.status(500).json({ error: 'Failed to reset event' });
    }
  });

  // Simulate statistics printing
  async function simulateStatisticsPrint(statsData) {
    try {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Log the print job
      logger.info('Statistics print job simulated', {
        stats: statsData,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        message: 'Statistics label printed successfully (simulated)',
        statsData,
        simulated: true,
        printJobId: `stats_${Date.now()}`
      };

    } catch (error) {
      logger.error('Statistics printing simulation failed', { error: error.message, statsData });
      return {
        success: false,
        error: error.message
      };
    }
  }

  return router;
};

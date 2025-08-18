const express = require('express');
const moment = require('moment');

module.exports = function(database, config, logger) {
  const router = express.Router();

  // Print credential
  router.post('/print-credential', async (req, res) => {
    try {
      const { contactId, eventId, templateId, contactData, notes } = req.body;
      
      if (!contactId || !eventId || !templateId) {
        return res.status(400).json({ error: 'Contact ID, Event ID, and Template ID are required' });
      }

      const startTime = Date.now();

      // Get contact and event data
      const contact = await database.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const event = await database.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const template = await database.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Check if already credentialed
      const isAlreadyCredentialed = await database.isContactCredentialed(contactId, eventId);
      if (isAlreadyCredentialed) {
        return res.status(400).json({ error: 'Contact is already credentialed' });
      }

      // Generate label data
      const labelData = {
        firstName: contactData?.first_name || contact.first_name,
        lastName: contactData?.last_name || contact.last_name,
        middleName: contactData?.middle_name || contact.middle_name,
        birthDate: contactData?.birth_date || contact.birth_date,
        address: contactData?.address || contact.address,
        city: contactData?.city || contact.city,
        state: contactData?.state || contact.state,
        zip: contactData?.zip || contact.zip,
        phone: contactData?.phone || contact.phone,
        email: contactData?.email || contact.email,
        eventName: event.name,
        eventDate: event.date,
        printDate: moment().format('YYYY-MM-DD HH:mm:ss')
      };

      // Simulate printing (in a real implementation, this would send to printer)
      const printResult = await simulatePrinting(template.config, labelData);
      
      if (!printResult.success) {
        throw new Error(`Printing failed: ${printResult.error}`);
      }

      // Create credential record
      const credential = await database.createCredential({
        contact_id: contactId,
        event_id: eventId,
        template_id: templateId,
        printed_at: moment().toISOString(),
        printed_by: 'system',
        status: 'active',
        notes: notes || ''
      });

      // Log the credentialing action
      await database.logAudit({
        action: 'credential_printed',
        entity_type: 'credential',
        entity_id: credential.id,
        details: {
          contactId,
          eventId,
          templateId,
          labelData,
          printResult
        }
      });

      const duration = Date.now() - startTime;
      logger.logPerformance('credential_print', duration, {
        contactId,
        eventId,
        templateId,
        printResult
      });

      logger.logPrinting(contactId, templateId, {
        eventId,
        credentialId: credential.id,
        printResult
      });

      res.json({
        message: 'Credential printed successfully',
        credential: credential,
        printResult: printResult,
        duration: `${duration}ms`
      });

    } catch (error) {
      logger.error('Failed to print credential', { 
        error: error.message,
        contactId: req.body.contactId,
        eventId: req.body.eventId 
      });
      res.status(500).json({ error: 'Failed to print credential', details: error.message });
    }
  });

  // Test print
  router.post('/test-print', async (req, res) => {
    try {
      const { templateId, sampleData } = req.body;
      
      if (!templateId) {
        return res.status(400).json({ error: 'Template ID is required' });
      }

      const template = await database.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Use sample data or default data
      const testData = sampleData || {
        firstName: 'TEST',
        lastName: 'USER',
        middleName: 'T',
        birthDate: '1990-01-01',
        address: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
        phone: '(555) 123-4567',
        email: 'test@example.com',
        eventName: 'TEST EVENT',
        eventDate: '2025-01-01',
        printDate: moment().format('YYYY-MM-DD HH:mm:ss')
      };

      // Generate and print test label
      const printResult = await simulatePrinting(template.config, testData, true);
      
      if (!printResult.success) {
        throw new Error(`Test printing failed: ${printResult.error}`);
      }

      logger.logTemplateAction('test_print', templateId, {
        printResult
      });

      res.json({
        message: 'Test print completed successfully',
        printResult: printResult
      });

    } catch (error) {
      logger.error('Test print failed', { 
        error: error.message,
        templateId: req.body.templateId 
      });
      res.status(500).json({ error: 'Test print failed', details: error.message });
    }
  });

  // Un-credential a contact
  router.post('/un-credential', async (req, res) => {
    try {
      const { contactId, eventId, reason } = req.body;
      
      if (!contactId || !eventId) {
        return res.status(400).json({ error: 'Contact ID and Event ID are required' });
      }

      // Get active credentials for this contact and event
      const credentials = await database.all(`
        SELECT * FROM credentials 
        WHERE contact_id = ? AND event_id = ? AND status = 'active'
      `, [contactId, eventId]);

      if (credentials.length === 0) {
        return res.status(400).json({ error: 'No active credentials found for this contact' });
      }

      // Update all active credentials to inactive
      for (const credential of credentials) {
        await database.updateCredentialStatus(credential.id, 'inactive');
      }

      // Log the un-credentialing action
      await database.logAudit({
        action: 'credential_revoked',
        entity_type: 'credential',
        entity_id: contactId,
        details: {
          contactId,
          eventId,
          reason: reason || 'No reason provided',
          affectedCredentials: credentials.map(c => c.id)
        }
      });

      logger.logCredentialing(contactId, 'un_credentialed', {
        eventId,
        reason,
        affectedCredentials: credentials.map(c => c.id)
      });

      res.json({
        message: 'Credential revoked successfully',
        affectedCredentials: credentials.length,
        reason: reason || 'No reason provided'
      });

    } catch (error) {
      logger.error('Failed to un-credential contact', { 
        error: error.message,
        contactId: req.body.contactId,
        eventId: req.body.eventId 
      });
      res.status(500).json({ error: 'Failed to revoke credential', details: error.message });
    }
  });

  // Get printer status
  router.get('/status', async (req, res) => {
    try {
      const printerConfig = config.getPrinterConfig();
      
      // Basic printer status check (simulated)
      const status = {
        connected: true, // Simulated as connected
        type: printerConfig.type,
        labelSize: printerConfig.labelSize,
        foldOver: printerConfig.foldOver,
        dpi: printerConfig.dpi,
        lastCheck: new Date().toISOString(),
        status: 'ready',
        note: 'Printer simulation mode - credentials will be logged but not physically printed'
      };

      res.json(status);
    } catch (error) {
      logger.error('Failed to get printer status', { error: error.message });
      res.status(500).json({ error: 'Failed to get printer status' });
    }
  });

  // Simulate printing function
  async function simulatePrinting(templateConfig, labelData, isTest = false) {
    try {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate label preview data
      const previewData = generateLabelPreview(templateConfig, labelData);
      
      if (isTest) {
        return {
          success: true,
          message: 'Test print simulated successfully',
          labelData,
          templateConfig,
          preview: previewData,
          simulated: true
        };
      } else {
        // Log the print job
        logger.info('Print job simulated', {
          templateId: templateConfig.id,
          labelData,
          timestamp: new Date().toISOString()
        });
        
        return {
          success: true,
          message: 'Label printed successfully (simulated)',
          labelData,
          templateConfig,
          preview: previewData,
          simulated: true,
          printJobId: `print_${Date.now()}`
        };
      }

    } catch (error) {
      logger.error('Label printing simulation failed', { error: error.message, labelData });
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate label preview data
  function generateLabelPreview(templateConfig, labelData) {
    const preview = {
      type: 'preview',
      width: templateConfig.width,
      height: templateConfig.height,
      foldOver: templateConfig.foldOver || false,
      elements: []
    };

    if (templateConfig.elements) {
      preview.elements = templateConfig.elements.map(element => {
        const processedElement = { ...element };
        
        if (element.type === 'text' && element.content) {
          // Replace template variables with actual data using improved logic
          processedElement.previewContent = element.content.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
            // Convert field name to camelCase for standard fields
            const camelCaseField = fieldName.replace(/([-_][a-z])/g, (g) => g[1].toUpperCase());
            
            // Check if it's a standard field first (camelCase)
            if (labelData[camelCaseField] !== undefined) {
              return labelData[camelCaseField] || '';
            }
            
            // Check if it's a direct field match
            if (labelData[fieldName] !== undefined) {
              return labelData[fieldName] || '';
            }
            
            // Check if it's in custom fields
            if (labelData.custom_fields) {
              try {
                const customFields = JSON.parse(labelData.custom_fields);
                if (customFields[fieldName] !== undefined) {
                  return customFields[fieldName] || '';
                }
              } catch (e) {
                console.warn('Failed to parse custom fields for printing preview:', e);
              }
            }
            
            // Return the original placeholder if no match found
            return match;
          });
        }
        
        return processedElement;
      });
    }

    return preview;
  }

  return router;
};

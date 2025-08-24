const express = require('express');
const moment = require('moment');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configure multer for PDF upload
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            cb(null, tempDir);
        },
        filename: (req, file, cb) => {
            const timestamp = Date.now();
            cb(null, `credential_${timestamp}.pdf`);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

module.exports = function(database, config, logger) {
  const router = express.Router();

  // Print from event PDFs (merged/fallback) using SumatraPDF page-range
  router.post('/print-merged', async (req, res) => {
    try {
      const { contactId, eventId, printer } = req.body || {};
      if (!contactId || !eventId) {
        return res.status(400).json({ success: false, error: 'contactId and eventId are required' });
      }

      const contact = await database.getContact(contactId);
      if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });

      const event = await database.getEvent(eventId);
      if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

      const printerName = printer || 'RX106HD';

      const useMerged = contact.original_row && contact.original_row > 0 && event.merged_pdf_path;
      const pdfPath = useMerged ? event.merged_pdf_path : event.fallback_pdf_path;
      if (!pdfPath) {
        return res.status(400).json({ success: false, error: useMerged ? 'Merged PDF not configured' : 'Fallback PDF not configured' });
      }

      if (!fs.existsSync(pdfPath)) {
        return res.status(400).json({ success: false, error: `PDF not found at path: ${pdfPath}` });
      }

      // Locate SumatraPDF
      const possiblePaths = [
        `C:\\Users\\User\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe`,
        `C:\\Users\\${process.env.USERNAME || 'User'}\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe`,
        `C:\\Program Files\\SumatraPDF\\SumatraPDF.exe`,
        `C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe`
      ];

      let sumatraPathUnquoted = null;
      let sumatraPath = null;
      for (const p of possiblePaths) {
        try {
          if (fs.existsSync(p)) { sumatraPathUnquoted = p; sumatraPath = `"${p}"`; break; }
        } catch (_) { }
      }
      if (!sumatraPathUnquoted) {
        return res.status(500).json({ success: false, error: `SumatraPDF not found. Expected at: ${possiblePaths.join(', ')}` });
      }

      // Build print command with optional page selection for merged PDF
      const pageSetting = useMerged ? `, pages=${contact.original_row}` : '';
      const cmd = `${sumatraPath} -print-to "${printerName}" -print-settings "fit${pageSetting}" "${pdfPath}"`;
      logger.info('Executing SumatraPDF merged print', { cmd, pdfPath, printerName, useMerged, page: contact.original_row || 1 });

      exec(cmd, async (error, stdout, stderr) => {
        logger.info('Sumatra stdout/stderr', { stdout, stderr });
        if (error) {
          logger.error('Sumatra merged print error', { error: error.message });
          return res.status(500).json({ success: false, error: `SumatraPDF print failed: ${error.message}` });
        }

        // Create credential record (use default-template as placeholder)
        try {
          const cred = await database.createCredential({
            contact_id: contactId,
            event_id: eventId,
            template_id: 'default-template',
            printed_at: moment().toISOString(),
            printed_by: 'system',
            status: 'active',
            notes: useMerged ? `Merged PDF page ${contact.original_row}` : 'Fallback PDF printed'
          });

          await database.logAudit({
            action: 'credential_printed',
            entity_type: 'credential',
            entity_id: cred.id,
            details: { method: 'sumatra-merged', pdfPath, page: contact.original_row || 1, printer: printerName }
          });
        } catch (e) {
          logger.error('Failed to record credential after merged print', { error: e.message });
          // continue; printing already done
        }

        return res.json({ success: true, message: 'Print job sent successfully' });
      });
    } catch (error) {
      logger.error('print-merged endpoint error', { error: error.message });
      res.status(500).json({ success: false, error: `Server error: ${error.message}` });
    }
  });

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

     // Test SumatraPDF endpoint
   router.get('/test-sumatra', async (req, res) => {
     try {
       console.log('Testing SumatraPDF installation...');
       
       // Check if SumatraPDF exists - try multiple possible paths
       const possiblePaths = [
         `C:\\Users\\User\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe`,
         `C:\\Users\\${process.env.USERNAME || 'User'}\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe`,
         `C:\\Program Files\\SumatraPDF\\SumatraPDF.exe`,
         `C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe`
       ];
       
       const results = [];
       
       for (const path of possiblePaths) {
         try {
           const exists = fs.existsSync(path);
           results.push({ path, exists, error: null });
           console.log(`Path ${path}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
         } catch (e) {
           results.push({ path, exists: false, error: e.message });
           console.log(`Path ${path}: ERROR - ${e.message}`);
         }
       }
       
       res.json({ 
         success: true, 
         results,
         username: process.env.USERNAME,
         message: 'SumatraPDF path check completed'
       });
       
     } catch (error) {
       console.error('Test endpoint error:', error);
       res.status(500).json({ 
         success: false, 
         error: `Test failed: ${error.message}` 
       });
     }
   });

   // SumatraPDF print endpoint
   router.post('/print-sumatra', upload.single('pdf'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No PDF file provided' });
      }

             const printerName = req.body.printer || 'RX106HD';
       const pdfPath = req.file.path;
       
       // Check if SumatraPDF exists - try multiple possible paths
       const possiblePaths = [
         `C:\\Users\\User\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe`,
         `C:\\Users\\${process.env.USERNAME || 'User'}\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe`,
         `C:\\Program Files\\SumatraPDF\\SumatraPDF.exe`,
         `C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe`
       ];
       
       let sumatraPathUnquoted = null;
       let sumatraPath = null;
       
       for (const path of possiblePaths) {
         try {
           if (fs.existsSync(path)) {
             sumatraPathUnquoted = path;
             sumatraPath = `"${path}"`;
             console.log('SumatraPDF found at:', path);
             break;
           }
         } catch (e) {
           console.log('Could not check path:', path, e.message);
         }
       }
       
       if (!sumatraPathUnquoted) {
         console.error('SumatraPDF not found in any of the expected locations');
         return res.status(500).json({ 
           success: false, 
           error: `SumatraPDF not found. Please install SumatraPDF in one of these locations: ${possiblePaths.join(', ')}` 
         });
       }
       
       console.log('SumatraPDF found at:', sumatraPathUnquoted);
       
       // SumatraPDF command to print directly to specified printer
       // Try different command variations for better compatibility
       const sumatraCommand = `${sumatraPath} -print-to "${printerName}" -print-settings "fit" "${pdfPath}"`;
      
                    console.log('Executing SumatraPDF command:', sumatraCommand);
       console.log('PDF path:', pdfPath);
       console.log('Printer name:', printerName);
        
        // First attempt with specific printer
        exec(sumatraCommand, (error, stdout, stderr) => {
          console.log('Command stdout:', stdout);
          console.log('Command stderr:', stderr);
         if (error) {
           console.error('SumatraPDF print error (first attempt):', error);
           console.log('Trying fallback command without specific printer...');
           
           // Fallback: try without specifying printer (will use default)
           const fallbackCommand = `${sumatraPath} -print "${pdfPath}"`;
           console.log('Executing fallback command:', fallbackCommand);
           
                       exec(fallbackCommand, (fallbackError, fallbackStdout, fallbackStderr) => {
              console.log('Fallback command stdout:', fallbackStdout);
              console.log('Fallback command stderr:', fallbackStderr);
             // Clean up the temporary file
             fs.unlink(pdfPath, (unlinkError) => {
               if (unlinkError) {
                 console.error('Error deleting temp file:', unlinkError);
               }
             });
             
             if (fallbackError) {
               console.error('SumatraPDF fallback print error:', fallbackError);
               return res.status(500).json({ 
                 success: false, 
                 error: `SumatraPDF print failed: ${fallbackError.message}. Please check if SumatraPDF is installed at ${sumatraPath} and RX106HD printer is configured.` 
               });
             }
             
             console.log('SumatraPDF fallback print successful');
             res.json({ success: true, message: 'Print job sent successfully (using default printer)' });
           });
         } else {
           // Clean up the temporary file
           fs.unlink(pdfPath, (unlinkError) => {
             if (unlinkError) {
               console.error('Error deleting temp file:', unlinkError);
             }
           });
           
           console.log('SumatraPDF print successful');
           res.json({ success: true, message: 'Print job sent successfully' });
         }
       });
      
    } catch (error) {
      console.error('Print endpoint error:', error);
      res.status(500).json({ 
        success: false, 
        error: `Server error: ${error.message}` 
      });
    }
  });

  return router;
};

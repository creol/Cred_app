const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const database = require('../database/database');
const logger = require('../utils/logger');

console.log('🔥🔥🔥 TEMPLATES.JS FILE LOADED - VERSION WITH CLEANUP LOGIC 🔥🔥🔥');

module.exports = function(database, config, logger) {
  const router = express.Router();

  // Get all templates
  router.get('/', async (req, res) => {
    try {
      const templates = await database.getAllTemplates();
      res.json(templates);
    } catch (error) {
      logger.error('Failed to get templates', { error: error.message });
      res.status(500).json({ error: 'Failed to get templates' });
    }
  });

  // Get specific template
  router.get('/:templateId', async (req, res) => {
    try {
      const template = await database.getTemplate(req.params.templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error) {
      logger.error('Failed to get template', { error: error.message, templateId: req.params.templateId });
      res.status(500).json({ error: 'Failed to get template' });
    }
  });

  // Create or update template
  router.post('/', async (req, res) => {
    try {
      console.log('🔥 TEMPLATE SAVE REQUEST RECEIVED');
      console.log('📋 Request body keys:', Object.keys(req.body));
      console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
      
      const { id, name, description, config: templateConfig, is_default } = req.body;
      
      console.log('📝 Template name:', name);
      console.log('⚙️ Template config present:', !!templateConfig);
      console.log('⚙️ Template config elements:', templateConfig?.elements?.length || 0);
      
      if (!name || !templateConfig) {
        console.error('❌ Missing required fields:', { name: !!name, templateConfig: !!templateConfig });
        return res.status(400).json({ error: 'Template name and configuration are required' });
      }

      // Validate template configuration
      console.log('🔍 Validating template configuration...');
      const validationResult = validateTemplateConfig(templateConfig);
      console.log('✅ Validation result:', validationResult);
      
      if (!validationResult.isValid) {
        console.error('❌ Template validation failed:', validationResult.errors);
        return res.status(400).json({ 
          error: 'Invalid template configuration', 
          details: validationResult.errors 
        });
      }

      // If this is a new template, generate ID
      const templateId = id || uuidv4();
      
      // If setting as default, unset other defaults
      if (is_default) {
        await database.run('UPDATE templates SET is_default = 0 WHERE is_default = 1');
      }

      const templateData = {
        id: templateId,
        name: name.trim(),
        description: description?.trim() || '',
        config: templateConfig,
        is_default: is_default || false
      };

      console.log('💾 Saving template to database...');
      const savedTemplate = await database.saveTemplate(templateData);
      console.log('✅ Template saved to database:', savedTemplate.id);
      
      logger.logTemplateAction('template_saved', templateId, {
        name: savedTemplate.name,
        isDefault: savedTemplate.is_default
      });

      console.log('🎉 Template save complete, sending response');
      res.json(savedTemplate);
    } catch (error) {
      logger.error('Failed to save template', { error: error.message });
      res.status(500).json({ error: 'Failed to save template' });
    }
  });

  // Update template
  router.put('/:templateId', async (req, res) => {
    try {
      const templateId = req.params.templateId;
      const existingTemplate = await database.getTemplate(templateId);
      
      if (!existingTemplate) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const { name, description, config: templateConfig, is_default } = req.body;
      
      if (!name || !templateConfig) {
        return res.status(400).json({ error: 'Template name and configuration are required' });
      }

      // Validate template configuration
      const validationResult = validateTemplateConfig(templateConfig);
      if (!validationResult.isValid) {
        return res.status(400).json({ 
          error: 'Invalid template configuration', 
          details: validationResult.errors 
        });
      }

      // If setting as default, unset other defaults
      if (is_default) {
        await database.run('UPDATE templates SET is_default = 0 WHERE is_default = 1');
      }

      const templateData = {
        id: templateId,
        name: name.trim(),
        description: description?.trim() || '',
        config: templateConfig,
        is_default: is_default || false
      };

      const updatedTemplate = await database.saveTemplate(templateData);
      
      logger.logTemplateAction('template_updated', templateId, {
        name: updatedTemplate.name,
        isDefault: updatedTemplate.is_default
      });

      res.json(updatedTemplate);
    } catch (error) {
      logger.error('Failed to update template', { error: error.message, templateId: req.params.templateId });
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  // Delete template
  router.delete('/:templateId', async (req, res) => {
    try {
      const templateId = req.params.templateId;
      const template = await database.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Check if template is in use
      const credentialsUsingTemplate = await database.get(`
        SELECT COUNT(*) as count FROM credentials WHERE template_id = ?
      `, [templateId]);
      
      if (credentialsUsingTemplate.count > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete template that is in use by credentials' 
        });
      }

      await database.deleteTemplate(templateId);
      
      logger.logTemplateAction('template_deleted', templateId, {
        name: template.name
      });

      res.json({ message: 'Template deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete template', { error: error.message, templateId: req.params.templateId });
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // Duplicate template
  router.post('/:templateId/duplicate', async (req, res) => {
    try {
      const templateId = req.params.templateId;
      const originalTemplate = await database.getTemplate(templateId);
      
      if (!originalTemplate) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const { name, description } = req.body;
      
      const newTemplate = {
        name: name || `${originalTemplate.name} (Copy)`,
        description: description || originalTemplate.description,
        config: { ...originalTemplate.config },
        is_default: false
      };

      const savedTemplate = await database.saveTemplate(newTemplate);
      
      logger.logTemplateAction('template_duplicated', savedTemplate.id, {
        originalTemplateId: templateId,
        name: savedTemplate.name
      });

      res.json(savedTemplate);
    } catch (error) {
      logger.error('Failed to duplicate template', { error: error.message, templateId: req.params.templateId });
      res.status(500).json({ error: 'Failed to duplicate template' });
    }
  });

  // Export template to JSON file
  router.get('/:templateId/export', async (req, res) => {
    try {
      const templateId = req.params.templateId;
      const template = await database.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const exportData = {
        ...template,
        exported_at: moment().toISOString(),
        version: '1.0'
      };

      const filename = `${template.name.replace(/[^a-zA-Z0-9]/g, '_')}_${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(exportData);
      
      logger.logTemplateAction('template_exported', templateId, {
        name: template.name,
        filename
      });
    } catch (error) {
      logger.error('Failed to export template', { error: error.message, templateId: req.params.templateId });
      res.status(500).json({ error: 'Failed to export template' });
    }
  });

  // Import template from JSON file
  router.post('/import', async (req, res) => {
    try {
      const { templateData } = req.body;
      
      if (!templateData || !templateData.name || !templateData.config) {
        return res.status(400).json({ error: 'Invalid template data' });
      }

      // Validate template configuration
      const validationResult = validateTemplateConfig(templateData.config);
      if (!validationResult.isValid) {
        return res.status(400).json({ 
          error: 'Invalid template configuration', 
          details: validationResult.errors 
        });
      }

      // Generate new ID for imported template
      const newTemplate = {
        name: templateData.name.trim(),
        description: templateData.description?.trim() || '',
        config: templateData.config,
        is_default: false
      };

      const savedTemplate = await database.saveTemplate(newTemplate);
      
      logger.logTemplateAction('template_imported', savedTemplate.id, {
        name: savedTemplate.name,
        originalId: templateData.id
      });

      res.json(savedTemplate);
    } catch (error) {
      logger.error('Failed to import template', { error: error.message });
      res.status(500).json({ error: 'Failed to import template' });
    }
  });

  // Get default template
  router.get('/default', async (req, res) => {
    try {
      const defaultTemplate = await database.get('SELECT * FROM templates WHERE is_default = 1');
      
      if (!defaultTemplate) {
        // Return the first template if no default is set
        const firstTemplate = await database.get('SELECT * FROM templates ORDER BY name LIMIT 1');
        if (firstTemplate) {
          firstTemplate.config = JSON.parse(firstTemplate.config);
          return res.json(firstTemplate);
        }
        return res.status(404).json({ error: 'No templates found' });
      }

      defaultTemplate.config = JSON.parse(defaultTemplate.config);
      res.json(defaultTemplate);
    } catch (error) {
      logger.error('Failed to get default template', { error: error.message });
      res.status(500).json({ error: 'Failed to get default template' });
    }
  });

  // Get event-specific templates
  router.get('/event/:eventId', async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const templates = await database.getEventTemplates(eventId);
      res.json(templates);
    } catch (error) {
      logger.error('Failed to get event templates', { error: error.message, eventId: req.params.eventId });
      res.status(500).json({ error: 'Failed to get event templates' });
    }
  });

  // Create event-specific template or associate existing template with event
  router.post('/event/:eventId', async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const { name, description, config: templateConfig, template_id } = req.body;
      
      console.log('Template association request:', { eventId, name, description, templateConfig, template_id });
      
      // If template_id is provided, create a new event-specific template based on the existing one
      if (template_id) {
        console.log('Processing template_id association for template:', template_id);
        
        const existingTemplate = await database.getTemplate(template_id);
        if (!existingTemplate) {
          console.log('Template not found:', template_id);
          return res.status(404).json({ error: 'Template not found' });
        }
        
        console.log('Found existing template:', existingTemplate.name);
        
        // Check if an event-specific template based on this template already exists
        const existingEventTemplates = await database.getEventTemplates(eventId);
        
        // ALWAYS clean up old event-specific templates when switching to a new template
        if (existingEventTemplates.length > 0) {
          console.log('Cleaning up old event-specific templates before creating new one');
          for (const oldTemplate of existingEventTemplates) {
            try {
              await database.run('DELETE FROM templates WHERE id = ?', [oldTemplate.id]);
              console.log('Deleted old template:', oldTemplate.id, oldTemplate.name);
            } catch (deleteError) {
              console.warn('Failed to delete old template:', oldTemplate.id, deleteError.message);
            }
          }
        }
        
        // After cleanup, fetch fresh list of event templates
        const freshEventTemplates = await database.getEventTemplates(eventId);
        console.log('After cleanup, fresh event templates count:', freshEventTemplates.length);
        
        // Look for templates that are based on the same original template
        // We can identify this by checking if the config is identical (indicating it's a clone of the same template)
        const existingEventTemplate = freshEventTemplates.find(t => {
          // Check if config is identical (indicating it's a clone of the same template)
          return JSON.stringify(t.config) === JSON.stringify(existingTemplate.config);
        });
        
        if (existingEventTemplate) {
          console.log('Event-specific template already exists, returning existing one:', existingEventTemplate.id);
          
          // Update the existing template with a better name if it doesn't have one
          if (!existingEventTemplate.name.includes(' - ') && !existingEventTemplate.name.includes('(')) {
            const event = await database.getEvent(eventId);
            if (event) {
              const newName = `${existingEventTemplate.name} - ${event.name}`;
              const newDescription = `${existingEventTemplate.description} (Event-specific copy)`;
              
              // Update the template name and description
              await database.run(
                'UPDATE templates SET name = ?, description = ? WHERE id = ?',
                [newName, newDescription, existingEventTemplate.id]
              );
              
              // Update the returned object
              existingEventTemplate.name = newName;
              existingEventTemplate.description = newDescription;
              
              console.log('Updated existing template name to:', newName);
            }
          }
          
          res.json({ 
            message: 'Template already associated with event',
            template: existingEventTemplate
          });
          return;
        }
        
        // Create a new event-specific template based on the existing one
        // Generate a unique name by adding event date if needed
        let templateName = existingTemplate.name;
        let templateDescription = existingTemplate.description;
        
        // If this is a duplicate name, add event date to make it unique
        const duplicateCount = freshEventTemplates.filter(t => 
          t.name === existingTemplate.name
        ).length;
        
        if (duplicateCount > 0) {
          const event = await database.getEvent(eventId);
          if (event) {
            const eventDate = new Date(event.date).toLocaleDateString();
            templateName = `${existingTemplate.name} (${eventDate})`;
            templateDescription = `${existingTemplate.description} - Event: ${event.name}`;
          }
        } else {
          // Add event identifier to make it clear this is an event-specific copy
          const event = await database.getEvent(eventId);
          if (event) {
            templateName = `${existingTemplate.name} - ${event.name}`;
            templateDescription = `${existingTemplate.description} (Event-specific copy)`;
          }
        }
        
        const eventTemplateData = {
          name: templateName,
          description: templateDescription,
          config: existingTemplate.config,
          event_id: eventId
        };

        console.log('Creating event template with data:', eventTemplateData);
        
        try {
          const savedEventTemplate = await database.createEventTemplate(eventId, eventTemplateData);
          
          console.log('Event template created successfully:', savedEventTemplate.id);
          
          logger.logTemplateAction('template_associated_with_event', savedEventTemplate.id, {
            name: savedEventTemplate.name,
            eventId: eventId,
            basedOnTemplate: template_id
          });

          res.json({ 
            message: 'Template associated with event successfully',
            template: savedEventTemplate
          });
          return;
        } catch (dbError) {
          console.error('Database error creating event template:', dbError);
          return res.status(500).json({ 
            error: 'Failed to create event template',
            details: dbError.message 
          });
        }
      }
      
      // Otherwise, create a new event-specific template
      if (!name || !templateConfig) {
        console.log('Missing required fields:', { name: !!name, templateConfig: !!templateConfig });
        return res.status(400).json({ error: 'Template name and configuration are required' });
      }

      // Validate template configuration
      const validationResult = validateTemplateConfig(templateConfig);
      if (!validationResult.isValid) {
        console.log('Template validation failed:', validationResult.errors);
        return res.status(400).json({ 
          error: 'Invalid template configuration', 
          details: validationResult.errors 
        });
      }

      const templateData = {
        name: name.trim(),
        description: description?.trim() || '',
        config: templateConfig,
        event_id: eventId
      };

      const savedTemplate = await database.createEventTemplate(eventId, templateData);
      
      logger.logTemplateAction('event_template_saved', savedTemplate.id, {
        name: savedTemplate.name,
        eventId: eventId
      });

      res.json(savedTemplate);
    } catch (error) {
      logger.error('Failed to save event template', { error: error.message, eventId: req.params.eventId });
      res.status(500).json({ error: 'Failed to save event template' });
    }
  });

  // Set default template
  router.post('/:templateId/set-default', async (req, res) => {
    try {
      const templateId = req.params.templateId;
      const template = await database.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Unset current default
      await database.run('UPDATE templates SET is_default = 0 WHERE is_default = 1');
      
      // Set new default
      await database.run('UPDATE templates SET is_default = 1 WHERE id = ?', [templateId]);
      
      logger.logTemplateAction('template_set_default', templateId, {
        name: template.name
      });

      res.json({ message: 'Default template updated successfully' });
    } catch (error) {
      logger.error('Failed to set default template', { error: error.message, templateId: req.params.templateId });
      res.status(500).json({ error: 'Failed to set default template' });
    }
  });

  // Preview template with sample data
  router.post('/:templateId/preview', async (req, res) => {
    try {
      const templateId = req.params.templateId;
      const template = await database.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const { sampleData } = req.body;
      
      // Generate preview data if none provided
      const previewData = sampleData || {
        firstName: 'John',
        lastName: 'Doe',
        middleName: 'M',
        birthDate: '1990-01-15',
        address: '1234 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
        phone: '(555) 123-4567',
        email: 'john.doe@example.com',
        eventName: 'Sample Event',
        eventDate: '2025-01-15'
      };

      // Generate preview image (this would integrate with the label renderer)
      const previewResult = await generateLabelPreview(template.config, previewData);
      
      res.json({
        template: template,
        previewData: previewData,
        preview: previewResult
      });
    } catch (error) {
      logger.error('Failed to generate template preview', { error: error.message, templateId: req.params.templateId });
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  });

  // Validate template configuration
  function validateTemplateConfig(config) {
    const errors = [];
    
    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return { isValid: false, errors };
    }

    if (!config.width || !config.height) {
      errors.push('Template must have width and height');
    }

    if (config.width <= 0 || config.height <= 0) {
      errors.push('Template dimensions must be positive numbers');
    }

    if (!Array.isArray(config.elements)) {
      errors.push('Template must have elements array');
    } else {
      config.elements.forEach((element, index) => {
        if (!element.type) {
          errors.push(`Element ${index} must have a type`);
        }
        
        if (element.type === 'text' && !element.content) {
          errors.push(`Text element ${index} must have content`);
        }
        
        if (element.type === 'checkbox' && !element.label) {
          errors.push(`Checkbox element ${index} must have a label`);
        }
        
        // Allow background-image type for Visual Designer templates
        if (element.type === 'background-image') {
          // Background images are valid, no additional validation needed
        }
        
        if (typeof element.x !== 'number' || typeof element.y !== 'number') {
          errors.push(`Element ${index} must have valid x, y coordinates`);
        }
        
        if (typeof element.width !== 'number' || typeof element.height !== 'number') {
          errors.push(`Element ${index} must have valid width, height`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Generate label preview (placeholder - would integrate with actual renderer)
  async function generateLabelPreview(templateConfig, sampleData) {
    // This is a placeholder - in the actual implementation, this would:
    // 1. Use a canvas library to render the label
    // 2. Apply the template configuration
    // 3. Fill in sample data
    // 4. Return a base64 image or SVG
    
    return {
      type: 'preview',
      width: templateConfig.width,
      height: templateConfig.height,
      foldOver: templateConfig.foldOver || false,
      elements: templateConfig.elements.map(element => ({
        ...element,
        previewContent: element.type === 'text' ? 
          (element.content || '').replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
            // Convert field name to camelCase for standard fields
            const camelCaseField = fieldName.replace(/([-_][a-z])/g, (g) => g[1].toUpperCase());
            
            // Check if it's a standard field first (camelCase)
            if (sampleData[camelCaseField] !== undefined) {
              return sampleData[camelCaseField] || '';
            }
            
            // Check if it's a direct field match
            if (sampleData[fieldName] !== undefined) {
              return sampleData[fieldName] || '';
            }
            
            // Check if it's in custom fields
            if (sampleData.custom_fields) {
              try {
                const customFields = JSON.parse(sampleData.custom_fields);
                if (customFields[fieldName] !== undefined) {
                  return customFields[fieldName] || '';
                }
              } catch (e) {
                console.warn('Failed to parse custom fields for preview:', e);
              }
            }
            
            // Return the original placeholder if no match found
            return match;
          }) : element
      }))
    };
  }

  return router;
};

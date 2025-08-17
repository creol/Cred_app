const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

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
      const { id, name, description, config: templateConfig, is_default } = req.body;
      
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

      const savedTemplate = await database.saveTemplate(templateData);
      
      logger.logTemplateAction('template_saved', templateId, {
        name: savedTemplate.name,
        isDefault: savedTemplate.is_default
      });

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

  // Create event-specific template
  router.post('/event/:eventId', async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const { name, description, config: templateConfig } = req.body;
      
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
        title: 'Event Coordinator',
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
          (element.content || '').replace(/\{\{(\w+)\}\}/g, (match, field) => 
            sampleData[field] || match
          ) : element
      }))
    };
  }

  return router;
};

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/simple-templates');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Allow DOCX, PDF, and image files
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'application/octet-stream'
        ];
        
        const allowedExtensions = ['.docx', '.pdf', '.png', '.jpg', '.jpeg'];
        
        const hasValidMime = allowedMimes.includes(file.mimetype);
        const hasValidExtension = allowedExtensions.some(ext => 
            file.originalname.toLowerCase().endsWith(ext)
        );
        
        if (hasValidMime || hasValidExtension) {
            cb(null, true);
        } else {
            cb(new Error(`File type not allowed. Received: ${file.mimetype}, ${file.originalname}`), false);
        }
    }
});

// Upload simple template (PDF/Image background + field positions)
router.post('/upload', upload.single('template'), async (req, res) => {
    console.log('=== Simple Template Upload ===');
    console.log('File:', req.file);
    console.log('Body:', req.body);
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No template file uploaded' });
        }

        const templatePath = req.file.path;
        const templateName = req.body.name || req.file.originalname.replace(/\.(docx|pdf|png|jpg|jpeg)$/i, '');
        const templateDescription = req.body.description || '';
        
        // Determine template type
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        let templateType = 'image';
        if (fileExt === '.pdf') templateType = 'pdf';
        if (fileExt === '.docx') templateType = 'docx';

        // Read file as base64 for storage
        const fileContent = fs.readFileSync(templatePath);
        const base64Content = fileContent.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64Content}`;

        // Create template record
        const template = {
            id: uuidv4(),
            name: templateName,
            description: templateDescription,
            type: 'simple',
            backgroundType: templateType,
            backgroundData: dataUrl,
            filePath: templatePath,
            fileName: req.file.filename,
            originalName: req.file.originalname,
            fields: [], // Will be populated by user in UI
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save template to database
        await saveTemplateToDatabase(template);

        res.json({
            success: true,
            template: template,
            message: 'Template uploaded successfully! You can now add fields in the designer.'
        });

    } catch (error) {
        console.error('=== Upload Error ===');
        console.error('Error:', error);
        
        // Clean up uploaded file
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Failed to cleanup file:', cleanupError);
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to process template', 
            details: error.message
        });
    }
});

// Update template fields
router.put('/:templateId/fields', async (req, res) => {
    try {
        const templateId = req.params.templateId;
        const fields = req.body.fields || [];

        console.log('Updating template fields:', templateId, fields);

        const template = await getTemplateFromDatabase(templateId);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        template.fields = fields;
        template.updatedAt = new Date().toISOString();

        await updateTemplateInDatabase(template);

        res.json({
            success: true,
            template: template,
            message: 'Template fields updated successfully'
        });

    } catch (error) {
        console.error('Error updating template fields:', error);
        res.status(500).json({ 
            error: 'Failed to update template fields', 
            details: error.message 
        });
    }
});

// Generate PDF from simple template
router.post('/:templateId/generate-pdf', async (req, res) => {
    try {
        const templateId = req.params.templateId;
        const contactData = req.body.contactData || {};

        const template = await getTemplateFromDatabase(templateId);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Generate PDF using jsPDF on server side
        const pdfBuffer = await generatePdfFromSimpleTemplate(template, contactData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${template.name}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF', 
            details: error.message 
        });
    }
});

// Get all simple templates
router.get('/', async (req, res) => {
    try {
        const templates = await getAllTemplatesFromDatabase();
        res.json(templates);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// Delete template
router.delete('/:templateId', async (req, res) => {
    try {
        const templateId = req.params.templateId;
        const template = await getTemplateFromDatabase(templateId);
        
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Delete the file
        if (fs.existsSync(template.filePath)) {
            fs.unlinkSync(template.filePath);
        }

        await deleteTemplateFromDatabase(templateId);

        res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// Helper Functions

async function generatePdfFromSimpleTemplate(template, contactData) {
    // This will be implemented using a simple canvas-to-PDF approach
    // For now, return a placeholder
    return Buffer.from('PDF generation not yet implemented for simple templates');
}

// Database functions (using JSON file)
const TEMPLATES_FILE = path.join(__dirname, '../data/simple-templates.json');

async function saveTemplateToDatabase(template) {
    try {
        const dataDir = path.dirname(TEMPLATES_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        let templates = [];
        if (fs.existsSync(TEMPLATES_FILE)) {
            const data = fs.readFileSync(TEMPLATES_FILE, 'utf8');
            templates = JSON.parse(data);
        }

        templates.push(template);
        fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
    } catch (error) {
        console.error('Error saving template to database:', error);
        throw error;
    }
}

async function getTemplateFromDatabase(templateId) {
    try {
        if (!fs.existsSync(TEMPLATES_FILE)) {
            return null;
        }

        const data = fs.readFileSync(TEMPLATES_FILE, 'utf8');
        const templates = JSON.parse(data);
        return templates.find(t => t.id === templateId);
    } catch (error) {
        console.error('Error getting template from database:', error);
        return null;
    }
}

async function updateTemplateInDatabase(updatedTemplate) {
    try {
        if (!fs.existsSync(TEMPLATES_FILE)) {
            throw new Error('Templates file not found');
        }

        const data = fs.readFileSync(TEMPLATES_FILE, 'utf8');
        let templates = JSON.parse(data);
        
        const index = templates.findIndex(t => t.id === updatedTemplate.id);
        if (index === -1) {
            throw new Error('Template not found');
        }

        templates[index] = updatedTemplate;
        fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
    } catch (error) {
        console.error('Error updating template in database:', error);
        throw error;
    }
}

async function getAllTemplatesFromDatabase() {
    try {
        if (!fs.existsSync(TEMPLATES_FILE)) {
            return [];
        }

        const data = fs.readFileSync(TEMPLATES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error getting templates from database:', error);
        return [];
    }
}

async function deleteTemplateFromDatabase(templateId) {
    try {
        if (!fs.existsSync(TEMPLATES_FILE)) {
            return;
        }

        const data = fs.readFileSync(TEMPLATES_FILE, 'utf8');
        const templates = JSON.parse(data);
        const filteredTemplates = templates.filter(t => t.id !== templateId);
        
        fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(filteredTemplates, null, 2));
    } catch (error) {
        console.error('Error deleting template from database:', error);
        throw error;
    }
}

module.exports = router;

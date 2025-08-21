/**
 * Modern Label Designer using Fabric.js
 * A professional, intuitive label design interface
 */

class ModernLabelDesigner {
    constructor() {
        this.canvas = null;
        this.template = null;
        this.availableFields = [];
        this.backgroundImage = null;
        this.selectedObject = null;
        
        // Label dimensions (4" x 6" = 400px x 600px at 100 DPI)
        this.labelWidth = 400;
        this.labelHeight = 600;
        
        this.init();
    }

    async init() {
        await this.loadFabricJS();
        this.setupCanvas();
        this.setupEventListeners();
        this.loadAvailableFields();
        this.loadDefaultTemplate();
    }

    async loadFabricJS() {
        // Load Fabric.js from CDN
        if (!window.fabric) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js';
            document.head.appendChild(script);
            
            await new Promise((resolve) => {
                script.onload = resolve;
            });
        }
    }

    setupCanvas() {
        // Create Fabric.js canvas
        const canvasElement = document.getElementById('modernLabelCanvas');
        this.canvas = new fabric.Canvas(canvasElement, {
            width: this.labelWidth,
            height: this.labelHeight,
            backgroundColor: '#ffffff',
            selection: true,
            preserveObjectStacking: true
        });

        // Add fold line
        this.addFoldLine();

        // Canvas event handlers
        this.canvas.on('selection:created', (e) => this.onObjectSelected(e.selected[0]));
        this.canvas.on('selection:updated', (e) => this.onObjectSelected(e.selected[0]));
        this.canvas.on('selection:cleared', () => this.onObjectDeselected());
        this.canvas.on('object:modified', () => this.updatePropertiesPanel());
    }

    addFoldLine() {
        // Add fold line at 3" (300px)
        const foldLine = new fabric.Line([0, 300, this.labelWidth, 300], {
            stroke: '#ff6b6b',
            strokeWidth: 2,
            strokeDashArray: [10, 5],
            selectable: false,
            evented: false,
            excludeFromExport: true
        });
        this.canvas.add(foldLine);

        // Add fold text
        const foldText = new fabric.Text('FOLD LINE', {
            left: this.labelWidth - 80,
            top: 285,
            fontSize: 10,
            fill: '#ff6b6b',
            fontFamily: 'Arial',
            selectable: false,
            evented: false,
            excludeFromExport: true
        });
        this.canvas.add(foldText);
    }

    async loadAvailableFields() {
        try {
            if (window.currentEvent) {
                const response = await fetch(`/api/events/${window.currentEvent.id}/csv-headers`);
                if (response.ok) {
                    const result = await response.json();
                    this.availableFields = [
                        'firstName', 'lastName', 'middleName', 'birthDate',
                        'address', 'city', 'state', 'zip', 'phone', 'email',
                        'eventName', 'eventDate',
                        ...(result.headers || [])
                    ];
                } else {
                    this.availableFields = [
                        'firstName', 'lastName', 'middleName', 'birthDate',
                        'address', 'city', 'state', 'zip', 'phone', 'email',
                        'eventName', 'eventDate'
                    ];
                }
            } else {
                this.availableFields = [
                    'firstName', 'lastName', 'middleName', 'birthDate',
                    'address', 'city', 'state', 'zip', 'phone', 'email',
                    'eventName', 'eventDate'
                ];
            }
            this.updateFieldSelector();
        } catch (error) {
            console.error('Failed to load available fields:', error);
        }
    }

    updateFieldSelector() {
        const fieldSelect = document.getElementById('fieldSelector');
        if (fieldSelect) {
            fieldSelect.innerHTML = '<option value="">Select a field...</option>';
            this.availableFields.forEach(field => {
                const option = document.createElement('option');
                option.value = field;
                option.textContent = `{{${field}}}`;
                fieldSelect.appendChild(option);
            });
        }
    }

    loadDefaultTemplate() {
        this.template = {
            name: 'Modern Label Template',
            description: 'Professional label design',
            config: {
                width: 4,
                height: 6,
                foldOver: true,
                backgroundImage: null,
                elements: []
            }
        };
    }

    // Background Management
    async setBackground(file) {
        try {
            const dataUrl = await this.fileToDataUrl(file);
            
            // Remove existing background
            if (this.backgroundImage) {
                this.canvas.remove(this.backgroundImage);
            }

            if (file.type === 'application/pdf') {
                // For PDFs, we'll convert to image
                const imageDataUrl = await this.convertPdfToImage(dataUrl);
                this.addBackgroundImage(imageDataUrl);
            } else {
                // For images, use directly
                this.addBackgroundImage(dataUrl);
            }

            this.template.config.backgroundImage = dataUrl;
            this.showSuccess('Background set successfully!');
        } catch (error) {
            console.error('Failed to set background:', error);
            this.showError('Failed to set background. Please try again.');
        }
    }

    addBackgroundImage(dataUrl) {
        fabric.Image.fromURL(dataUrl, (img) => {
            img.set({
                left: 0,
                top: 0,
                selectable: false,
                evented: false,
                excludeFromExport: false
            });

            // Scale to fit canvas
            const scaleX = this.labelWidth / img.width;
            const scaleY = this.labelHeight / img.height;
            const scale = Math.min(scaleX, scaleY);
            
            img.scale(scale);
            
            // Center the image
            img.set({
                left: (this.labelWidth - img.getScaledWidth()) / 2,
                top: (this.labelHeight - img.getScaledHeight()) / 2
            });

            this.backgroundImage = img;
            this.canvas.add(img);
            this.canvas.sendToBack(img);
            this.canvas.renderAll();
        });
    }

    async convertPdfToImage(pdfDataUrl) {
        // Simple PDF to image conversion using a canvas
        // For now, we'll return the PDF data URL and handle it in the print function
        return pdfDataUrl;
    }

    removeBackground() {
        if (this.backgroundImage) {
            this.canvas.remove(this.backgroundImage);
            this.backgroundImage = null;
            this.template.config.backgroundImage = null;
            this.canvas.renderAll();
            this.showSuccess('Background removed!');
        }
    }

    // Text Field Management
    addTextField(content = 'New Text') {
        const textObj = new fabric.Text(content, {
            left: 50,
            top: 50,
            fontSize: 16,
            fontFamily: 'Arial',
            fill: '#000000',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            padding: 5
        });

        this.canvas.add(textObj);
        this.canvas.setActiveObject(textObj);
        this.canvas.renderAll();
    }

    addFieldFromSelector() {
        const fieldSelect = document.getElementById('fieldSelector');
        const selectedField = fieldSelect.value;
        
        if (selectedField) {
            this.addTextField(`{{${selectedField}}}`);
            fieldSelect.value = '';
        }
    }

    // Object Property Management
    onObjectSelected(obj) {
        this.selectedObject = obj;
        this.updatePropertiesPanel();
    }

    onObjectDeselected() {
        this.selectedObject = null;
        this.clearPropertiesPanel();
    }

    updatePropertiesPanel() {
        const panel = document.getElementById('propertiesPanel');
        if (!this.selectedObject || !panel) return;

        const obj = this.selectedObject;
        
        if (obj.type === 'text') {
            panel.innerHTML = `
                <h6>Text Properties</h6>
                <div class="mb-2">
                    <label class="form-label">Content</label>
                    <input type="text" class="form-control" id="textContent" value="${obj.text}" />
                </div>
                <div class="row">
                    <div class="col-6">
                        <label class="form-label">Font Size</label>
                        <input type="number" class="form-control" id="fontSize" value="${obj.fontSize}" min="8" max="72" />
                    </div>
                    <div class="col-6">
                        <label class="form-label">Font Family</label>
                        <select class="form-control" id="fontFamily">
                            <option value="Arial" ${obj.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                            <option value="Times New Roman" ${obj.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                            <option value="Helvetica" ${obj.fontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                        </select>
                    </div>
                </div>
                <div class="row mt-2">
                    <div class="col-6">
                        <label class="form-label">Color</label>
                        <input type="color" class="form-control" id="textColor" value="${obj.fill}" />
                    </div>
                    <div class="col-6">
                        <label class="form-label">Background</label>
                        <input type="color" class="form-control" id="backgroundColor" value="${obj.backgroundColor || '#ffffff'}" />
                    </div>
                </div>
                <div class="row mt-2">
                    <div class="col-4">
                        <label class="form-check-label">
                            <input type="checkbox" class="form-check-input" id="boldText" ${obj.fontWeight === 'bold' ? 'checked' : ''} />
                            Bold
                        </label>
                    </div>
                    <div class="col-4">
                        <label class="form-check-label">
                            <input type="checkbox" class="form-check-input" id="italicText" ${obj.fontStyle === 'italic' ? 'checked' : ''} />
                            Italic
                        </label>
                    </div>
                    <div class="col-4">
                        <button class="btn btn-sm btn-outline-primary" id="rotate180">
                            Rotate 180°
                        </button>
                    </div>
                </div>
                <div class="mt-2">
                    <button class="btn btn-sm btn-danger" id="deleteObject">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;

            this.setupPropertyListeners();
        }
    }

    setupPropertyListeners() {
        const obj = this.selectedObject;
        if (!obj) return;

        // Text content
        const textContent = document.getElementById('textContent');
        if (textContent) {
            textContent.addEventListener('input', (e) => {
                obj.set('text', e.target.value);
                this.canvas.renderAll();
            });
        }

        // Font size
        const fontSize = document.getElementById('fontSize');
        if (fontSize) {
            fontSize.addEventListener('input', (e) => {
                obj.set('fontSize', parseInt(e.target.value));
                this.canvas.renderAll();
            });
        }

        // Font family
        const fontFamily = document.getElementById('fontFamily');
        if (fontFamily) {
            fontFamily.addEventListener('change', (e) => {
                obj.set('fontFamily', e.target.value);
                this.canvas.renderAll();
            });
        }

        // Text color
        const textColor = document.getElementById('textColor');
        if (textColor) {
            textColor.addEventListener('input', (e) => {
                obj.set('fill', e.target.value);
                this.canvas.renderAll();
            });
        }

        // Background color
        const backgroundColor = document.getElementById('backgroundColor');
        if (backgroundColor) {
            backgroundColor.addEventListener('input', (e) => {
                obj.set('backgroundColor', e.target.value);
                this.canvas.renderAll();
            });
        }

        // Bold
        const boldText = document.getElementById('boldText');
        if (boldText) {
            boldText.addEventListener('change', (e) => {
                obj.set('fontWeight', e.target.checked ? 'bold' : 'normal');
                this.canvas.renderAll();
            });
        }

        // Italic
        const italicText = document.getElementById('italicText');
        if (italicText) {
            italicText.addEventListener('change', (e) => {
                obj.set('fontStyle', e.target.checked ? 'italic' : 'normal');
                this.canvas.renderAll();
            });
        }

        // Rotate 180°
        const rotate180 = document.getElementById('rotate180');
        if (rotate180) {
            rotate180.addEventListener('click', () => {
                const currentAngle = obj.angle || 0;
                obj.set('angle', currentAngle + 180);
                this.canvas.renderAll();
            });
        }

        // Delete
        const deleteObject = document.getElementById('deleteObject');
        if (deleteObject) {
            deleteObject.addEventListener('click', () => {
                this.canvas.remove(obj);
                this.clearPropertiesPanel();
            });
        }
    }

    clearPropertiesPanel() {
        const panel = document.getElementById('propertiesPanel');
        if (panel) {
            panel.innerHTML = '<p class="text-muted">Select an object to edit its properties</p>';
        }
    }

    // Template Management
    saveTemplate() {
        // Convert canvas to template data
        const objects = this.canvas.getObjects().filter(obj => !obj.excludeFromExport);
        
        this.template.config.elements = objects.map(obj => {
            if (obj.type === 'text') {
                return {
                    type: 'text',
                    id: obj.id || `text-${Date.now()}`,
                    content: obj.text,
                    x: obj.left / 100, // Convert to inches
                    y: obj.top / 100,
                    width: obj.getScaledWidth() / 100,
                    height: obj.getScaledHeight() / 100,
                    fontSize: obj.fontSize,
                    fontFamily: obj.fontFamily,
                    fill: obj.fill,
                    backgroundColor: obj.backgroundColor,
                    fontWeight: obj.fontWeight,
                    fontStyle: obj.fontStyle,
                    angle: obj.angle || 0
                };
            }
            return null;
        }).filter(Boolean);

        console.log('Saving template:', this.template);
        this.showSuccess('Template saved locally!');
        return this.template;
    }

    exportTemplate() {
        const template = this.saveTemplate();
        const dataStr = JSON.stringify(template, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${template.name.replace(/\s+/g, '_')}.json`;
        link.click();
    }

    // Utility Functions
    async fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    showSuccess(message) {
        if (window.showSuccess) {
            window.showSuccess(message);
        } else {
            console.log('Success:', message);
        }
    }

    showError(message) {
        if (window.showError) {
            window.showError(message);
        } else {
            console.error('Error:', message);
        }
    }

    // Setup Event Listeners
    setupEventListeners() {
        // Background upload
        const backgroundUpload = document.getElementById('backgroundUpload');
        if (backgroundUpload) {
            backgroundUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.setBackground(file);
                }
            });
        }

        // Remove background
        const removeBackground = document.getElementById('removeBackground');
        if (removeBackground) {
            removeBackground.addEventListener('click', () => {
                this.removeBackground();
            });
        }

        // Add text field
        const addTextField = document.getElementById('addTextField');
        if (addTextField) {
            addTextField.addEventListener('click', () => {
                this.addTextField();
            });
        }

        // Add field from selector
        const addFieldBtn = document.getElementById('addFieldBtn');
        if (addFieldBtn) {
            addFieldBtn.addEventListener('click', () => {
                this.addFieldFromSelector();
            });
        }

        // Save template
        const saveTemplate = document.getElementById('saveTemplate');
        if (saveTemplate) {
            saveTemplate.addEventListener('click', () => {
                this.saveTemplate();
            });
        }

        // Export template
        const exportTemplate = document.getElementById('exportTemplate');
        if (exportTemplate) {
            exportTemplate.addEventListener('click', () => {
                this.exportTemplate();
            });
        }

        // Print preview
        const printPreview = document.getElementById('printPreview');
        if (printPreview) {
            printPreview.addEventListener('click', () => {
                this.showPrintPreview();
            });
        }

        // Test print
        const testPrint = document.getElementById('testPrint');
        if (testPrint) {
            testPrint.addEventListener('click', () => {
                this.testPrint();
            });
        }
    }

    // Print Functions
    showPrintPreview() {
        const template = this.saveTemplate();
        
        // Create sample data for preview
        const sampleData = {
            firstName: 'John',
            lastName: 'Doe',
            middleName: 'M',
            birthDate: '1990-01-01',
            address: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zip: '12345',
            phone: '(555) 123-4567',
            email: 'john.doe@example.com',
            eventName: window.currentEvent ? window.currentEvent.name : 'Sample Event',
            eventDate: window.currentEvent ? window.currentEvent.date : '2024-01-01'
        };

        // Generate PDF
        const pdfBlob = this.generatePdfFromTemplate(template, sampleData);
        
        // Show in new window for preview
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
    }

    testPrint() {
        console.log('🚨 MODERN DESIGNER testPrint() called - this should not happen!');
        const template = this.saveTemplate();
        
        // Create sample data for test print
        const sampleData = {
            firstName: 'TEST',
            lastName: 'PRINT',
            middleName: '',
            birthDate: 'MM/DD/YYYY',
            address: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zip: '12345',
            phone: '(555) TEST',
            email: 'test@example.com',
            eventName: 'TEST EVENT',
            eventDate: new Date().toLocaleDateString()
        };

        // Generate PDF
        const pdfBlob = this.generatePdfFromTemplate(template, sampleData);
        
        // Print the PDF
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Create iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = pdfUrl;
        
        iframe.onload = () => {
            iframe.contentWindow.print();
            // Clean up after printing
            setTimeout(() => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(pdfUrl);
            }, 1000);
        };
        
        document.body.appendChild(iframe);
        
        this.showSuccess('Test print sent to printer!');
    }

    generatePdfFromTemplate(template, contactData) {
        // Create new PDF document (4" x 6" = 288 x 432 points)
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: [288, 432] // 4" x 6"
        });

        // Add background if present
        if (template.config.backgroundImage) {
            try {
                doc.addImage(template.config.backgroundImage, 'JPEG', 0, 0, 288, 432);
            } catch (error) {
                console.warn('Failed to add background to PDF:', error);
            }
        }

        // Set default font
        doc.setFont('helvetica');

        // Process each element
        template.config.elements.forEach(element => {
            if (element.type === 'text') {
                // Replace placeholders with actual data
                let content = element.content || '';
                content = content.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
                    return contactData[fieldName] || match;
                });

                // Convert positions back to points (72 points per inch)
                const x = element.x * 72;
                const y = element.y * 72;

                // Set font properties
                doc.setFontSize(element.fontSize || 12);
                if (element.fontWeight === 'bold') {
                    doc.setFont('helvetica', 'bold');
                } else {
                    doc.setFont('helvetica', 'normal');
                }

                // Set text color
                if (element.fill) {
                    const color = this.hexToRgb(element.fill);
                    if (color) {
                        doc.setTextColor(color.r, color.g, color.b);
                    }
                }

                // Handle rotation
                if (element.angle && element.angle !== 0) {
                    doc.saveGraphicsState();
                    doc.setTransformationMatrix(
                        Math.cos(element.angle * Math.PI / 180),
                        Math.sin(element.angle * Math.PI / 180),
                        -Math.sin(element.angle * Math.PI / 180),
                        Math.cos(element.angle * Math.PI / 180),
                        x,
                        y
                    );
                    doc.text(content, 0, 0);
                    doc.restoreGraphicsState();
                } else {
                    doc.text(content, x, y);
                }
            }
        });

        return doc.output('blob');
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('modernLabelCanvas')) {
        window.modernDesigner = new ModernLabelDesigner();
    }
});

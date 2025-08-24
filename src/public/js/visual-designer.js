/**
 * Visual Template Designer
 * Reliable approach for creating label templates with background images and clickable field placement
 */

class VisualDesigner {
    constructor() {
        console.log('🎯 VisualDesigner constructor called');
        
        this.canvas = null;
        this.ctx = null;
        this.backgroundImage = null;
        this.fields = [];
        this.currentTemplateId = null; // Track loaded template for updates
        this.selectedField = null;
        this.selectedFields = []; // For multi-selection
        this.dragOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.scale = 1;
        this.snapToGrid = true;
        this.gridSize = 5; // Finer grid for better precision
        this.showCoordinates = true;
        this.showRulers = true;
        this.availableFields = [];
        this.previewData = null;
        this.previewRecords = [];
        this.currentPreviewIndex = 0;
        this.isPreviewMode = false;
        
        // PDF positioning offsets (in pixels)
        this.pdfOffsetX = 0;
        this.pdfOffsetY = 0;
        
        // History stacks for undo/redo
        this.historyStack = [];
        this.futureStack = [];
        
        console.log('🎯 VisualDesigner calling init()');
        this.init();
    }
    
    resetDesigner() {
        console.log('Resetting Visual Designer state');
        this.fields = [];
        this.currentTemplateId = null;
        this.selectedField = null;
        this.selectedFields = [];
        this.backgroundImage = null;
        this.originalBackgroundImage = null; // Clean background for PDF generation
        this.isDragging = false;
        this.historyStack = [];
        this.futureStack = [];
        
        // Clear template name input and set up validation
        const templateNameInput = document.getElementById('templateNameInput');
        if (templateNameInput) {
            templateNameInput.value = '';
            
            // Add real-time validation
            templateNameInput.addEventListener('input', () => {
                clearTimeout(this.validationTimeout);
                this.validationTimeout = setTimeout(() => {
                    this.validateTemplateNameInput();
                }, 500); // Debounce for 500ms
            });
            
            templateNameInput.addEventListener('blur', () => {
                clearTimeout(this.validationTimeout);
                this.validateTemplateNameInput();
            });
        }
        
        // Hide field properties panel
        const fieldProperties = document.getElementById('fieldProperties');
        if (fieldProperties) {
            fieldProperties.classList.add('d-none');
        }
        
        // Redraw canvas
        this.draw();
        this.renderFieldsList();
        
        console.log('Visual Designer state reset complete');
    }
    
    async loadTemplate(template) {
        console.log('🔄 Loading template into Visual Designer:', template);
        console.log('🔍 Template config structure:', template.config);
        
        try {
            // Reset the designer first
            this.resetDesigner();
            
            // Set template name
            const templateNameInput = document.getElementById('templateNameInput');
            if (templateNameInput && template.name) {
                templateNameInput.value = template.name;
                console.log('📝 Set template name:', template.name);
            }
            // Track current template id for updates
            if (template.id) {
                this.currentTemplateId = template.id;
                console.log('🔗 Tracking currentTemplateId for updates:', this.currentTemplateId);
            }
            
            // Parse template config
        const config = template.config;
        if (!config) {
            console.warn('⚠️ Template has no config to load');
            return;
        }
        
        // STANDARDIZED: Always use 576x864 - ignore stored dimensions
        console.log(`📏 STANDARDIZED: Using fixed 576x864 canvas (ignoring stored ${config.width || 'unknown'}x${config.height || 'unknown'})`);
            
            // Handle different template formats
            let elements = [];
            
            if (config.elements && Array.isArray(config.elements)) {
                // New Visual Designer format
                elements = config.elements;
                console.log('📋 Loading Visual Designer format with', elements.length, 'elements');
            } else if (Array.isArray(config)) {
                // Legacy format where config is directly an array of elements
                elements = config;
                console.log('📋 Loading legacy array format with', elements.length, 'elements');
            } else {
                // Legacy object format - extract text elements
                console.log('📋 Attempting to parse legacy object format');
                console.log('📋 Config keys:', Object.keys(config));
                
                // Look for common legacy properties
                if (config.textElements) {
                    elements = config.textElements;
                    console.log('📋 Found textElements:', elements.length);
                } else {
                    // Try to extract any text-like elements
                    elements = Object.values(config).filter(item => 
                        item && typeof item === 'object' && 
                        (item.type === 'text' || item.content || item.label)
                    );
                    console.log('📋 Extracted text-like elements:', elements.length);
                }
            }
            
            if (elements.length === 0) {
                console.warn('⚠️ No elements found to load');
                alert('This template appears to be empty or in an incompatible format.');
                return;
            }
            
            // Load background image if present
            const backgroundElement = elements.find(el => el.type === 'background-image');
            if (backgroundElement && backgroundElement.content) {
                console.log('🖼️ Loading background image...');
                await this.loadBackgroundFromDataURL(backgroundElement.content);
            }
            
            // Load text fields - filter and deduplicate
            const textElements = elements.filter(el => 
                // Explicitly exclude background images
                el.type !== 'background-image' && 
                (
                    el.type === 'text' || 
                    (el.content && !el.content.startsWith('data:image/')) || 
                    el.label ||
                    (!el.type && (el.x !== undefined || el.y !== undefined))
                )
            );
            
            console.log('📝 Processing', textElements.length, 'text elements');
            
            // Deduplicate fields based on position and content
            const uniqueFields = new Map();
            
            textElements.forEach((element, index) => {
                const x = element.x || 100;
                const y = element.y || 100;
                const content = element.content || element.label || element.text || `Field ${index + 1}`;
                
                // Create unique key based on position and content
                const key = `${x}-${y}-${content}`;
                
                if (!uniqueFields.has(key)) {
                    // MIGRATE coordinates from old 400x600 templates to 576x864
                    let migrationX = x;
                    let migrationY = y;
                    
                    // If this looks like an old 400x600 template, scale up coordinates
                    if (config.width === 400 && config.height === 600) {
                        migrationX = x * (576 / 400);  // Scale X: 400 -> 576
                        migrationY = y * (864 / 600);  // Scale Y: 600 -> 864
                        console.log(`🔄 MIGRATING: (${x}, ${y}) -> (${migrationX.toFixed(1)}, ${migrationY.toFixed(1)})`);
                    }
                    
                    const field = {
                        id: Date.now() + index,
                        type: element.fieldType || this.extractFieldType(content),  // Use stored fieldType if available
                        content: content,
                        label: content,
                        x: migrationX,
                        y: migrationY,
                        width: element.width || 100,
                        height: element.height || 20,
                        fontSize: element.fontSize || element.font_size || 12,
                        fontFamily: element.fontFamily || element.font_family || 'Arial',
                        bold: element.bold || element.is_bold || false,
                        rotation: element.rotation || 0,
                        textAlign: element.textAlign || element.align || 'left'
                    };
                    
                    uniqueFields.set(key, field);
                    console.log('📝 Added unique field:', field);
                } else {
                    console.log('🚫 Skipping duplicate field at', x, y, 'with content:', content);
                }
            });
            
            // Add unique fields to the designer
            this.fields = Array.from(uniqueFields.values());
            console.log('✅ Loaded', this.fields.length, 'unique fields');
            console.log('✅ Fields stored in this.fields:', this.fields.map(f => ({ id: f.id, content: f.content, x: f.x, y: f.y })));
            
            // Load PDF offsets if present
            if (config.pdfOffsetX !== undefined || config.pdfOffsetY !== undefined) {
                this.pdfOffsetX = config.pdfOffsetX || 0;
                this.pdfOffsetY = config.pdfOffsetY || 0;
                console.log('🎯 Loaded PDF offsets:', this.pdfOffsetX, this.pdfOffsetY);
                
                // Update the input fields
                const pdfOffsetXInput = document.getElementById('pdfOffsetX');
                const pdfOffsetYInput = document.getElementById('pdfOffsetY');
                if (pdfOffsetXInput) pdfOffsetXInput.value = this.pdfOffsetX;
                if (pdfOffsetYInput) pdfOffsetYInput.value = this.pdfOffsetY;
            }
            
            // Redraw canvas with loaded content
            this.draw();
            
            console.log('✅ Template loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load template:', error);
            console.error('❌ Error stack:', error.stack);
            alert('Failed to load template: ' + error.message);
        }
    }
    
    extractFieldType(content) {
        // Extract field type from content like "{{firstName}}" -> "firstName"
        const match = content.match(/\{\{(\w+)\}\}/);
        return match ? match[1] : 'customText';
    }
    
    getFieldDisplayName(fieldType) {
        // Convert field types to user-friendly display names for the canvas
        const displayNames = {
            'firstName': 'First Name',
            'lastName': 'Last Name', 
            'middleName': 'Middle Name',
            'title': 'Title',
            'precinct': 'Precinct',
            'caucus': 'Caucus',
            'eventName': 'Event Name',
            'eventDate': 'Event Date',
            'address': 'Address',
            'city': 'City',
            'state': 'State',
            'zip': 'ZIP Code',
            'phone': 'Phone',
            'email': 'Email',
            'birthDate': 'Birth Date'
        };
        
        return displayNames[fieldType] || fieldType || 'Field';
    }
    
    async loadBackgroundFromDataURL(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.backgroundImage = img;
                // CRITICAL: Also store as original for clean PDF generation
                this.originalBackgroundImage = img;
                console.log('🖼️ Background image loaded successfully:', img.width, 'x', img.height);
                console.log('✅ Original background stored for clean PDF generation');
                
                // Fit canvas to background image
                this.fitCanvasToBackground();
                
                resolve();
            };
            img.onerror = (error) => {
                console.error('❌ Failed to load background image:', error);
                reject(error);
            };
            img.src = dataURL;
        });
    }
    
    init() {
        // Get canvas element
        this.canvas = document.getElementById('visualDesignerCanvas');
        if (!this.canvas) {
            console.error('Visual Designer canvas not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Failed to get canvas context');
            return;
        }
        
        console.log('Visual Designer initialized successfully');
        
        // Debug current event info
        console.log('Visual Designer - checking currentEvent:', window.currentEvent);
        if (window.currentEvent) {
            console.log('Current event details:', {
                id: window.currentEvent.id,
                name: window.currentEvent.name,
                status: window.currentEvent.status
            });
        } else {
            console.warn('No currentEvent available in window scope');
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load available fields
        this.loadAvailableFields();
        
        // Initial draw
        this.draw();
    }
    
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Background upload
        const backgroundUpload = document.getElementById('visualBackgroundUpload');
        if (backgroundUpload) {
            backgroundUpload.addEventListener('change', (e) => {
                this.handleBackgroundUpload(e);
            });
            console.log('Background upload listener added');
        } else {
            console.error('visualBackgroundUpload element not found');
        }
        
        // Add field button
        const addFieldBtn = document.getElementById('visualAddFieldBtn');
        if (addFieldBtn) {
            addFieldBtn.addEventListener('click', () => {
                this.addField();
            });
            console.log('Add field listener added');
        } else {
            console.error('addFieldBtn element not found');
        }
        
        // Undo/Redo buttons
        const undoBtn = document.getElementById('visualUndoBtn');
        const redoBtn = document.getElementById('visualRedoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }
        
        // Clear template (fields only)
        const clearTemplateBtn = document.getElementById('clearTemplateBtn');
        if (clearTemplateBtn) {
            clearTemplateBtn.addEventListener('click', () => this.clearFieldsOnly());
        }
        
        // Canvas interactions
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            this.canvas.addEventListener('click', (e) => this.handleClick(e));
        }
        
        // Field properties
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        if (fontSizeSlider) {
            fontSizeSlider.addEventListener('input', (e) => {
                this.updateFieldProperty('fontSize', parseInt(e.target.value));
                const display = document.getElementById('fontSizeDisplay');
                if (display) display.textContent = e.target.value + 'px';
            });
        }
        
        const fontFamilySelect = document.getElementById('fontFamilySelect');
        if (fontFamilySelect) {
            fontFamilySelect.addEventListener('change', (e) => {
                this.updateFieldProperty('fontFamily', e.target.value);
            });
        }
        
        const boldCheck = document.getElementById('boldCheck');
        if (boldCheck) {
            boldCheck.addEventListener('change', (e) => {
                this.updateFieldProperty('bold', e.target.checked);
            });
        }
        
        const rotateFieldBtn = document.getElementById('rotateFieldBtn');
        if (rotateFieldBtn) {
            rotateFieldBtn.addEventListener('click', () => {
                this.rotateSelectedField();
            });
        }
        
        const deleteFieldBtn = document.getElementById('deleteFieldBtn');
        if (deleteFieldBtn) {
            deleteFieldBtn.addEventListener('click', () => {
                this.deleteSelectedField();
            });
        }
        
        // Template actions - find the save button specifically within the Visual Designer modal
        const modal = document.getElementById('visualDesignerModal');
        const saveTemplateBtn = modal ? modal.querySelector('#saveTemplateBtn') : document.getElementById('saveTemplateBtn');
        console.log('Save template button found in modal:', !!saveTemplateBtn);
        console.log('Save template button element:', saveTemplateBtn);
        console.log('Save template button visible:', saveTemplateBtn ? saveTemplateBtn.offsetParent !== null : false);
        console.log('Save template button parent modal:', saveTemplateBtn ? saveTemplateBtn.closest('.modal') : null);
        
        if (saveTemplateBtn) {
            console.log('Adding click listener to save template button');
            
            // Remove any existing listeners first by cloning the element
            const newSaveBtn = saveTemplateBtn.cloneNode(true);
            saveTemplateBtn.parentNode.replaceChild(newSaveBtn, saveTemplateBtn);
            
            // Add single event listener with save protection
            let isSaving = false;
            const clickHandler = async (event) => {
                console.log('💾 Save template button clicked!', event);
                
                // Prevent multiple saves
                if (isSaving) {
                    console.log('💾 Save already in progress, ignoring click');
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                
                event.preventDefault();
                event.stopPropagation();
                
                isSaving = true;
                try {
                    await this.saveTemplate();
                } finally {
                    // Reset flag after 2 seconds to allow retry if needed
                    setTimeout(() => {
                        isSaving = false;
                    }, 2000);
                }
            };
            
            newSaveBtn.addEventListener('click', clickHandler);
            console.log('✅ Single click listener added successfully');
            
        } else {
            console.error('❌ Save template button not found in DOM!');
        }
        
        const previewTemplateBtn = document.getElementById('previewTemplateBtn');
        if (previewTemplateBtn) {
            previewTemplateBtn.addEventListener('click', () => {
                this.previewTemplate();
            });
        }
        
        const testPrintBtn = document.getElementById('visualTestPrintBtn');
        console.log('🖨️ visualTestPrintBtn element:', testPrintBtn);
        if (testPrintBtn) {
            console.log('🖨️ Adding click listener to visualTestPrintBtn');
            testPrintBtn.addEventListener('click', () => {
                console.log('🖨️ visualTestPrintBtn clicked!');
                this.testPrint();
            });
        } else {
            console.warn('🖨️ visualTestPrintBtn element not found!');
        }
        
        // PDF Offset Controls
        const applyOffsetBtn = document.getElementById('applyOffsetBtn');
        if (applyOffsetBtn) {
            applyOffsetBtn.addEventListener('click', () => {
                this.applyOffset();
            });
        }
        
        const resetOffsetBtn = document.getElementById('resetOffsetBtn');
        if (resetOffsetBtn) {
            resetOffsetBtn.addEventListener('click', () => {
                this.resetOffset();
            });
        }
        
        // Update offsets when inputs change
        const pdfOffsetX = document.getElementById('pdfOffsetX');
        const pdfOffsetY = document.getElementById('pdfOffsetY');
        if (pdfOffsetX && pdfOffsetY) {
            pdfOffsetX.addEventListener('input', () => {
                this.pdfOffsetX = parseInt(pdfOffsetX.value) || 0;
            });
            pdfOffsetY.addEventListener('input', () => {
                this.pdfOffsetY = parseInt(pdfOffsetY.value) || 0;
            });
        }

        // Text alignment controls
        const alignLeftBtn = document.getElementById('alignLeftBtn');
        if (alignLeftBtn) {
            alignLeftBtn.addEventListener('click', () => {
                this.setTextAlignment('left');
            });
        }

        const alignCenterBtn = document.getElementById('alignCenterBtn');
        if (alignCenterBtn) {
            alignCenterBtn.addEventListener('click', () => {
                this.setTextAlignment('center');
            });
        }

        const alignRightBtn = document.getElementById('alignRightBtn');
        if (alignRightBtn) {
            alignRightBtn.addEventListener('click', () => {
                this.setTextAlignment('right');
            });
        }

        // Snap to grid
        const snapToGridCheck = document.getElementById('snapToGridCheck');
        if (snapToGridCheck) {
            snapToGridCheck.addEventListener('change', (e) => {
                this.snapToGrid = e.target.checked;
                this.draw(); // Redraw to show/hide grid
            });
        }
        
        // Show coordinates checkbox
        const showCoordinatesCheck = document.getElementById('showCoordinatesCheck');
        if (showCoordinatesCheck) {
            showCoordinatesCheck.addEventListener('change', (e) => {
                this.showCoordinates = e.target.checked;
                this.draw(); // Redraw to show/hide coordinates
            });
        }
        
        // Show rulers checkbox
        const showRulersCheck = document.getElementById('showRulersCheck');
        if (showRulersCheck) {
            showRulersCheck.addEventListener('change', (e) => {
                this.showRulers = e.target.checked;
                this.draw(); // Redraw to show/hide rulers
            });
        }

        // Center alignment tools
        const centerHorizontalBtn = document.getElementById('centerHorizontalBtn');
        if (centerHorizontalBtn) {
            centerHorizontalBtn.addEventListener('click', () => {
                this.centerSelectedField('horizontal');
            });
        }

        const centerVerticalBtn = document.getElementById('centerVerticalBtn');
        if (centerVerticalBtn) {
            centerVerticalBtn.addEventListener('click', () => {
                this.centerSelectedField('vertical');
            });
        }

        const centerBothBtn = document.getElementById('centerBothBtn');
        if (centerBothBtn) {
            centerBothBtn.addEventListener('click', () => {
                this.centerSelectedField('both');
            });
        }

        // Multi-select alignment tools
        const alignLeftMultiBtn = document.getElementById('alignLeftMultiBtn');
        if (alignLeftMultiBtn) {
            alignLeftMultiBtn.addEventListener('click', () => {
                this.alignSelectedFields('left');
            });
        }

        const alignCenterMultiBtn = document.getElementById('alignCenterMultiBtn');
        if (alignCenterMultiBtn) {
            alignCenterMultiBtn.addEventListener('click', () => {
                this.alignSelectedFields('center');
            });
        }

        const alignRightMultiBtn = document.getElementById('alignRightMultiBtn');
        if (alignRightMultiBtn) {
            alignRightMultiBtn.addEventListener('click', () => {
                this.alignSelectedFields('right');
            });
        }

        const alignTopBtn = document.getElementById('alignTopBtn');
        if (alignTopBtn) {
            alignTopBtn.addEventListener('click', () => {
                this.alignSelectedFields('top');
            });
        }

        const alignMiddleBtn = document.getElementById('alignMiddleBtn');
        if (alignMiddleBtn) {
            alignMiddleBtn.addEventListener('click', () => {
                this.alignSelectedFields('middle');
            });
        }

        const alignBottomBtn = document.getElementById('alignBottomBtn');
        if (alignBottomBtn) {
            alignBottomBtn.addEventListener('click', () => {
                this.alignSelectedFields('bottom');
            });
        }

        const distributeHorizontalBtn = document.getElementById('distributeHorizontalBtn');
        if (distributeHorizontalBtn) {
            distributeHorizontalBtn.addEventListener('click', () => {
                this.distributeSelectedFields('horizontal');
            });
        }
        
        // Refresh fields button
        const refreshFieldsBtn = document.getElementById('refreshFieldsBtn');
        if (refreshFieldsBtn) {
            refreshFieldsBtn.addEventListener('click', async () => {
                console.log('🔄 Manual field refresh requested...');
                refreshFieldsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                refreshFieldsBtn.disabled = true;
                
                try {
                    await this.loadAvailableFields();
                    this.updateFieldSelector();
                    if (typeof showSuccess === 'function') {
                        showSuccess('Fields refreshed successfully!');
                    }
                } catch (error) {
                    console.error('Failed to refresh fields:', error);
                    if (typeof showError === 'function') {
                        showError('Failed to refresh fields. Please try again.');
                    }
                } finally {
                    refreshFieldsBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                    refreshFieldsBtn.disabled = false;
                }
            });
        }
        
        // Data preview controls
        const loadPreviewDataBtn = document.getElementById('loadPreviewDataBtn');
        if (loadPreviewDataBtn) {
            loadPreviewDataBtn.addEventListener('click', () => {
                this.loadPreviewData();
            });
        }
        
        const prevRecordBtn = document.getElementById('prevRecordBtn');
        if (prevRecordBtn) {
            prevRecordBtn.addEventListener('click', () => {
                this.showPreviousRecord();
            });
        }
        
        const nextRecordBtn = document.getElementById('nextRecordBtn');
        if (nextRecordBtn) {
            nextRecordBtn.addEventListener('click', () => {
                this.showNextRecord();
            });
        }
        
        const clearPreviewBtn = document.getElementById('clearPreviewBtn');
        if (clearPreviewBtn) {
            clearPreviewBtn.addEventListener('click', () => {
                this.clearPreview();
            });
        }
    }
    
    handleBackgroundUpload(event) {
        console.log('handleBackgroundUpload called');
        const file = event.target.files[0];
        if (!file) {
            console.log('No file selected');
            return;
        }
        
        console.log('File selected:', file.name, file.type, file.size);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('File read successfully');
            if (file.type === 'application/pdf') {
                this.handlePDFBackground(e.target.result);
            } else {
                this.handleImageBackground(e.target.result);
            }
        };
        
        reader.onerror = (e) => {
            console.error('Error reading file:', e);
        };
        
        if (file.type === 'application/pdf') {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsDataURL(file);
        }
    }
    
    handleImageBackground(dataUrl) {
        console.log('Loading image background');
        const img = new Image();
        img.onload = () => {
            console.log('Image loaded successfully:', img.width, img.height);
            this.backgroundImage = img;
            // CRITICAL: Store the original clean background image for PDF generation
            this.originalBackgroundImage = img;
            console.log('✅ Original background image stored for clean PDF generation');
            this.fitCanvasToBackground();
            this.draw();
        };
        img.onerror = (e) => {
            console.error('Error loading image:', e);
        };
        img.src = dataUrl;
    }
    
    async handlePDFBackground(arrayBuffer) {
        try {
            // Note: For PDF support, we'd need PDF.js library
            // For now, let's show a message to convert PDF to image
            alert('PDF backgrounds are not yet supported. Please convert your PDF to PNG or JPG first.');
            
            // Reset file input
            document.getElementById('backgroundUpload').value = '';
        } catch (error) {
            console.error('PDF processing error:', error);
            alert('Error processing PDF. Please try converting to PNG or JPG.');
        }
    }
    
    removeBackground() {
        this.backgroundImage = null;
        this.draw();
    }
    
    fitCanvasToBackground() {
        if (!this.backgroundImage) return;
        
        const maxWidth = 800;
        const maxHeight = 600;
        
        let width = this.backgroundImage.width;
        let height = this.backgroundImage.height;
        
        // Scale to fit canvas while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
            const scaleX = maxWidth / width;
            const scaleY = maxHeight / height;
            this.scale = Math.min(scaleX, scaleY);
            
            width *= this.scale;
            height *= this.scale;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
    }
    
    addField() {
        const select = document.getElementById('fieldTypeSelect');
        if (!select) {
            alert('Field selector not found.');
            return;
        }
        
        const fieldType = select.value;
        if (!fieldType) {
            alert('Please select a field type to add.');
            return;
        }
        
        let fieldContent = `{{${fieldType}}}`;
        let fieldLabel = select.options[select.selectedIndex].text;
        
        // Handle custom text
        if (fieldType === 'customText') {
            const customText = prompt('Enter your custom text:');
            if (!customText) {
                console.log('Custom text cancelled');
                return;
            }
            fieldContent = customText;
            fieldLabel = 'Custom Text';
        }
        
        // Smart positioning: stack fields with offset to avoid overlapping
        const existingFieldsAtCenter = this.fields.filter(f => 
            Math.abs(f.x - (this.canvas.width / 2 - 50)) < 20 && 
            Math.abs(f.y - (this.canvas.height / 2 - 10)) < 20
        ).length;
        
        const offsetX = (existingFieldsAtCenter % 3) * 10;
        const offsetY = Math.floor(existingFieldsAtCenter / 3) * 10;
        
        const field = {
            id: 'field_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            type: fieldType,
            content: fieldContent, // Store the actual content
            label: fieldLabel,
            x: (this.canvas.width / 2 - 50) + offsetX,
            y: (this.canvas.height / 2 - 10) + offsetY,
            fontSize: 12,
            fontFamily: 'Arial',
            bold: false,
            rotation: 0,
            textAlign: 'left', // left, center, right
            width: 100,
            height: 20
        };
        
        console.log('Creating field:', field);
        this.pushHistory();
        this.fields.push(field);
        console.log('Total fields:', this.fields.length);
        this.selectField(field);
        this.draw();
        this.renderFieldsList();
        
        // Reset select
        select.selectedIndex = 0;
    }

    async loadAvailableFields() {
        try {
            console.log('Loading available fields...');
            
            // Get current event from the global scope with multiple fallback methods
            let currentEvent = window.currentEvent;
            
            // Fallback: try to get from the main app's currentEvent variable
            if (!currentEvent && typeof window.getCurrentEvent === 'function') {
                currentEvent = window.getCurrentEvent();
            }
            
            // Fallback: check if there's a global currentEvent variable
            if (!currentEvent && window.parent && window.parent.currentEvent) {
                currentEvent = window.parent.currentEvent;
            }
            
            // Final fallback: fetch current active event from API
            if (!currentEvent) {
                console.log('No currentEvent found, fetching from API...');
                try {
                    const eventsResponse = await fetch('/api/events');
                    if (eventsResponse.ok) {
                        const events = await eventsResponse.json();
                        const activeEvent = events.find(event => event.status === 'active');
                        if (activeEvent) {
                            currentEvent = activeEvent;
                            console.log('Fetched active event from API:', activeEvent.name);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to fetch events from API:', e);
                }
            }
            
            console.log('Current event found:', currentEvent);
            
            if (currentEvent) {
                console.log('Current event details:', {
                    id: currentEvent.id,
                    name: currentEvent.name,
                    status: currentEvent.status
                });
            }
            
            if (currentEvent && currentEvent.id) {
                console.log('Fetching CSV headers for event:', currentEvent.id);
                const response = await fetch(`/api/events/${currentEvent.id}/csv-headers`);
                console.log('CSV headers response status:', response.status);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('CSV headers result:', result);
                    
                    // Handle different response formats
                    let csvHeaders = [];
                    if (Array.isArray(result)) {
                        csvHeaders = result;
                    } else if (result.headers && Array.isArray(result.headers)) {
                        csvHeaders = result.headers;
                    } else if (result.csvHeaders && Array.isArray(result.csvHeaders)) {
                        csvHeaders = result.csvHeaders;
                    }
                    
                    this.availableFields = [
                        'firstName', 'lastName', 'middleName', 'birthDate',
                        'address', 'city', 'state', 'zip', 'phone', 'email',
                        'eventName', 'eventDate',
                        'customText', // Add custom text option
                        ...csvHeaders
                    ];
                    
                    console.log('CSV headers found:', csvHeaders.length);
                } else {
                    console.warn('Failed to fetch CSV headers, status:', response.status);
                    this.availableFields = [
                        'firstName', 'lastName', 'middleName', 'birthDate',
                        'address', 'city', 'state', 'zip', 'phone', 'email',
                        'eventName', 'eventDate', 'customText'
                    ];
                }
            } else {
                console.warn('No current event available');
                this.availableFields = [
                    'firstName', 'lastName', 'middleName', 'birthDate',
                    'address', 'city', 'state', 'zip', 'phone', 'email',
                    'eventName', 'eventDate', 'customText'
                ];
            }
            
            console.log('Total available fields:', this.availableFields.length);
            console.log('Available fields:', this.availableFields);
            this.updateFieldSelector();
        } catch (error) {
            console.error('Failed to load available fields:', error);
            // Use fallback fields
            this.availableFields = [
                'firstName', 'lastName', 'middleName', 'birthDate',
                'address', 'city', 'state', 'zip', 'phone', 'email',
                'eventName', 'eventDate', 'customText'
            ];
            this.updateFieldSelector();
        }
    }

    updateFieldSelector() {
        const fieldSelect = document.getElementById('fieldTypeSelect');
        if (!fieldSelect) return;
        
        // Clear existing options except the first one
        fieldSelect.innerHTML = '<option value="">Choose field to add...</option>';
        
        // Add custom text option first
        const customOption = document.createElement('option');
        customOption.value = 'customText';
        customOption.textContent = '📝 Custom Text (enter your own text)';
        fieldSelect.appendChild(customOption);
        
        // Add separator
        const separator1 = document.createElement('option');
        separator1.disabled = true;
        separator1.textContent = '─── Standard Fields ───';
        fieldSelect.appendChild(separator1);
        
        // Add standard fields
        const standardFields = [
            'firstName', 'lastName', 'middleName', 'birthDate',
            'address', 'city', 'state', 'zip', 'phone', 'email',
            'eventName', 'eventDate'
        ];
        
        standardFields.forEach(field => {
            if (this.availableFields.includes(field)) {
                const option = document.createElement('option');
                option.value = field;
                option.textContent = this.formatFieldName(field);
                fieldSelect.appendChild(option);
            }
        });
        
        // Add CSV fields if any
        const csvFields = this.availableFields.filter(field => 
            !standardFields.includes(field) && field !== 'customText'
        );
        
        if (csvFields.length > 0) {
            const separator2 = document.createElement('option');
            separator2.disabled = true;
            separator2.textContent = '─── CSV Fields ───';
            fieldSelect.appendChild(separator2);
            
            csvFields.forEach(field => {
                const option = document.createElement('option');
                option.value = field;
                option.textContent = `📊 ${this.formatFieldName(field)}`;
                fieldSelect.appendChild(option);
            });
        }
        
        console.log('Field selector updated with', this.availableFields.length, 'fields');
        console.log('CSV fields found:', csvFields.length);
        console.log('🔍 All available fields:', this.availableFields);
        console.log('🔍 CSV-specific fields:', csvFields);
    }

    formatFieldName(fieldName) {
        // Handle special cases
        if (fieldName === 'customText') return 'Custom Text';
        if (fieldName === 'firstName') return 'First Name';
        if (fieldName === 'lastName') return 'Last Name';
        if (fieldName === 'middleName') return 'Middle Name';
        if (fieldName === 'birthDate') return 'Birth Date';
        if (fieldName === 'eventName') return 'Event Name';
        if (fieldName === 'eventDate') return 'Event Date';
        
        // Convert normalized field names to readable format
        return fieldName
            .replace(/_/g, ' ')  // Replace underscores with spaces
            .replace(/([A-Z])/g, ' $1')  // Add space before capital letters
            .replace(/^./, str => str.toUpperCase())  // Capitalize first letter
            .replace(/\s+/g, ' ')  // Remove extra spaces
            .trim();
    }
    
    selectField(field) {
        this.selectedField = field;
        this.updatePropertiesPanel();
    }
    
    updatePropertiesPanel() {
        console.log('updatePropertiesPanel called, selectedField:', this.selectedField);
        const panel = document.getElementById('fieldProperties');
        
        if (this.selectedField) {
            console.log('Showing properties for field:', this.selectedField.id, 'textAlign:', this.selectedField.textAlign);
            panel.classList.remove('d-none');
            
            // Update controls with selected field values
            const fontSizeSlider = document.getElementById('fontSizeSlider');
            const fontSizeDisplay = document.getElementById('fontSizeDisplay');
            const fontFamilySelect = document.getElementById('fontFamilySelect');
            const boldCheck = document.getElementById('boldCheck');
            
            if (fontSizeSlider) fontSizeSlider.value = this.selectedField.fontSize;
            if (fontSizeDisplay) fontSizeDisplay.textContent = this.selectedField.fontSize + 'px';
            if (fontFamilySelect) fontFamilySelect.value = this.selectedField.fontFamily;
            if (boldCheck) boldCheck.checked = this.selectedField.bold;
            
            // Update alignment buttons
            this.updateAlignmentButtons();
        } else {
            console.log('Hiding properties panel - no field selected');
            panel.classList.add('d-none');
        }
    }
    
    updateFieldProperty(property, value) {
        if (this.selectedField) {
            this.pushHistory();
            this.selectedField[property] = value;
            this.draw();
            this.renderFieldsList();
        }
    }
    
    rotateSelectedField() {
        if (this.selectedField) {
            this.pushHistory();
            this.selectedField.rotation = (this.selectedField.rotation + 180) % 360;
            this.draw();
            this.renderFieldsList();
        }
    }
    
    deleteSelectedField() {
        if (this.selectedField) {
            const index = this.fields.indexOf(this.selectedField);
            if (index > -1) {
                this.pushHistory();
                this.fields.splice(index, 1);
                this.selectedField = null;
                this.updatePropertiesPanel();
                this.draw();
                this.renderFieldsList();
            }
        }
    }
    
    getMousePos(event) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Account for CSS scaling - canvas is 576x864 but may be displayed smaller
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const rawX = event.clientX - rect.left;
        const rawY = event.clientY - rect.top;
        
        return {
            x: rawX * scaleX,
            y: rawY * scaleY
        };
    }
    
    getFieldAt(x, y) {
        console.log('🔍 Checking fields at position:', x, y);
        console.log('🔍 Total fields to check:', this.fields.length);
        
        // Check fields in reverse order (top to bottom)
        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];
            const inBounds = x >= field.x && x <= field.x + field.width &&
                           y >= field.y && y <= field.y + field.height;
            
            console.log(`🔍 Field ${i}: (${field.x},${field.y}) ${field.width}x${field.height} - ${inBounds ? '✅ HIT' : '❌ miss'}`);
            
            if (inBounds) {
                console.log('✅ Found field:', field);
                return field;
            }
        }
        console.log('❌ No field found at position');
        return null;
    }
    
    handleMouseDown(event) {
        const pos = this.getMousePos(event);
        const field = this.getFieldAt(pos.x, pos.y);
        
        if (field) {
            // Multi-selection with Ctrl key
            if (event.ctrlKey || event.metaKey) {
                this.toggleFieldSelection(field);
            } else {
                // Single selection
                this.selectField(field);
                this.selectedFields = [field];
            }
            
            this.isDragging = true;
            this.dragOffset.x = pos.x - field.x;
            this.dragOffset.y = pos.y - field.y;
            this.canvas.style.cursor = 'grabbing';
        } else {
            // Clear selection
            this.selectedField = null;
            this.selectedFields = [];
            this.updatePropertiesPanel();
        }
        
        this.draw();
    }
    
    handleMouseMove(event) {
        const pos = this.getMousePos(event);
        
        if (this.isDragging && this.selectedField) {
            let newX = pos.x - this.dragOffset.x;
            let newY = pos.y - this.dragOffset.y;
            
            // Snap to grid if enabled
            if (this.snapToGrid) {
                newX = Math.round(newX / this.gridSize) * this.gridSize;
                newY = Math.round(newY / this.gridSize) * this.gridSize;
            }
            
            // Move all selected fields together
            if (this.selectedFields.length > 1) {
                const deltaX = newX - this.selectedField.x;
                const deltaY = newY - this.selectedField.y;
                
                this.selectedFields.forEach(field => {
                    field.x += deltaX;
                    field.y += deltaY;
                });
            } else {
                this.selectedField.x = newX;
                this.selectedField.y = newY;
            }
            
            this.draw();
            this.renderFieldsList();
        } else {
            // Update cursor based on hover
            const field = this.getFieldAt(pos.x, pos.y);
            this.canvas.style.cursor = field ? 'move' : 'default';
        }
    }
    
    handleMouseUp(event) {
        this.isDragging = false;
        this.canvas.style.cursor = 'default';
    }
    
    handleClick(event) {
        // Click handling is done in mouseDown for immediate feedback
    }
    
    draw() {
        console.log('🎨 draw() called, fields:', this.fields.length, 'background:', !!this.backgroundImage);
        console.log('🎨 Fields details:', this.fields.map(f => ({ id: f.id, content: f.content, x: f.x, y: f.y })));
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background image
        if (this.backgroundImage) {
            this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Draw placeholder background
            this.ctx.fillStyle = '#f8f9fa';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw grid
            this.ctx.strokeStyle = '#e9ecef';
            this.ctx.lineWidth = 1;
            for (let x = 0; x <= this.canvas.width; x += 20) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.canvas.height);
                this.ctx.stroke();
            }
            for (let y = 0; y <= this.canvas.height; y += 20) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
            }
            
            // Instructions
            this.ctx.fillStyle = '#6c757d';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Upload a background image to get started', this.canvas.width / 2, this.canvas.height / 2);
        }
        
        // Draw grid overlay for better positioning
        if (this.snapToGrid) {
            this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
            this.ctx.lineWidth = 0.5;
            
            // Vertical grid lines
            for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.canvas.height);
                this.ctx.stroke();
            }
            
            // Horizontal grid lines
            for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
            }
        }
        
        // Draw rulers if enabled
        if (this.showRulers) {
            this.drawRulers();
        }
        
        // Draw fields
        this.fields.forEach(field => {
            this.drawField(field);
        });
        
        // Show coordinates for selected field
        if (this.selectedField && this.showCoordinates) {
            this.drawCoordinateDisplay();
        }
        
        // Show preview mode indicator
        if (this.isPreviewMode) {
            this.drawPreviewIndicator();
        }
        
        // Refresh list
        this.renderFieldsList();
    }
    
    drawPreviewIndicator() {
        // Preview mode banner
        this.ctx.fillStyle = 'rgba(23, 162, 184, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, 25);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            `📊 PREVIEW MODE - Showing Record ${this.currentPreviewIndex + 1} of ${this.previewRecords.length}`, 
            this.canvas.width / 2, 
            15
        );
    }
    
    drawRulers() {
        const rulerSize = 20;
        
        // Top ruler (horizontal)
        this.ctx.fillStyle = 'rgba(240, 240, 240, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, rulerSize);
        
        // Left ruler (vertical)
        this.ctx.fillRect(0, 0, rulerSize, this.canvas.height);
        
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 1;
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';
        
        // Horizontal ruler marks
        for (let x = 0; x <= this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, rulerSize);
            this.ctx.stroke();
            
            if (x > 0) {
                this.ctx.fillText(x.toString(), x, rulerSize - 5);
            }
        }
        
        // Vertical ruler marks
        this.ctx.textAlign = 'left';
        for (let y = 0; y <= this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(rulerSize, y);
            this.ctx.stroke();
            
            if (y > 0) {
                this.ctx.save();
                this.ctx.translate(5, y);
                this.ctx.rotate(-Math.PI / 2);
                this.ctx.fillText(y.toString(), 0, 0);
                this.ctx.restore();
            }
        }
    }
    
    drawCoordinateDisplay() {
        const field = this.selectedField;
        const x = field.x;
        const y = field.y;
        
        // Display coordinates near the selected field
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        
        const coordText = `(${Math.round(x)}, ${Math.round(y)})`;
        const textWidth = this.ctx.measureText(coordText).width;
        
        // Position coordinate display above the field
        let displayX = x;
        let displayY = y - 5;
        
        // Adjust if it would go off canvas
        if (displayY < 15) displayY = y + field.height + 15;
        if (displayX + textWidth > this.canvas.width) displayX = this.canvas.width - textWidth - 5;
        
        // Background for coordinates
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.fillRect(displayX - 2, displayY - 12, textWidth + 4, 14);
        
        // Coordinate text
        this.ctx.fillStyle = '#333';
        this.ctx.fillText(coordText, displayX, displayY);
    }
    
    // Data preview methods
    async loadPreviewData() {
        if (!window.currentEvent) {
            if (typeof showError === 'function') {
                showError('No event selected. Please select an event first.');
            }
            return;
        }
        
        console.log('🔍 Loading preview data for event:', window.currentEvent.id);
        
        try {
            const response = await fetch(`/api/events/${window.currentEvent.id}/sample-records`);
            
            if (!response.ok) {
                throw new Error(`Failed to load preview data: ${response.status}`);
            }
            
            this.previewRecords = await response.json();
            this.currentPreviewIndex = 0;
            this.isPreviewMode = true;
            
            console.log('📊 Loaded preview data:', this.previewRecords.length, 'records');
            
            // Show navigation controls
            const navigation = document.getElementById('previewNavigation');
            if (navigation) {
                navigation.classList.remove('d-none');
            }
            
            // Update UI
            this.updatePreviewDisplay();
            this.draw();
            
            if (typeof showSuccess === 'function') {
                showSuccess(`Loaded ${this.previewRecords.length} preview records`);
            }
            
        } catch (error) {
            console.error('Failed to load preview data:', error);
            if (typeof showError === 'function') {
                showError('Failed to load preview data. Please try again.');
            }
        }
    }
    
    showPreviousRecord() {
        if (!this.isPreviewMode || this.previewRecords.length === 0) return;
        
        this.currentPreviewIndex = Math.max(0, this.currentPreviewIndex - 1);
        this.updatePreviewDisplay();
        this.draw();
    }
    
    showNextRecord() {
        if (!this.isPreviewMode || this.previewRecords.length === 0) return;
        
        this.currentPreviewIndex = Math.min(this.previewRecords.length - 1, this.currentPreviewIndex + 1);
        this.updatePreviewDisplay();
        this.draw();
    }
    
    updatePreviewDisplay() {
        if (!this.isPreviewMode || this.previewRecords.length === 0) return;
        
        // Update counter
        const counter = document.getElementById('recordCounter');
        if (counter) {
            counter.textContent = `${this.currentPreviewIndex + 1} / ${this.previewRecords.length}`;
        }
        
        // Update button states
        const prevBtn = document.getElementById('prevRecordBtn');
        const nextBtn = document.getElementById('nextRecordBtn');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPreviewIndex === 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPreviewIndex === this.previewRecords.length - 1;
        }
        
        // Set current preview data
        this.previewData = this.previewRecords[this.currentPreviewIndex];
        console.log('👀 Current preview record:', this.previewData);
    }
    
    clearPreview() {
        this.isPreviewMode = false;
        this.previewData = null;
        this.previewRecords = [];
        this.currentPreviewIndex = 0;
        
        // Hide navigation controls
        const navigation = document.getElementById('previewNavigation');
        if (navigation) {
            navigation.classList.add('d-none');
        }
        
        this.draw();
        
        if (typeof showSuccess === 'function') {
            showSuccess('Preview data cleared');
        }
    }
    
    drawField(field) {
        this.ctx.save();
        
        // Apply rotation
        if (field.rotation !== 0) {
            const centerX = field.x + field.width / 2;
            const centerY = field.y + field.height / 2;
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate((field.rotation * Math.PI) / 180);
            this.ctx.translate(-centerX, -centerY);
        }
        
        // Determine field selection state
        const isSelected = field === this.selectedField;
        const isMultiSelected = this.selectedFields.includes(field) && this.selectedFields.length > 1;
        
        // Draw field background
        let bgColor = 'rgba(255, 255, 255, 0.8)';
        if (isSelected) bgColor = 'rgba(0, 123, 255, 0.2)';
        else if (isMultiSelected) bgColor = 'rgba(40, 167, 69, 0.2)';
        
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(field.x, field.y, field.width, field.height);
        
        // Draw field border
        let borderColor = '#dee2e6';
        let lineWidth = 1;
        if (isSelected) {
            borderColor = '#007bff';
            lineWidth = 2;
        } else if (isMultiSelected) {
            borderColor = '#28a745';
            lineWidth = 2;
        }
        
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeRect(field.x, field.y, field.width, field.height);
        
        // Draw field text with proper alignment
        this.ctx.fillStyle = '#212529';
        this.ctx.font = `${field.bold ? 'bold ' : ''}${field.fontSize}px ${field.fontFamily}`;
        this.ctx.textBaseline = 'middle';
        
        // For display in the designer, show preview data or user-friendly labels
        let text;
        if (field.type === 'customText') {
            text = field.content || 'Custom Text';
        } else if (this.isPreviewMode && this.previewData) {
            // Show actual data from preview record
            const fieldValue = window.mapFieldValue ? window.mapFieldValue(field.type, this.previewData) : null;
            text = fieldValue || `[${field.type}]`;
        } else {
            // Show a user-friendly label instead of {{template}} syntax
            text = this.getFieldDisplayName(field.type);
        }
        const textY = field.y + field.height / 2;
        let textX = field.x + 5;
        
        // Apply text alignment
        switch (field.textAlign) {
            case 'center':
                this.ctx.textAlign = 'center';
                textX = field.x + field.width / 2;
                break;
            case 'right':
                this.ctx.textAlign = 'right';
                textX = field.x + field.width - 5;
                break;
            default: // 'left'
                this.ctx.textAlign = 'left';
                textX = field.x + 5;
                break;
        }
        
        this.ctx.fillText(text, textX, textY);
        
        // Update field width based on text (only for left-aligned for simplicity)
        if (field.textAlign === 'left') {
            const textWidth = this.ctx.measureText(text).width + 10;
            field.width = Math.max(textWidth, 60);
        }
        
        this.ctx.restore();
    }
    
    async checkTemplateNameExists(templateName) {
        try {
            const response = await fetch('/api/templates');
            if (!response.ok) {
                console.error('Failed to fetch templates for name validation');
                return false;
            }
            
            const templates = await response.json();
            return templates.some(t => {
                const sameName = (t.name || '').toLowerCase().trim() === templateName.toLowerCase().trim();
                if (!sameName) return false;
                // If updating, allow same-name on the same template id
                if (this.currentTemplateId && t.id === this.currentTemplateId) return false;
                return true;
            });
        } catch (error) {
            console.error('Error checking template name:', error);
            return false;
        }
    }

    async validateTemplateNameInput() {
        const templateNameInput = document.getElementById('templateNameInput');
        if (!templateNameInput) return;

        const templateName = templateNameInput.value.trim();
        
        // Remove any existing validation styling
        templateNameInput.classList.remove('is-invalid', 'is-valid');
        
        // Find or create feedback element
        let feedback = templateNameInput.parentNode.querySelector('.invalid-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            templateNameInput.parentNode.appendChild(feedback);
        }
        
        if (templateName.length === 0) {
            feedback.textContent = '';
            return;
        }
        
        if (templateName.length < 2) {
            templateNameInput.classList.add('is-invalid');
            feedback.textContent = 'Template name must be at least 2 characters long.';
            return;
        }
        
        // Check for duplicate names
        const nameExists = await this.checkTemplateNameExists(templateName);
        if (nameExists) {
            templateNameInput.classList.add('is-invalid');
            feedback.textContent = `Template name "${templateName}" already exists.`;
        } else {
            templateNameInput.classList.add('is-valid');
            feedback.textContent = '';
        }
    }

    async saveTemplate() {
        console.log('🔄 saveTemplate() called - START');
        console.log('🔄 Call stack:', new Error().stack);
        
        const templateNameInput = document.getElementById('templateNameInput');
        console.log('📝 Template name input element:', templateNameInput);
        
        const templateName = templateNameInput ? templateNameInput.value.trim() : '';
        console.log('📝 Template name:', templateName);
        
        if (!templateName) {
            console.error('❌ No template name provided');
            alert('Please enter a template name.');
            return;
        }
        
        // If creating new, prevent duplicate names; if updating, allow same-name for same id
        if (!this.currentTemplateId) {
            console.log('🔍 Checking if template name exists (new template)...');
            const nameExists = await this.checkTemplateNameExists(templateName);
            if (nameExists) {
                alert(`Template name "${templateName}" already exists. Please choose a different name.`);
                templateNameInput.focus();
                templateNameInput.select();
                return;
            }
            console.log('✅ Template name is unique');
        } else {
            console.log('✏️ Updating existing template, skipping duplicate-name check for same id');
        }
        
        console.log('📊 Current fields count:', this.fields.length);
        console.log('📊 Current fields:', this.fields);
        
        if (this.fields.length === 0) {
            console.error('❌ No fields to save');
            alert('Please add some fields before saving.');
            return;
        }
        
        try {
            console.log('🔧 Building template configuration...');
            
            // Convert Visual Designer format to the standard template format
            const templateConfig = {
                width: 576,  // STANDARDIZED: Always 576x864
                height: 864,
                designer: 'Visual Designer',
                version: '1.0',
                pdfOffsetX: this.pdfOffsetX || 0,
                pdfOffsetY: this.pdfOffsetY || 0,
                elements: this.fields.map(field => {
                    const element = {
                        type: 'text',
                        fieldType: field.type,  // Store the field type separately
                        content: field.type === 'customText' ? field.content : `{{${field.type}}}`,
                        x: field.x,
                        y: field.y,
                        width: field.width,
                        height: field.height,
                        fontSize: field.fontSize,
                        fontFamily: field.fontFamily,
                        bold: field.bold,
                        textAlign: field.textAlign,
                        rotation: field.rotation
                    };
                    console.log('📝 Created element:', element);
                    return element;
                })
            };
            
            console.log('📐 Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
            console.log('🎨 Background image present:', !!this.backgroundImage);
            
            // Add background image as an element if present
            if (this.originalBackgroundImage) {
                // CRITICAL FIX: Store the original clean background, NOT the canvas with overlays
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.canvas.width;
                tempCanvas.height = this.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Draw only the clean original background
                tempCtx.drawImage(this.originalBackgroundImage, 0, 0, tempCanvas.width, tempCanvas.height);
                
                const bgElement = {
                    type: 'background-image',
                    content: tempCanvas.toDataURL(), // Clean background only
                    x: 0,
                    y: 0,
                    width: this.canvas.width,
                    height: this.canvas.height
                };
                templateConfig.elements.unshift(bgElement);
                console.log('🖼️ Added CLEAN background element (no field overlays)');
            } else if (this.backgroundImage) {
                console.log('⚠️ Warning: No original background available, using current backgroundImage');
                const bgElement = {
                    type: 'background-image',
                    content: this.backgroundImage.src,
                    x: 0,
                    y: 0,
                    width: this.canvas.width,
                    height: this.canvas.height
                };
                templateConfig.elements.unshift(bgElement);
                console.log('🖼️ Added background element from backgroundImage.src');
            }
            
            const template = {
                name: templateName,
                config: templateConfig,
                category: 'Visual Designer',
                description: `Visual template with ${this.fields.length} fields`
            };
            if (this.currentTemplateId) {
                template.id = this.currentTemplateId;
            }
            
            console.log('📋 Complete template object:', template);
            console.log('📋 Template config elements:', templateConfig.elements.length);
            
            // Save or update using POST (server updates when id is present)
            console.log('Sending template to server:', JSON.stringify(template, null, 2));
            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(template)
            });
            
            console.log('🌐 Server response status:', response.status);
            console.log('🌐 Server response ok:', response.ok);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Template saved successfully:', result);
                console.log('✅ Saved template ID:', result.id);
                console.log('✅ Saved template name:', result.name);
                // Keep editing if this was an update; otherwise allow continuing
                this.currentTemplateId = result.id;
                if (typeof showSuccess === 'function') {
                    showSuccess(`Template "${templateName}" saved.`);
                } else {
                    alert(`Template "${templateName}" saved.`);
                }
                // Refresh template list in the background
                if (typeof window.loadTemplates === 'function') {
                    window.loadTemplates();
                }
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to save template. Status:', response.status);
                console.error('❌ Error response text:', errorText);
                console.error('❌ Response headers:', [...response.headers.entries()]);
                
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('❌ Parsed error:', errorJson);
                    
                    // Handle duplicate name error specifically
                    if (errorJson.error && errorJson.error.includes('already exists')) {
                        alert(errorJson.error);
                        templateNameInput.focus();
                        templateNameInput.select();
                        return;
                    }
                    
                    alert(`Failed to save template: ${errorJson.error}\n${errorJson.details ? JSON.stringify(errorJson.details) : ''}`);
                } catch (e) {
                    console.error('❌ Failed to parse error response:', e);
                    alert(`Failed to save template: ${errorText}`);
                }
            }
        } catch (error) {
            console.error('💥 Exception during template save:', error);
            console.error('💥 Error stack:', error.stack);
            alert('Failed to save template. Please check the console for details.');
        } finally {
            console.log('🔄 saveTemplate() called - END');
        }
    }
    
    previewTemplate() {
        if (this.fields.length === 0) {
            alert('Please add some fields first.');
            return;
        }
        
        // Generate preview with sample data
        const sampleData = {
            firstName: 'John',
            lastName: 'Doe',
            middleName: 'A',
            title: 'Delegate',
            precinct: '123',
            caucus: 'District 1',
            eventName: 'Sample Event',
            eventDate: '2024-01-15',
            address: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zip: '12345',
            phone: '(555) 123-4567',
            email: 'john.doe@example.com'
        };
        
        this.generatePreview(sampleData);
    }
    
    generatePreview(data) {
        // Create a new canvas for preview
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = this.canvas.width;
        previewCanvas.height = this.canvas.height;
        const previewCtx = previewCanvas.getContext('2d');
        
        // Draw background
        if (this.backgroundImage) {
            previewCtx.drawImage(this.backgroundImage, 0, 0, previewCanvas.width, previewCanvas.height);
        }
        
        // Draw fields with actual data
        this.fields.forEach(field => {
            previewCtx.save();
            
            if (field.rotation !== 0) {
                const centerX = field.x + field.width / 2;
                const centerY = field.y + field.height / 2;
                previewCtx.translate(centerX, centerY);
                previewCtx.rotate((field.rotation * Math.PI) / 180);
                previewCtx.translate(-centerX, -centerY);
            }
            
            previewCtx.fillStyle = '#212529';
            previewCtx.font = `${field.bold ? 'bold ' : ''}${field.fontSize}px ${field.fontFamily}`;
            previewCtx.textBaseline = 'middle';
            
            // Handle custom text vs field data
            let text;
            if (field.type === 'customText') {
                text = field.content || 'Custom Text';
            } else {
                text = data[field.type] || `[${field.type}]`;
            }
            
            const textY = field.y + field.height / 2;
            let textX = field.x;
            
            // Apply text alignment
            switch (field.textAlign) {
                case 'center':
                    previewCtx.textAlign = 'center';
                    textX = field.x + field.width / 2;
                    break;
                case 'right':
                    previewCtx.textAlign = 'right';
                    textX = field.x + field.width;
                    break;
                default: // 'left'
                    previewCtx.textAlign = 'left';
                    textX = field.x;
                    break;
            }
            
            previewCtx.fillText(text, textX, textY);
            
            previewCtx.restore();
        });
        
        // Show preview in new window
        const previewWindow = window.open('', '_blank');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Template Preview</title>
                <style>
                    body { margin: 0; padding: 20px; text-align: center; background: #f5f5f5; }
                    canvas { border: 1px solid #ccc; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .actions { margin-top: 20px; }
                    button { 
                        padding: 10px 20px; 
                        margin: 0 10px; 
                        background: #007bff; 
                        color: white; 
                        border: none; 
                        border-radius: 5px; 
                        cursor: pointer; 
                    }
                    button:hover { background: #0056b3; }
                </style>
            </head>
            <body>
                <h3>Template Preview</h3>
                <canvas width="${previewCanvas.width}" height="${previewCanvas.height}"></canvas>
                <div class="actions">
                    <button onclick="printPreview()">Print Preview</button>
                    <button onclick="window.close()">Close</button>
                </div>
                <script>
                    const canvas = document.querySelector('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = function() {
                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = '${previewCanvas.toDataURL()}';
                    
                    function printPreview() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `);
    }
    
    // Generate PDF using jsPDF
    async generatePDF(data) {
        try {
            // Check if jsPDF is available (try different access methods)
            let jsPDF = window.jsPDF;
            if (!jsPDF && window.jspdf) {
                jsPDF = window.jspdf.jsPDF;
            }
            if (!jsPDF) {
                console.error('jsPDF not available. Checked:', {
                    'window.jsPDF': typeof window.jsPDF,
                    'window.jspdf': typeof window.jspdf,
                    'window.jspdf.jsPDF': window.jspdf ? typeof window.jspdf.jsPDF : 'N/A'
                });
                alert('PDF generation not available. Please check if jsPDF is loaded.');
                return null;
            }
            
            // Create PDF (4x6 inches at 72 DPI)
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: [288, 432] // 4x6 inches in points
            });
            
            // Add background image if present (completely clean - no text, no overlays)
            if (this.backgroundImage) {
                try {
                    console.log('🖼️ Adding background image to PDF (clean, no text)');
                    console.log('🖼️ backgroundImage type:', typeof this.backgroundImage);
                    console.log('🖼️ backgroundImage constructor:', this.backgroundImage.constructor.name);
                    console.log('🖼️ backgroundImage src:', this.backgroundImage.src ? this.backgroundImage.src.substring(0, 50) + '...' : 'No src');
                    console.log('🔍 originalBackgroundImage exists:', !!this.originalBackgroundImage);
                    console.log('🔍 originalBackgroundImage type:', typeof this.originalBackgroundImage);
                    if (this.originalBackgroundImage) {
                        console.log('🔍 originalBackgroundImage constructor:', this.originalBackgroundImage.constructor.name);
                        console.log('🔍 originalBackgroundImage src:', this.originalBackgroundImage.src ? this.originalBackgroundImage.src.substring(0, 50) + '...' : 'No src');
                    }
                    
                    // CRITICAL FIX: Use only the original clean background image
                    if (this.originalBackgroundImage) {
                        console.log('🖼️ Using ORIGINAL background image (guaranteed clean)');
                        
                        // Create a temporary canvas with ONLY the original background image
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = this.canvas.width;
                        tempCanvas.height = this.canvas.height;
                        const tempCtx = tempCanvas.getContext('2d');
                        
                        // Clear the canvas first (ensure it's completely clean)
                        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                        
                        // Draw ONLY the original background image - no text, no fields, no overlays
                        tempCtx.drawImage(this.originalBackgroundImage, 0, 0, tempCanvas.width, tempCanvas.height);
                        
                        // Convert to image data and add to PDF
                        const imgData = tempCanvas.toDataURL('image/jpeg', 0.8);
                        pdf.addImage(imgData, 'JPEG', 0, 0, 288, 432);
                        
                        // DEBUG: Log what's in the background image
                        console.log('🔍 Background image data URL length:', imgData.length);
                        console.log('🔍 Background image preview:', imgData.substring(0, 100) + '...');
                        
                        console.log('✅ Clean background image added to PDF');
                    } else {
                        console.log('🚫 SKIPPING background - no clean original image available');
                        console.log('🚫 This prevents canvas text from appearing in PDF background');
                        // Continue without background to prevent text contamination
                    }
                } catch (e) {
                    console.warn('❌ Failed to add background image to PDF:', e);
                }
            } else {
                console.log('📝 No background image - PDF will have white background');
            }
            
            // Add text fields
            console.log('🔍 DEBUG PDF Generation - Fields:', this.fields.length);
            this.fields.forEach((field, index) => {
                console.log(`🔍 DEBUG Field ${index}:`, {
                    type: field.type,
                    content: field.content,
                    id: field.id,
                    x: field.x,
                    y: field.y
                });
                
                try {
                    // Handle custom text vs field data
                    let text;
                    if (field.type === 'customText') {
                        // For custom text, use the content directly
                        text = field.content || 'Custom Text';
                        console.log(`📝 Custom text field: "${text}"`);
                    } else {
                        // Use unified field mapping function
                        const fieldValue = window.mapFieldValue ? window.mapFieldValue(field.type, data) : null;
                        text = fieldValue || `[${field.type}]`;
                        
                        console.log(`🔄 Data field ${field.type}:`);
                        console.log(`   - field.content: "${field.content}"`);
                        console.log(`   - unified mapping result: "${fieldValue}"`);
                        console.log(`   - final text: "${text}"`);
                    }
                    
                    // Set font
                    pdf.setFont(field.fontFamily.toLowerCase());
                    if (field.bold) {
                        pdf.setFont(field.fontFamily.toLowerCase(), 'bold');
                    }
                    pdf.setFontSize(field.fontSize);
                    
                    // SIMPLE: Use the actual canvas dimensions (what was working)
                    const scaleX = 288 / this.canvas.width;
                    const scaleY = 432 / this.canvas.height;
                    let x = field.x * scaleX;
                    let y = field.y * scaleY;
                    
                    // Apply user-defined offsets for fine-tuning
                    x += (this.pdfOffsetX || 0);
                    y += (this.pdfOffsetY || 0);
                    
                    console.log(`🔍 STANDARDIZED: Field(${field.x}, ${field.y}) -> PDF(${x.toFixed(1)}, ${y.toFixed(1)}) [Scale: 0.5x0.5]`);
                    if (this.pdfOffsetX || this.pdfOffsetY) {
                        console.log(`🎯 Applied Offset: X=${this.pdfOffsetX || 0}, Y=${this.pdfOffsetY || 0}`);
                    }
                    
                    // Apply text alignment
                    let align = 'left';
                    if (field.textAlign === 'center') align = 'center';
                    else if (field.textAlign === 'right') align = 'right';
                    
                    // Handle rotation
                    if (field.rotation !== 0) {
                        pdf.save();
                        const centerX = x + (field.width * scaleX) / 2;
                        const centerY = y + (field.height * scaleY) / 2;
                        pdf.translate(centerX, centerY);
                        pdf.rotate(field.rotation);
                        pdf.translate(-centerX, -centerY);
                    }
                    
                    console.log(`📄 Adding text to PDF: "${text}" at (${x.toFixed(1)}, ${(y + field.fontSize).toFixed(1)})`);
                    pdf.text(text, x, y + field.fontSize, { align: align });
                    console.log(`✅ Text added to PDF successfully`);
                    
                    if (field.rotation !== 0) {
                        pdf.restore();
                    }
                } catch (e) {
                    console.warn('Failed to add field to PDF:', field, e);
                }
            });
            
            return pdf;
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please check the console for details.');
            return null;
        }
    }
    
    applyOffset() {
        console.log('🎯 Applying PDF offset:', this.pdfOffsetX, this.pdfOffsetY);
        
        // Update the input values to match internal state
        const pdfOffsetX = document.getElementById('pdfOffsetX');
        const pdfOffsetY = document.getElementById('pdfOffsetY');
        
        if (pdfOffsetX) this.pdfOffsetX = parseInt(pdfOffsetX.value) || 0;
        if (pdfOffsetY) this.pdfOffsetY = parseInt(pdfOffsetY.value) || 0;
        
        console.log('🎯 New offset values:', this.pdfOffsetX, this.pdfOffsetY);
        
        // Trigger a test print with the new offset
        this.testPrint();
    }
    
    resetOffset() {
        console.log('🎯 Resetting PDF offset to 0,0');
        this.pdfOffsetX = 0;
        this.pdfOffsetY = 0;
        
        // Update the input fields
        const pdfOffsetX = document.getElementById('pdfOffsetX');
        const pdfOffsetY = document.getElementById('pdfOffsetY');
        
        if (pdfOffsetX) pdfOffsetX.value = '0';
        if (pdfOffsetY) pdfOffsetY.value = '0';
    }

    async testPrint() {
        console.log('🖨️ VISUAL DESIGNER testPrint() called');
        console.log('🖨️ Fields count:', this.fields.length);
        console.log('🖨️ Fields array:', this.fields);
        console.log('🖨️ Call stack:', new Error().stack);
        
        if (this.fields.length === 0) {
            console.log('🖨️ No fields - showing alert');
            console.error('🖨️ ALERT TRIGGERED: No fields available for test print');
            console.error('🖨️ DEBUG: this.fields =', this.fields);
            console.error('🖨️ DEBUG: typeof this.fields =', typeof this.fields);
            console.error('🖨️ DEBUG: Array.isArray(this.fields) =', Array.isArray(this.fields));
            alert('Please add some fields first.');
            return;
        }
        
        try {
            console.log('🖨️ Starting PDF generation...');
            // Generate test data
            const sampleData = {
                firstName: 'TEST',
                lastName: 'PRINT', 
                middleName: 'USER',
                // Support both naming conventions
                first_name: 'TEST',
                last_name: 'PRINT',
                middle_name: 'USER',
                title: 'Test User',
                precinct: '999',
                caucus: 'Test Caucus',
                eventName: 'Test Event',
                eventDate: '2024-01-01',
                address: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zip: '12345',
                phone: '555-0123',
                email: 'test@example.com'
            };
            
            // Generate PDF
            const pdf = await this.generatePDF(sampleData);
            if (pdf) {
                // Open PDF in new window for printing
                const pdfData = pdf.output('datauristring');
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Test Print</title>
                        <style>
                            body { margin: 0; padding: 20px; text-align: center; }
                            iframe { width: 100%; height: 80vh; border: 1px solid #ccc; }
                            .actions { margin-top: 20px; }
                            button { 
                                padding: 10px 20px; 
                                margin: 0 10px; 
                                background: #007bff; 
                                color: white; 
                                border: none; 
                                border-radius: 5px; 
                                cursor: pointer; 
                            }
                            button:hover { background: #0056b3; }
                        </style>
                    </head>
                    <body>
                        <h3>Test Print Preview</h3>
                        <iframe src="${pdfData}"></iframe>
                        <div class="actions">
                            <button onclick="window.print()">Print</button>
                            <button onclick="window.close()">Close</button>
                        </div>
                    </body>
                    </html>
                `);
            }
        } catch (error) {
            console.error('Test print failed:', error);
            alert('Test print failed. Please check the console for details.');
        }
    }

    // Multi-selection support
    toggleFieldSelection(field) {
        const index = this.selectedFields.indexOf(field);
        if (index === -1) {
            // Add to selection
            this.selectedFields.push(field);
            this.selectedField = field; // Make it the primary selection
        } else {
            // Remove from selection
            this.selectedFields.splice(index, 1);
            this.selectedField = this.selectedFields.length > 0 ? this.selectedFields[0] : null;
        }
        this.updatePropertiesPanel();
    }

    // Text alignment methods
    setTextAlignment(alignment) {
        console.log('setTextAlignment called with:', alignment, 'selectedField:', this.selectedField ? this.selectedField.id : 'none');
        if (this.selectedField) {
            console.log('Changing alignment from', this.selectedField.textAlign, 'to', alignment);
            this.selectedField.textAlign = alignment;
            this.updateAlignmentButtons();
            this.draw();
        } else {
            console.log('No field selected for alignment');
        }
    }

    updateAlignmentButtons() {
        console.log('updateAlignmentButtons called, selectedField textAlign:', this.selectedField ? this.selectedField.textAlign : 'no field');
        if (!this.selectedField) return;
        
        // Update button states - remove active class from all first
        const alignLeftBtn = document.getElementById('alignLeftBtn');
        const alignCenterBtn = document.getElementById('alignCenterBtn');
        const alignRightBtn = document.getElementById('alignRightBtn');
        
        console.log('Alignment buttons found:', {
            left: !!alignLeftBtn,
            center: !!alignCenterBtn,
            right: !!alignRightBtn
        });
        
        if (alignLeftBtn) {
            alignLeftBtn.classList.remove('active');
            if (this.selectedField.textAlign === 'left') {
                console.log('Setting left button as active');
                alignLeftBtn.classList.add('active');
            }
        }
        if (alignCenterBtn) {
            alignCenterBtn.classList.remove('active');
            if (this.selectedField.textAlign === 'center') {
                console.log('Setting center button as active');
                alignCenterBtn.classList.add('active');
            }
        }
        if (alignRightBtn) {
            alignRightBtn.classList.remove('active');
            if (this.selectedField.textAlign === 'right') {
                console.log('Setting right button as active');
                alignRightBtn.classList.add('active');
            }
        }
    }

    // Center alignment methods
    centerSelectedField(direction) {
        if (!this.selectedField) return;
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        if (direction === 'horizontal' || direction === 'both') {
            this.selectedField.x = centerX - this.selectedField.width / 2;
        }
        
        if (direction === 'vertical' || direction === 'both') {
            this.selectedField.y = centerY - this.selectedField.height / 2;
        }
        
        this.draw();
    }

    // Multi-field alignment methods
    alignSelectedFields(direction) {
        if (this.selectedFields.length < 2) return;
        
        let referenceValue;
        
        switch (direction) {
            case 'left':
                referenceValue = Math.min(...this.selectedFields.map(f => f.x));
                this.selectedFields.forEach(field => field.x = referenceValue);
                break;
                
            case 'center':
                referenceValue = this.selectedFields.reduce((sum, f) => sum + f.x + f.width / 2, 0) / this.selectedFields.length;
                this.selectedFields.forEach(field => field.x = referenceValue - field.width / 2);
                break;
                
            case 'right':
                referenceValue = Math.max(...this.selectedFields.map(f => f.x + f.width));
                this.selectedFields.forEach(field => field.x = referenceValue - field.width);
                break;
                
            case 'top':
                referenceValue = Math.min(...this.selectedFields.map(f => f.y));
                this.selectedFields.forEach(field => field.y = referenceValue);
                break;
                
            case 'middle':
                referenceValue = this.selectedFields.reduce((sum, f) => sum + f.y + f.height / 2, 0) / this.selectedFields.length;
                this.selectedFields.forEach(field => field.y = referenceValue - field.height / 2);
                break;
                
            case 'bottom':
                referenceValue = Math.max(...this.selectedFields.map(f => f.y + f.height));
                this.selectedFields.forEach(field => field.y = referenceValue - field.height);
                break;
        }
        
        this.draw();
    }

    // Distribute fields horizontally
    distributeSelectedFields(direction) {
        if (this.selectedFields.length < 3) return;
        
        if (direction === 'horizontal') {
            // Sort fields by x position
            const sortedFields = [...this.selectedFields].sort((a, b) => a.x - b.x);
            const leftmost = sortedFields[0].x;
            const rightmost = sortedFields[sortedFields.length - 1].x + sortedFields[sortedFields.length - 1].width;
            const totalSpace = rightmost - leftmost;
            const spacing = totalSpace / (sortedFields.length - 1);
            
            for (let i = 1; i < sortedFields.length - 1; i++) {
                sortedFields[i].x = leftmost + spacing * i;
            }
        }
        
        this.draw();
    }

    // Render the list of fields in the sidebar
    renderFieldsList() {
        const list = document.getElementById('fieldsList');
        if (!list) return;
        list.innerHTML = '';
        
        this.fields.forEach((field) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            const label = field.label || field.type || 'Field';
            item.innerHTML = `<span>${label}</span><small class="text-muted">(${Math.round(field.x)}, ${Math.round(field.y)})</small>`;
            if (this.selectedField && this.selectedField.id === field.id) {
                item.classList.add('active');
            }
            item.addEventListener('click', () => {
                this.selectField(field);
                this.draw();
            });
            item.addEventListener('dblclick', () => {
                this.selectField(field);
                this.updatePropertiesPanel();
            });
            list.appendChild(item);
        });
    }

    // History helpers
    pushHistory() {
        // Store a deep copy of fields for undo
        const snapshot = JSON.parse(JSON.stringify(this.fields));
        this.historyStack.push(snapshot);
        // Clear the redo stack on new action
        this.futureStack = [];
    }

    undo() {
        if (this.historyStack.length === 0) return;
        const current = JSON.parse(JSON.stringify(this.fields));
        this.futureStack.push(current);
        const prev = this.historyStack.pop();
        this.fields = prev || [];
        // Try to keep selection if id still exists
        if (this.selectedField) {
            const keep = this.fields.find(f => f.id === this.selectedField.id);
            this.selectedField = keep || null;
        }
        this.updatePropertiesPanel();
        this.draw();
    }

    redo() {
        if (this.futureStack.length === 0) return;
        const current = JSON.parse(JSON.stringify(this.fields));
        this.historyStack.push(current);
        const next = this.futureStack.pop();
        this.fields = next || [];
        if (this.selectedField) {
            const keep = this.fields.find(f => f.id === this.selectedField.id);
            this.selectedField = keep || null;
        }
        this.updatePropertiesPanel();
        this.draw();
    }

    clearFieldsOnly() {
        if (!confirm('Clear all fields from the template? Background will remain.')) return;
        if (this.fields.length === 0) return;
        this.pushHistory();
        this.fields = [];
        this.selectedField = null;
        this.updatePropertiesPanel();
        this.draw();
    }

    // Start a brand new template with no fields and no background
    startNewTemplate() {
        console.log('🆕 Starting a brand new template');
        // Reset offsets
        this.pdfOffsetX = 0;
        this.pdfOffsetY = 0;
        const pdfOffsetXInput = document.getElementById('pdfOffsetX');
        const pdfOffsetYInput = document.getElementById('pdfOffsetY');
        if (pdfOffsetXInput) pdfOffsetXInput.value = 0;
        if (pdfOffsetYInput) pdfOffsetYInput.value = 0;
        
        // Fully reset the designer (clears fields and background)
        this.resetDesigner();
        this.currentTemplateId = null;
        
        // Clear template name
        const templateNameInput = document.getElementById('templateNameInput');
        if (templateNameInput) templateNameInput.value = '';
        
        // Ensure lists and properties reflect blank state
        this.renderFieldsList();
        this.updatePropertiesPanel();
        this.draw();
    }
}

// Make VisualDesigner available globally for debugging
window.VisualDesigner = VisualDesigner;
console.log('🎯 VisualDesigner class loaded and available globally');

// Add manual debugging functions
window.debugVisualDesigner = function() {
    console.log('=== VISUAL DESIGNER DEBUG INFO ===');
    console.log('VisualDesigner class:', typeof VisualDesigner);
    console.log('window.visualDesigner:', window.visualDesigner);
    console.log('Modal exists:', !!document.getElementById('visualDesignerModal'));
    console.log('Save button exists:', !!document.getElementById('saveTemplateBtn'));
    console.log('Template name input exists:', !!document.getElementById('templateNameInput'));
    console.log('Field selector exists:', !!document.getElementById('fieldTypeSelect'));
    console.log('Canvas exists:', !!document.getElementById('visualDesignerCanvas'));
    
    // Try to manually create instance
    try {
        const testInstance = new VisualDesigner();
        console.log('✅ Manual instance creation successful');
        window.testVisualDesigner = testInstance;
        return testInstance;
    } catch (error) {
        console.error('❌ Manual instance creation failed:', error);
        return null;
    }
};

// Add manual save test
window.testSaveTemplate = function() {
    console.log('=== TESTING SAVE TEMPLATE ===');
    if (window.visualDesigner) {
        console.log('Using existing visualDesigner instance');
        window.visualDesigner.saveTemplate();
    } else if (window.testVisualDesigner) {
        console.log('Using test visualDesigner instance');
        window.testVisualDesigner.saveTemplate();
    } else {
        console.log('No visualDesigner instance found, creating one...');
        const instance = window.debugVisualDesigner();
        if (instance) {
            instance.saveTemplate();
        }
    }
};

// Test the specific modal button
window.testModalSaveButton = function() {
    console.log('=== TESTING MODAL SAVE BUTTON ===');
    const modal = document.getElementById('visualDesignerModal');
    const saveBtn = modal.querySelector('#saveTemplateBtn');
    console.log('Modal save button:', saveBtn);
    console.log('Modal save button visible:', saveBtn ? saveBtn.offsetParent !== null : false);
    
    if (saveBtn) {
        // Add a temporary test listener
        const testListener = () => {
            console.log('🎯 MODAL SAVE BUTTON CLICKED! This should work now.');
            alert('Modal save button works!');
        };
        
        saveBtn.addEventListener('click', testListener, { once: true });
        console.log('Added test listener. Now click the save button in the Visual Designer modal.');
        
        // Remove after 10 seconds
        setTimeout(() => {
            saveBtn.removeEventListener('click', testListener);
            console.log('Test listener removed.');
        }, 10000);
    }
};

// Debug all save template buttons
window.debugSaveButtons = function() {
    console.log('=== SAVE BUTTON DEBUG ===');
    const buttons = document.querySelectorAll('[id*="save"], [id*="Save"], button');
    console.log('All buttons on page:', buttons.length);
    
    buttons.forEach((btn, index) => {
        if (btn.id && (btn.id.toLowerCase().includes('save') || btn.id.toLowerCase().includes('template'))) {
            console.log(`Button ${index}: ID="${btn.id}", Text="${btn.textContent?.trim()}", Visible=${btn.offsetParent !== null}`);
            
            // Check event listeners
            const listeners = getEventListeners ? getEventListeners(btn) : 'Not available in this browser';
            console.log(`  Event listeners:`, listeners);
        }
    });
    
    // Specifically check the Visual Designer modal buttons
    const modal = document.getElementById('visualDesignerModal');
    if (modal) {
        const modalButtons = modal.querySelectorAll('button');
        console.log('Buttons in Visual Designer modal:', modalButtons.length);
        modalButtons.forEach((btn, index) => {
            console.log(`  Modal Button ${index}: ID="${btn.id}", Text="${btn.textContent?.trim()}", Visible=${btn.offsetParent !== null}`);
        });
    }
};

// Initialize Visual Designer when modal is shown
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Visual Designer DOMContentLoaded - setting up modal listener');
    
    // Initialize when modal is shown
    const modal = document.getElementById('visualDesignerModal');
    console.log('🎯 Visual Designer modal element found:', !!modal);
    
    if (modal) {
        modal.addEventListener('shown.bs.modal', function() {
            console.log('🎯 Visual Designer modal shown event fired');
            if (!window.visualDesigner) {
                console.log('🎯 Creating new Visual Designer instance on window');
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    window.visualDesigner = new VisualDesigner();
                    console.log('🎯 Visual Designer instance created and assigned to window');
                    if (window.forceNewVisualTemplate) {
                        window.visualDesigner.startNewTemplate();
                        window.forceNewVisualTemplate = false;
                    }
                }, 100);
            } else {
                console.log('🎯 Visual Designer instance already exists on window');
                if (window.forceNewVisualTemplate) {
                    window.visualDesigner.startNewTemplate();
                    window.forceNewVisualTemplate = false;
                }
            }
        });
    } else {
        console.error('❌ Visual Designer modal not found in DOM!');
    }
});

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
        this.selectedField = null;
        this.selectedFields = []; // For multi-selection
        this.dragOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.scale = 1;
        this.snapToGrid = true;
        this.gridSize = 10;
        this.availableFields = [];
        
        console.log('🎯 VisualDesigner calling init()');
        this.init();
    }
    
    resetDesigner() {
        console.log('Resetting Visual Designer state');
        this.fields = [];
        this.selectedField = null;
        this.selectedFields = [];
        this.backgroundImage = null;
        this.isDragging = false;
        
        // Clear template name input
        const templateNameInput = document.getElementById('templateNameInput');
        if (templateNameInput) {
            templateNameInput.value = '';
        }
        
        // Hide field properties panel
        const fieldProperties = document.getElementById('fieldProperties');
        if (fieldProperties) {
            fieldProperties.classList.add('d-none');
        }
        
        // Redraw canvas
        this.draw();
        
        console.log('Visual Designer state reset complete');
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
        console.log('visualBackgroundUpload element:', backgroundUpload);
        if (backgroundUpload) {
            backgroundUpload.addEventListener('change', (e) => {
                console.log('Background upload triggered');
                this.handleBackgroundUpload(e);
            });
            console.log('Background upload listener added');
        } else {
            console.error('visualBackgroundUpload element not found');
        }
        
        // Remove background
        const removeBackground = document.getElementById('visualRemoveBackground');
        console.log('visualRemoveBackground element:', removeBackground);
        if (removeBackground) {
            removeBackground.addEventListener('click', () => {
                console.log('Remove background clicked');
                this.removeBackground();
            });
        }
        
        // Add field button
        const addFieldBtn = document.getElementById('visualAddFieldBtn');
        console.log('visualAddFieldBtn element:', addFieldBtn);
        if (addFieldBtn) {
            addFieldBtn.addEventListener('click', () => {
                console.log('Add field clicked');
                this.addField();
            });
            console.log('Add field listener added');
        } else {
            console.error('addFieldBtn element not found');
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
        
        const testPrintBtn = document.getElementById('testPrintBtn');
        if (testPrintBtn) {
            testPrintBtn.addEventListener('click', () => {
                this.testPrint();
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
        console.log('addField called');
        const select = document.getElementById('fieldTypeSelect');
        if (!select) {
            console.error('fieldTypeSelect not found');
            return;
        }
        
        const fieldType = select.value;
        console.log('Selected field type:', fieldType);
        
        if (!fieldType) {
            alert('Please select a field type first.');
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
            fieldLabel = 'Custom: ' + customText.substring(0, 20) + (customText.length > 20 ? '...' : '');
        }
        
        const field = {
            id: Date.now(),
            type: fieldType,
            content: fieldContent, // Store the actual content
            label: fieldLabel,
            x: this.canvas.width / 2 - 50,
            y: this.canvas.height / 2 - 10,
            fontSize: 12,
            fontFamily: 'Arial',
            bold: false,
            rotation: 0,
            textAlign: 'left', // left, center, right
            width: 100,
            height: 20
        };
        
        console.log('Creating field:', field);
        this.fields.push(field);
        console.log('Total fields:', this.fields.length);
        this.selectField(field);
        this.draw();
        
        // Reset select
        select.value = '';
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
        
        // Convert camelCase to readable format
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
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
            this.selectedField[property] = value;
            this.draw();
        }
    }
    
    rotateSelectedField() {
        if (this.selectedField) {
            this.selectedField.rotation = (this.selectedField.rotation + 180) % 360;
            this.draw();
        }
    }
    
    deleteSelectedField() {
        if (this.selectedField) {
            const index = this.fields.indexOf(this.selectedField);
            if (index > -1) {
                this.fields.splice(index, 1);
                this.selectedField = null;
                this.updatePropertiesPanel();
                this.draw();
            }
        }
    }
    
    getMousePos(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }
    
    getFieldAt(x, y) {
        // Check fields in reverse order (top to bottom)
        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];
            if (x >= field.x && x <= field.x + field.width &&
                y >= field.y && y <= field.y + field.height) {
                return field;
            }
        }
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
            
            // Apply snap to grid if enabled
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
        } else {
            // Update cursor based on hover
            const field = this.getFieldAt(pos.x, pos.y);
            this.canvas.style.cursor = field ? 'grab' : 'default';
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
        console.log('draw() called, fields:', this.fields.length, 'background:', !!this.backgroundImage);
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
        
        // Draw fields
        this.fields.forEach(field => {
            this.drawField(field);
        });
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
        
        // Use the stored content or fall back to placeholder format
        const text = field.content || `{{${field.type}}}`;
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
                width: this.canvas.width,
                height: this.canvas.height,
                elements: this.fields.map(field => {
                    const element = {
                        type: 'text',
                        content: field.content || `{{${field.type}}}`,
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
            if (this.backgroundImage) {
                const bgElement = {
                    type: 'background-image',
                    content: this.canvas.toDataURL(),
                    x: 0,
                    y: 0,
                    width: this.canvas.width,
                    height: this.canvas.height
                };
                templateConfig.elements.unshift(bgElement);
                console.log('🖼️ Added background element:', bgElement);
            }
            
            const template = {
                name: templateName,
                config: templateConfig,
                category: 'Visual Designer',
                description: `Visual template with ${this.fields.length} fields`
            };
            
            console.log('📋 Complete template object:', template);
            console.log('📋 Template config elements:', templateConfig.elements.length);
            
            // Save to server using the same API as other templates
            console.log('Sending template to server:', JSON.stringify(template, null, 2));
            
            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(template)
            });
            
            console.log('🌐 Server response status:', response.status);
            console.log('🌐 Server response ok:', response.ok);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Template saved successfully:', result);
                console.log('✅ Saved template ID:', result.id);
                console.log('✅ Saved template name:', result.name);
                alert(`Template "${templateName}" saved successfully!`);
                
                // Reset the designer
                console.log('🔄 Resetting designer...');
                this.resetDesigner();
                
                // Close modal and refresh templates list
                const modal = bootstrap.Modal.getInstance(document.getElementById('visualDesignerModal'));
                if (modal) {
                    modal.hide();
                    
                    // Refresh templates list after modal is hidden
                    modal._element.addEventListener('hidden.bs.modal', function() {
                        if (typeof window.loadTemplates === 'function') {
                            console.log('Refreshing templates list after save...');
                            window.loadTemplates();
                        } else if (typeof loadTemplates === 'function') {
                            console.log('Refreshing templates list after save (global)...');
                            loadTemplates();
                        } else {
                            console.warn('loadTemplates function not available');
                        }
                    }, { once: true });
                } else {
                    // Fallback: try to refresh immediately
                    if (typeof window.loadTemplates === 'function') {
                        console.log('Immediate refresh - window.loadTemplates...');
                        window.loadTemplates();
                    } else if (typeof loadTemplates === 'function') {
                        console.log('Immediate refresh - loadTemplates...');
                        loadTemplates();
                    }
                }
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to save template. Status:', response.status);
                console.error('❌ Error response text:', errorText);
                console.error('❌ Response headers:', [...response.headers.entries()]);
                
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('❌ Parsed error:', errorJson);
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
            
            // Add background image if present
            if (this.backgroundImage) {
                try {
                    const imgData = this.canvas.toDataURL('image/jpeg', 0.8);
                    pdf.addImage(imgData, 'JPEG', 0, 0, 288, 432);
                } catch (e) {
                    console.warn('Failed to add background image to PDF:', e);
                }
            }
            
            // Add text fields
            this.fields.forEach(field => {
                try {
                    // Handle custom text vs field data
                    let text;
                    if (field.type === 'customText') {
                        text = field.content || 'Custom Text';
                    } else {
                        text = data[field.type] || `[${field.type}]`;
                    }
                    
                    // Set font
                    pdf.setFont(field.fontFamily.toLowerCase());
                    if (field.bold) {
                        pdf.setFont(field.fontFamily.toLowerCase(), 'bold');
                    }
                    pdf.setFontSize(field.fontSize);
                    
                    // Calculate position (scale from canvas to PDF)
                    const scaleX = 288 / this.canvas.width;
                    const scaleY = 432 / this.canvas.height;
                    const x = field.x * scaleX;
                    const y = field.y * scaleY;
                    
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
                    
                    pdf.text(text, x, y + field.fontSize, { align: align });
                    
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
    
    async testPrint() {
        if (this.fields.length === 0) {
            alert('Please add some fields first.');
            return;
        }
        
        try {
            // Generate test data
            const sampleData = {
                firstName: 'TEST',
                lastName: 'PRINT', 
                middleName: 'USER',
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
                }, 100);
            } else {
                console.log('🎯 Visual Designer instance already exists on window');
            }
        });
    } else {
        console.error('❌ Visual Designer modal not found in DOM!');
    }
});

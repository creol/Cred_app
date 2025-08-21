// Canva Import Functions - URGENT FIX v1.1.0
console.log("URGENT FIX: Canva import script loaded!");

function showCanvaImport() {
    console.log("showCanvaImport called");
    const modal = document.getElementById("canvaImportModal");
    if (modal) {
        console.log("Modal found, showing...");
        const fileInput = document.getElementById("canvaFile");
        const nameInput = document.getElementById("canvaTemplateName");
        const descInput = document.getElementById("canvaTemplateDesc") || document.getElementById("canvaTemplateDescription");
        const preview = document.getElementById("canvaPreview");
        const mapping = document.getElementById("canvaFieldMapping");
        const importBtn = document.getElementById("importCanvaDesign");
        
        if (fileInput) fileInput.value = "";
        if (nameInput) nameInput.value = "";
        if (descInput) descInput.value = "";
        if (preview) preview.innerHTML = "Upload a file to see preview";
        if (mapping) mapping.innerHTML = "";
        if (importBtn) importBtn.disabled = true;
        
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
        setupCanvaImportListeners();
    } else {
        console.error("canvaImportModal not found");
    }
}

function setupCanvaImportListeners() {
    const fileInput = document.getElementById("canvaFile");
    const importBtn = document.getElementById("importCanvaDesign");
    
    if (fileInput && !fileInput.hasAttribute("data-listener-added")) {
        console.log("Adding file input listener");
        fileInput.addEventListener("change", handleCanvaFileUpload);
        fileInput.setAttribute("data-listener-added", "true");
    }
    
    if (importBtn && !importBtn.hasAttribute("data-listener-added")) {
        console.log("Adding import button listener");
        importBtn.addEventListener("click", processCanvaImport);
        importBtn.setAttribute("data-listener-added", "true");
    }
}

function handleCanvaFileUpload(event) {
    console.log("File uploaded");
    const file = event.target.files[0];
    if (!file) return;
    
    console.log("File details:", { name: file.name, type: file.type, size: file.size });
    
    const fileType = file.name.toLowerCase().split(".").pop();
    const mimeType = file.type.toLowerCase();
    
    console.log("File type:", fileType, "MIME type:", mimeType);
    
    if (fileType === "svg" || mimeType === "image/svg+xml") {
        console.log("Processing as SVG");
        processSVGFile(file);
    } else if (fileType === "pdf" || mimeType === "application/pdf") {
        console.log("Processing as PDF");
        processPDFFile(file);
    } else if (fileType === "png" || fileType === "jpg" || fileType === "jpeg" || 
               mimeType.startsWith("image/")) {
        console.log("Processing as Image");
        processImageFile(file);
    } else {
        console.error("Unsupported file type:", fileType, mimeType);
        alert("Please upload a PNG, JPG, SVG, or PDF file from Canva.");
        return;
    }
}

function processSVGFile(file) {
    console.log("Processing SVG file:", file.name);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const svgContent = e.target.result;
            console.log("SVG loaded successfully");
            
            // Parse SVG for text elements
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            
            // Check for parsing errors
            const parseError = svgDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('Invalid SVG file');
            }
            
            // Extract text elements and find placeholders
            const textElements = svgDoc.querySelectorAll('text, tspan');
            const placeholderFields = [];
            const processedElements = [];
            
            // Process each text element
            textElements.forEach((element, index) => {
                const textContent = element.textContent || '';
                
                // Check for placeholder patterns like {{firstName}}, {{lastName}}, etc.
                const placeholderMatches = textContent.match(/\{\{([^}]+)\}\}/g);
                if (placeholderMatches) {
                    placeholderMatches.forEach(match => {
                        const fieldName = match.replace(/[{}]/g, '');
                        if (!placeholderFields.includes(fieldName)) {
                            placeholderFields.push(fieldName);
                        }
                    });
                }
                
                // Convert SVG element to template element
                const templateElement = {
                    type: 'text',
                    id: `canva_text_${index}`,
                    content: textContent,
                    x: 0.5, // Default positioning
                    y: 0.5 + (index * 0.5),
                    width: 3,
                    height: 0.4,
                    fontSize: 14,
                    color: '#000000',
                    align: 'left',
                    bold: false
                };
                
                processedElements.push(templateElement);
            });
            
            window.canvaImportData = {
                elements: processedElements,
                placeholders: placeholderFields,
                importType: "svg",
                fileName: file.name
            };
            
            const previewHtml = '<div class="text-center"><div class="bg-light p-3 border rounded"><i class="fas fa-file-code fa-3x text-primary mb-2"></i><div class="text-success"><i class="fas fa-check-circle"></i> SVG loaded successfully!</div><div class="mt-2">Found ' + placeholderFields.length + ' placeholder fields</div></div></div>';
            
            showCanvaPreview(previewHtml, placeholderFields.length);
            showFieldMapping(placeholderFields);
            document.getElementById("importCanvaDesign").disabled = false;
            console.log("SVG processed successfully");
            
        } catch (error) {
            console.error("Error processing SVG:", error);
            alert("Failed to process SVG file: " + error.message);
        }
    };
    
    reader.onerror = function(error) {
        console.error("FileReader error:", error);
        alert("Failed to read SVG file. Please try again.");
    };
    
    reader.readAsText(file);
}

function processImageFile(file) {
    console.log("Processing image file:", file.name);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imageData = e.target.result;
            console.log("Image loaded successfully");
            
            const elements = [{
                type: "background-image",
                content: imageData,
                imageData: imageData, // Also store in imageData field for compatibility
                x: 0, y: 0, width: 4, height: 6,
                zIndex: -1, isBackground: true
            }];
            
            window.canvaImportData = {
                elements: elements,
                placeholders: [],
                backgroundImage: imageData,
                importType: "image-background",
                fileName: file.name
            };
            
            const previewHtml = '<div class="text-center"><img src="' + imageData + '" style="max-width: 100%; max-height: 200px; border: 1px solid #ddd; border-radius: 4px;"><div class="mt-2 text-success"><i class="fas fa-check-circle"></i> Image loaded successfully!</div></div>';
            
            showCanvaPreview(previewHtml, 0);
            showFieldMapping([]);
            document.getElementById("importCanvaDesign").disabled = false;
            console.log("Image processed successfully");
            
        } catch (error) {
            console.error("Error processing image:", error);
            alert("Failed to process image file: " + error.message);
        }
    };
    
    reader.onerror = function(error) {
        console.error("FileReader error:", error);
        alert("Failed to read image file. Please try again.");
    };
    
    reader.readAsDataURL(file);
}

function processPDFFile(file) {
    console.log("Processing PDF file:", file.name);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const pdfData = e.target.result;
            console.log("PDF loaded successfully");
            
            const elements = [{
                type: "pdf-background",
                content: pdfData,
                imageData: pdfData, // Also store in imageData field for compatibility
                x: 0, y: 0, width: 4, height: 6,
                zIndex: -1, isBackground: true
            }];
            
            window.canvaImportData = {
                elements: elements,
                placeholders: [],
                backgroundPDF: pdfData,
                importType: "pdf-background",
                fileName: file.name
            };
            
            const previewHtml = '<div class="text-center p-3"><i class="fas fa-file-pdf fa-4x text-danger mb-3"></i><div class="text-success mb-2"><i class="fas fa-check-circle"></i> PDF loaded successfully!</div><div><strong>' + file.name + '</strong></div><small class="text-muted">PDF will be used as background.</small></div>';
            
            showCanvaPreview(previewHtml, 0);
            showFieldMapping([]);
            document.getElementById("importCanvaDesign").disabled = false;
            console.log("PDF processed successfully");
            
        } catch (error) {
            console.error("Error processing PDF:", error);
            alert("Failed to process PDF file: " + error.message);
        }
    };
    
    reader.readAsDataURL(file);
}

function showCanvaPreview(content, fieldCount) {
    const preview = document.getElementById("canvaPreview");
    if (preview) {
        preview.innerHTML = content;
    }
    
    const fieldInfo = document.querySelector("#canvaImportModal .field-count");
    if (fieldInfo) {
        fieldInfo.textContent = "Found " + fieldCount + " placeholder fields that will auto-populate with contact data.";
    }
}

function showFieldMapping(placeholders) {
    const mapping = document.getElementById("canvaFieldMapping");
    if (mapping) {
        if (placeholders.length === 0) {
            mapping.innerHTML = '<p class="text-muted">No placeholder fields found. You can add text fields manually in the designer after import.</p>';
        } else {
            const listItems = placeholders.map(p => '<li class="list-group-item">' + p.field + '</li>').join("");
            mapping.innerHTML = '<h6>Detected Fields:</h6><ul class="list-group">' + listItems + '</ul>';
        }
    }
}

function processCanvaImport() {
    console.log("Processing Canva import...");
    try {
        if (!window.canvaImportData) {
            alert("No design data found. Please upload a file first.");
            return;
        }
        
        const templateName = document.getElementById("canvaTemplateName").value.trim();
        if (!templateName) {
            alert("Please enter a template name.");
            return;
        }
        
        const template = {
            name: templateName,
            description: "Imported from Canva",
            config: {
                width: 4,
                height: 6,
                foldOver: true,
                elements: window.canvaImportData.elements
            }
        };
        
        console.log("Importing template:", template);
        
        fetch("/api/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(template)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert("Error: " + data.error);
            } else {
                alert("Template imported successfully!");
                const modal = bootstrap.Modal.getInstance(document.getElementById("canvaImportModal"));
                if (modal) modal.hide();
            }
        })
        .catch(error => {
            console.error("Error saving template:", error);
            alert("Failed to save template. Please try again.");
        });
        
    } catch (error) {
        console.error("Error processing import:", error);
        alert("Failed to process import. Please try again.");
    }
}

document.addEventListener("DOMContentLoaded", function() {
    console.log("Setting up Canva import");
    const importCanvaBtn = document.getElementById("importCanvaBtn");
    if (importCanvaBtn) {
        console.log("Found importCanvaBtn, adding listener");
        importCanvaBtn.addEventListener("click", showCanvaImport);
    } else {
        setTimeout(() => {
            const btn = document.getElementById("importCanvaBtn");
            if (btn) {
                btn.addEventListener("click", showCanvaImport);
            }
        }, 1000);
    }
});


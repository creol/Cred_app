// Global state
let currentEvent = null;
let currentContact = null;
let currentTemplate = null;
let searchTimeout = null;
let selectedElement = null;
let currentDesignerTemplate = null;
let isFoldPreviewActive = false; // Track fold preview state

// Make currentEvent available globally for other modules
window.currentEvent = currentEvent;

// Utility function to get current event (helpful for other modules)
window.getCurrentEvent = function() {
    return currentEvent;
};

// Simplified field mapping function - uses normalized field names only
window.mapFieldValue = function(fieldName, contactData) {
    if (!contactData) return null;
    
    console.log(`🔍 mapFieldValue: Looking for "${fieldName}" in contact data`);
    
    // 1. Try exact match first (should work for normalized fields)
    if (contactData[fieldName] !== undefined && contactData[fieldName] !== null && contactData[fieldName] !== '') {
        console.log(`✅ Found exact match: ${fieldName} = "${contactData[fieldName]}"`);
        return contactData[fieldName];
    }
    
    // 2. Try standard app fields only (not CSV-specific mappings)
    const standardMappings = {
        'firstName': contactData.firstName || contactData.first_name || '',
        'lastName': contactData.lastName || contactData.last_name || '',
        'first_name': contactData.first_name || contactData.firstName || '',
        'last_name': contactData.last_name || contactData.lastName || '',
        'middleName': contactData.middleName || contactData.middle_name || '',
        'middle_name': contactData.middle_name || contactData.middleName || '',
        'birthDate': contactData.birthDate || contactData.birth_date || '',
        'birth_date': contactData.birth_date || contactData.birthDate || '',
        'eventName': contactData.eventName || '',
        'eventDate': contactData.eventDate || ''
    };
    
    if (standardMappings[fieldName] !== undefined && standardMappings[fieldName] !== '') {
        console.log(`✅ Found standard mapping: ${fieldName} = "${standardMappings[fieldName]}"`);
        return standardMappings[fieldName];
    }
    
    // 3. Try custom fields (should contain normalized field names)
    if (contactData.custom_fields) {
        try {
            const customFields = typeof contactData.custom_fields === 'string' ? JSON.parse(contactData.custom_fields) : contactData.custom_fields;
            
            // Try exact match first
            if (customFields[fieldName] !== undefined && customFields[fieldName] !== null && customFields[fieldName] !== '') {
                console.log(`✅ Found in custom fields: ${fieldName} = "${customFields[fieldName]}"`);
                return customFields[fieldName];
            }
            
            // TEMPORARY: For legacy events, try uppercase version
            const uppercaseField = fieldName.toUpperCase();
            if (customFields[uppercaseField] !== undefined && customFields[uppercaseField] !== null && customFields[uppercaseField] !== '') {
                console.log(`✅ Found legacy uppercase field: ${fieldName} -> ${uppercaseField} = "${customFields[uppercaseField]}"`);
                return customFields[uppercaseField];
            }
        } catch (e) {
            console.warn('Failed to parse custom fields:', e);
        }
    }
    
    console.log(`❌ No value found for field: ${fieldName}`);
    return null;
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Make loadTemplates available globally for other modules after functions are defined
    window.loadTemplates = loadTemplates;
    
    loadEvents(); // This will call loadEventTemplate() when an event is loaded
    // Don't call loadTemplates() here - it will be called after events are loaded
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search input with debouncing
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchContacts();
        }, 250);
    });

    // Create Event button
    const createEventBtn = document.getElementById('createEventBtn');
    if (createEventBtn) {
        createEventBtn.addEventListener('click', createEvent);
    }

    // New Event button
    const newEventBtn = document.getElementById('newEventBtn');
    if (newEventBtn) {
        newEventBtn.addEventListener('click', showEventSetup);
    }

    // End Event button
    const endEventBtn = document.getElementById('endEventBtn');
    if (endEventBtn) {
        endEventBtn.addEventListener('click', endCurrentEvent);
    }

    // Reset Event button
    const resetEventBtn = document.getElementById('resetEventBtn');
    if (resetEventBtn) {
        resetEventBtn.addEventListener('click', () => {
            if (currentEvent) {
                resetEvent(currentEvent.id, currentEvent.name);
            }
        });
    }

    // Show Templates button
    const showTemplatesBtn = document.getElementById('showTemplatesBtn');
    if (showTemplatesBtn) {
        showTemplatesBtn.addEventListener('click', showTemplates);
    }

    // Export Data button
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportData);
    }

    // Print Stats button
    const printStatsBtn = document.getElementById('printStatsBtn');
    if (printStatsBtn) {
        printStatsBtn.addEventListener('click', printStats);
    }

    // Clear Search button
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }

    // Show Manual Add button
    const showManualAddBtn = document.getElementById('showManualAddBtn');
    if (showManualAddBtn) {
        showManualAddBtn.addEventListener('click', showManualAdd);
    }

    // Print Credential button
    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.addEventListener('click', printCredential);
    }

    // Un-Credential button
    const unCredentialBtn = document.getElementById('unCredentialBtn');
    if (unCredentialBtn) {
        unCredentialBtn.addEventListener('click', unCredential);
    }

    // Save Contact button
    const saveContactBtn = document.getElementById('saveContactBtn');
    if (saveContactBtn) {
        saveContactBtn.addEventListener('click', saveContact);
    }

    // Old designer buttons removed - all template creation now goes through Visual Designer
    
    // Settings button
    const showSettingsBtn = document.getElementById('showSettingsBtn');
    if (showSettingsBtn) {
        showSettingsBtn.addEventListener('click', showSettings);
    }

    // Save Settings button
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }

    // Visual Designer button
    const showVisualDesignerBtn = document.getElementById('showVisualDesignerBtn');
    console.log('🎯 Visual Designer button found:', !!showVisualDesignerBtn);
    if (showVisualDesignerBtn) {
        showVisualDesignerBtn.addEventListener('click', () => {
            console.log('🎯 Visual Designer button clicked!');
            const modal = new bootstrap.Modal(document.getElementById('visualDesignerModal'));
            
            // The visual designer initialization is handled in visual-designer.js
            // Just show the modal, the shown.bs.modal event will trigger initialization
            
            modal.show();
        });
    }

    // Import Template button
    const importTemplateBtn = document.getElementById('importTemplateBtn');
    if (importTemplateBtn) {
        importTemplateBtn.addEventListener('click', importTemplate);
    }

    // Import from Canva button
    const importCanvaBtn = document.getElementById('importCanvaBtn');
    if (importCanvaBtn) {
        importCanvaBtn.addEventListener('click', showCanvaImport);
    }

    // Download Fields button
    const downloadFieldsBtn = document.getElementById('downloadFieldsBtn');
    if (downloadFieldsBtn) {
        downloadFieldsBtn.addEventListener('click', downloadFieldsList);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === '/' && !e.target.matches('input, textarea')) {
            e.preventDefault();
            searchInput.focus();
        }
        if (e.key === 'Escape') {
            clearSearch();
        }
    });
}

// Load event template when event is loaded
async function loadEventTemplate() {
    if (!currentEvent) {
        console.log('loadEventTemplate: No current event');
        return;
    }
    
    console.log('loadEventTemplate: Loading template for event:', currentEvent.name, 'ID:', currentEvent.id);
    
    try {
        const response = await fetch(`/api/templates/event/${currentEvent.id}`);
        console.log('loadEventTemplate: Response status:', response.status);
        
        if (response.ok) {
            const templates = await response.json();
            console.log('loadEventTemplate: Found templates:', templates.length);
            console.log('loadEventTemplate: Template details:', templates);
            
            if (templates.length > 0) {
                // Set the event template as current template
                currentTemplate = templates[0];
                console.log('loadEventTemplate: Set event template:', currentTemplate.name, 'ID:', currentTemplate.id);
            } else {
                console.log('loadEventTemplate: No event-specific template, loading default');
                // No event-specific template found, try to load default template
                const defaultResponse = await fetch('/api/templates/default');
                if (defaultResponse.ok) {
                    currentTemplate = await defaultResponse.json();
                    console.log('loadEventTemplate: Loaded default template:', currentTemplate.name, 'ID:', currentTemplate.id);
                }
            }
        } else {
            const errorText = await response.text();
            console.error('loadEventTemplate: Failed to get event templates:', response.status, errorText);
        }
    } catch (error) {
        console.warn('loadEventTemplate: Failed to load event template:', error);
        // Fallback to default template
        try {
            const defaultResponse = await fetch('/api/templates/default');
            if (defaultResponse.ok) {
                currentTemplate = await defaultResponse.json();
                console.log('loadEventTemplate: Loaded default template as fallback:', currentTemplate.name, 'ID:', currentTemplate.id);
            }
        } catch (fallbackError) {
            console.warn('loadEventTemplate: Failed to load default template as fallback:', fallbackError);
        }
    }
    
    // Final check
    console.log('loadEventTemplate: Final currentTemplate:', currentTemplate ? currentTemplate.name : 'null', 'ID:', currentTemplate ? currentTemplate.id : 'null');
}

// Load sample contacts for CSV field dropdown
async function loadSampleContacts(eventId) {
    try {
        // Get a few sample contacts to populate CSV field options
        const response = await fetch(`/api/contacts/search/${eventId}?q=&limit=5`);
        if (response.ok) {
            const contacts = await response.json();
            window.currentEventContacts = contacts;
        }
    } catch (error) {
        console.warn('Failed to load sample contacts for CSV fields:', error);
    }
}

// Load events
async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        const events = await response.json();
        
        if (events.length > 0) {
            // Find the active event (only events with status 'active')
            const activeEvent = events.find(event => event.status === 'active');
            
            if (activeEvent) {
                // We have an active event
                currentEvent = activeEvent;
                window.currentEvent = currentEvent; // Update global reference
                updateEventDisplay();
                loadStatistics();
                
                // Load the event template first
                await loadEventTemplate();
                
                // Then load templates to update the display
                await loadTemplates();
                
                // Load sample contacts for CSV field dropdown
                loadSampleContacts(activeEvent.id);
                
                // Show event history for other events
                const otherEvents = events.filter(event => event.id !== activeEvent.id);
                if (otherEvents.length > 0) {
                    showEventHistory(events);
                } else {
                    // Hide event history section if no other events
                    const historySection = document.getElementById('eventHistorySection');
                    if (historySection) {
                        historySection.style.display = 'none';
                    }
                }
            } else {
                // No active events - show the most recent ended event as current
                const mostRecentEvent = events.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                currentEvent = mostRecentEvent;
                window.currentEvent = currentEvent; // Update global reference
                updateEventDisplay();
                // Don't load statistics for ended events - clear them instead
                clearStats();
                
                // Load the event template first
                await loadEventTemplate();
                
                // Then load templates to update the display
                await loadTemplates();
                
                // Always show event history when no active events
                showEventHistory(events);
            }
        } else {
            // No events - clear everything
            currentEvent = null;
            window.currentEvent = currentEvent; // Update global reference
            currentTemplate = null;
            updateEventDisplay();
            clearSearch();
            hideContactPanel();
            clearStats(); // Clear stats when no events exist
            
            // Load templates to select default template
            await loadTemplates();
            
            // Hide event history
            const historySection = document.getElementById('eventHistorySection');
            if (historySection) {
                historySection.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Failed to load events:', error);
    }
}

// Update event display
function updateEventDisplay() {
    const newEventBtn = document.getElementById('newEventBtn');
    const endEventBtn = document.getElementById('endEventBtn');
    const resetEventBtn = document.getElementById('resetEventBtn');
    
    if (currentEvent && currentEvent.status === 'active') {
        // Event is running - show End Event and Reset buttons
        document.getElementById('eventName').textContent = currentEvent.name;
        document.getElementById('eventDate').textContent = new Date(currentEvent.date).toLocaleDateString();
        newEventBtn.style.display = 'none';
        endEventBtn.style.display = 'block';
        resetEventBtn.style.display = 'block';
    } else if (currentEvent && currentEvent.status === 'ended') {
        // Event exists but is ended - show Resume Event button and New Event button
        document.getElementById('eventName').textContent = `${currentEvent.name} (Ended)`;
        document.getElementById('eventDate').textContent = new Date(currentEvent.date).toLocaleDateString();
        newEventBtn.innerHTML = '<i class="fas fa-plus"></i> New Event';
        newEventBtn.style.display = 'block';
        endEventBtn.style.display = 'none';
        resetEventBtn.style.display = 'none';
    } else {
        // No event - show New Event button
        document.getElementById('eventName').textContent = 'No Event Selected';
        document.getElementById('eventDate').textContent = '';
        newEventBtn.innerHTML = '<i class="fas fa-plus"></i> New Event';
        newEventBtn.style.display = 'block';
        endEventBtn.style.display = 'none';
        resetEventBtn.style.display = 'none';
    }
}

// Show event history
function showEventHistory(events) {
    const historySection = document.getElementById('eventHistorySection');
    const historyDiv = document.getElementById('eventHistory');
    
    // Always show event history if there are events
    if (events.length === 0) {
        historySection.style.display = 'none';
        return;
    }
    
    // If there's only one event and it's ended, show it in history
    if (events.length === 1 && events[0].status === 'ended') {
        const event = events[0];
        const historyHtml = `
            <div class="card mb-2">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${event.name} (Ended)</h6>
                            <small class="text-muted">${new Date(event.date).toLocaleDateString()}</small>
                        </div>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-outline-primary" onclick="resumeEvent('${event.id}')">
                                <i class="fas fa-play"></i> Resume
                            </button>
                            <button class="btn btn-sm btn-outline-warning" onclick="resetEvent('${event.id}', '${event.name}')">
                                <i class="fas fa-undo"></i> Reset
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteEvent('${event.id}', '${event.name}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        historyDiv.innerHTML = historyHtml;
        historySection.style.display = 'block';
        return;
    }
    
    // For multiple events, filter out the current event and show others
    const otherEvents = events.filter(event => event.id !== currentEvent.id);
    
    if (otherEvents.length === 0) {
        historySection.style.display = 'none';
        return;
    }
    
    const historyHtml = otherEvents.map(event => `
        <div class="card mb-2">
            <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${event.name}${event.status === 'ended' ? ' (Ended)' : ''}</h6>
                        <small class="text-muted">${new Date(event.date).toLocaleDateString()}</small>
                    </div>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" onclick="resumeEvent('${event.id}')">
                            <i class="fas fa-play"></i> Resume
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="resetEvent('${event.id}', '${event.name}')">
                            <i class="fas fa-undo"></i> Reset
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteEvent('${event.id}', '${event.name}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    historyDiv.innerHTML = historyHtml;
    historySection.style.display = 'block';
}

// End current event
async function endCurrentEvent() {
    if (!currentEvent) return;
    
    if (!confirm(`Are you sure you want to end the event "${currentEvent.name}"? You can resume it later.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/events/${currentEvent.id}/end`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ended' })
        });
        
        if (response.ok) {
            showSuccess('Event ended successfully!');
            
            // Reload events to get updated status and refresh the display
            await loadEvents();
            
            // Clear search and hide contact panel
            clearSearch();
            hideContactPanel();
            
            // Clear stats since the event is now ended
            clearStats();
        } else {
            const result = await response.json();
            showError(result.error || 'Failed to end event.');
        }
    } catch (error) {
        console.error('Failed to end event:', error);
        showError('Failed to end event. Please try again.');
    }
}

// Reset an event (clear all credentials but keep contacts)
async function resetEvent(eventId, eventName) {
    const confirmation = prompt(`To reset the event "${eventName}", please type RESET in all caps:`);
    
    if (confirmation !== 'RESET') {
        if (confirmation !== null) { // User didn't cancel
            showError('Reset cancelled. You must type RESET exactly.');
        }
        return;
    }
    
    if (!confirm(`Are you sure you want to reset the event "${eventName}"? This will keep all imported contacts but clear all credentials (un-credential everyone). This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/events/${eventId}/reset`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showSuccess(`Event "${eventName}" reset successfully!`);
            // Reload events to update the display
            await loadEvents();
            
            // If a contact is currently selected, refresh its display to show updated credential status
            if (currentContact) {
                await selectContact(currentContact.id);
            }
        } else {
            const result = await response.json();
            showError(result.error || 'Failed to reset event.');
        }
    } catch (error) {
        console.error('Failed to reset event:', error);
        showError('Failed to reset event. Please try again.');
    }
}

// Delete an event (requires typing DELETE)
async function deleteEvent(eventId, eventName) {
    const confirmation = prompt(`To delete the event "${eventName}", please type DELETE in all caps:`);
    
    if (confirmation !== 'DELETE') {
        if (confirmation !== null) { // User didn't cancel
            showError('Deletion cancelled. You must type DELETE exactly.');
        }
        return;
    }
    
    if (!confirm(`Are you absolutely sure you want to permanently delete "${eventName}"? This will remove all contacts, credentials, and data associated with this event. This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/events/${eventId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            const result = await response.json();
            let message = `Event "${eventName}" deleted successfully!`;
            if (result.warning) {
                message += `\n\n⚠️ Warning: ${result.warning}`;
            }
            showSuccess(message);
            // Reload events to update the display
            await loadEvents();
        } else {
            const result = await response.json();
            showError(result.error || 'Failed to delete event.');
        }
    } catch (error) {
        console.error('Failed to delete event:', error);
        showError('Failed to delete event. Please try again.');
    }
}

// Resume a previous event
async function resumeEvent(eventId) {
    try {
        const response = await fetch(`/api/events/${eventId}/resume`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' })
        });
        
        if (response.ok) {
            // Load the resumed event (this will handle setting the new active event)
            await loadEvents();
            showSuccess('Event resumed successfully!');
        } else {
            const result = await response.json();
            showError(result.error || 'Failed to resume event.');
        }
    } catch (error) {
        console.error('Failed to resume event:', error);
        showError('Failed to resume event. Please try again.');
    }
}

// Load statistics
async function loadStatistics() {
    if (!currentEvent) return;
    
    try {
        const response = await fetch(`/api/events/${currentEvent.id}/statistics`);
        const stats = await response.json();
        
        document.getElementById('totalContacts').textContent = stats.total_contacts || 0;
        document.getElementById('credentialedCount').textContent = stats.credentialed_count || 0;
        document.getElementById('percentage').textContent = `${stats.credentialed_percentage || 0}%`;
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
}

// Clear statistics display
function clearStats() {
    document.getElementById('totalContacts').textContent = '0';
    document.getElementById('credentialedCount').textContent = '0';
    document.getElementById('percentage').textContent = '0%';
}

// Search contacts
async function searchContacts() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!currentEvent || !query) {
        clearSearchResults();
        return;
    }
    
    try {
        const response = await fetch(`/api/contacts/search/${currentEvent.id}?q=${encodeURIComponent(query)}`);
        const contacts = await response.json();
        
        // Store contacts globally for CSV field dropdown
        window.currentEventContacts = contacts;
        
        displaySearchResults(contacts);
        showSearchResults(); // Show search results when performing new search
    } catch (error) {
        console.error('Search failed:', error);
        showError('Search failed. Please try again.');
    }
}

// Display search results
function displaySearchResults(contacts) {
    const resultsDiv = document.getElementById('searchResults');
    
    if (contacts.length === 0) {
        resultsDiv.innerHTML = `
            <div class="text-muted text-center p-4">
                <i class="fas fa-search fa-2x mb-3"></i>
                <p>No contacts found</p>
            </div>
        `;
        return;
    }
    
    const resultsHtml = contacts.map(contact => `
        <div class="card mb-2 contact-result" onclick="selectContact('${contact.id}')" style="cursor: pointer;">
            <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1">${contact.last_name}, ${contact.first_name}</h6>
                        <small class="text-muted">
                            ${contact.birth_date ? `DOB: ${contact.birth_date}` : ''}
                            ${contact.address ? ` • ${contact.address}` : ''}
                        </small>
                    </div>
                    <div>
                        ${contact.isCredentialed ? 
                            '<span class="credentialed-badge">Credentialed</span>' : 
                            '<span class="ready-badge">Ready</span>'
                        }
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    resultsDiv.innerHTML = resultsHtml;
}

// Clear search results
function clearSearchResults() {
    document.getElementById('searchResults').innerHTML = `
        <div class="text-muted text-center p-4">
            <i class="fas fa-search fa-2x mb-3"></i>
            <p>Start typing to search contacts...</p>
        </div>
    `;
}

// Hide search results (when contact is selected)
function hideSearchResults() {
    document.getElementById('searchResults').style.display = 'none';
}

// Show search results (when clearing search or after printing)
function showSearchResults() {
    document.getElementById('searchResults').style.display = 'block';
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    clearSearchResults();
    showSearchResults(); // Show search results again
    hideContactPanel();
}

// Select contact
async function selectContact(contactId) {
    try {
        const response = await fetch(`/api/contacts/${contactId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contact = await response.json();
        
        currentContact = contact;
        displayContact(contact);
        
        // No longer generating label preview here since we removed the preview section
        // Users can click "Detailed Preview" button instead
        
        // Hide search results when contact is selected
        hideSearchResults();
        
        // Focus search input for next search
        document.getElementById('searchInput').focus();
    } catch (error) {
        console.error('Failed to load contact:', error);
        showError(`Failed to load contact details: ${error.message}`);
    }
}

// Display contact
function displayContact(contact) {
    // Debug: Log the contact data to see what fields are available
    console.log('Displaying contact:', contact);
    console.log('Contact ZIP field:', contact.zip);
    console.log('Contact custom_fields:', contact.custom_fields);
    
    // Show contact panel
    document.getElementById('contactPanel').style.display = 'block';
    
    // Update contact name
    document.getElementById('contactName').textContent = `${contact.first_name} ${contact.last_name}`;
    
    // Update credential status
    const statusDiv = document.getElementById('credentialStatus');
    if (contact.isCredentialed) {
        statusDiv.innerHTML = '<span class="credentialed-badge">Credentialed</span>';
        document.getElementById('printBtn').style.display = 'none';
        document.getElementById('unCredentialBtn').style.display = 'block';
    } else {
        statusDiv.innerHTML = '<span class="ready-badge">Ready to Credential</span>';
        document.getElementById('printBtn').style.display = 'block';
        document.getElementById('unCredentialBtn').style.display = 'none';
    }
    
    // Fill standard form fields
    document.getElementById('firstName').value = contact.first_name || '';
    document.getElementById('lastName').value = contact.last_name || '';
    document.getElementById('birthDate').value = contact.birth_date || '';
    document.getElementById('phone').value = contact.phone || '';
    document.getElementById('address').value = contact.address || '';
    document.getElementById('city').value = contact.city || '';
    document.getElementById('state').value = contact.state || '';
    document.getElementById('zip').value = contact.zip || '';
    document.getElementById('email').value = contact.email || '';
    
    // Also try to load from custom fields if standard fields are empty
    if (contact.custom_fields) {
        try {
            const customFields = JSON.parse(contact.custom_fields);
            console.log('Custom fields for form:', customFields); // Debug log
            
            if (!contact.phone && customFields.phone) {
                document.getElementById('phone').value = customFields.phone;
            }
            if (!contact.phone && customFields['Phone']) {
                document.getElementById('phone').value = customFields['Phone'];
            }
            if (!contact.phone && customFields.mobile) {
                document.getElementById('phone').value = customFields.mobile;
            }
            if (!contact.phone && customFields['Mobile']) {
                document.getElementById('phone').value = customFields['Mobile'];
            }
            if (!contact.zip && customFields.zip) {
                document.getElementById('zip').value = customFields.zip;
            }
            if (!contact.zip && customFields['ZIP']) {
                document.getElementById('zip').value = customFields['ZIP'];
            }
            if (!contact.zip && customFields['Zip Code']) {
                document.getElementById('zip').value = customFields['Zip Code'];
            }
            if (!contact.zip && customFields['zip']) {
                document.getElementById('zip').value = customFields['zip'];
            }
            if (!contact.zip && customFields['Zip']) {
                document.getElementById('zip').value = customFields['Zip'];
            }
        } catch (e) {
            console.error('Failed to parse custom fields for form:', e);
        }
    }
    
    // Display all CSV fields including custom fields
    displayAllContactFields(contact);
    
    // No longer generating label preview here since we removed the preview section
    // Users can click "Detailed Preview" button instead
}

// Hide contact panel
function hideContactPanel() {
    document.getElementById('contactPanel').style.display = 'none';
    currentContact = null;
}

// Display all contact fields including custom fields from CSV
function displayAllContactFields(contact) {
    // Parse custom fields if they exist
    let allFields = {};
    
    // Add standard fields
    if (contact.first_name) allFields['First Name'] = contact.first_name;
    if (contact.last_name) allFields['Last Name'] = contact.last_name;
    if (contact.middle_name) allFields['Middle Name'] = contact.middle_name;
    if (contact.birth_date) allFields['Birth Date'] = contact.birth_date;
    if (contact.address) allFields['Address'] = contact.address;
    if (contact.city) allFields['City'] = contact.city;
    if (contact.state) allFields['State'] = contact.state;
    if (contact.zip) allFields['ZIP'] = contact.zip;
    if (contact.phone) allFields['Phone'] = contact.phone;
    if (contact.email) allFields['Email'] = contact.email;
    
    // Add custom fields from CSV
    if (contact.custom_fields) {
        try {
            const customFields = JSON.parse(contact.custom_fields);
            Object.assign(allFields, customFields);
        } catch (e) {
            console.error('Failed to parse custom fields:', e);
        }
    }
    
    // Create a comprehensive field display
    const fieldDisplay = document.createElement('div');
    fieldDisplay.className = 'all-fields-display mb-3 p-3 border rounded bg-light';
    fieldDisplay.innerHTML = '<h6 class="mb-3 text-primary">Contact Details</h6>';
    
    const fieldsList = document.createElement('div');
    fieldsList.className = 'row';
    
    Object.entries(allFields).forEach(([key, value]) => {
        if (value && value.toString().trim() !== '') {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'col-md-6 mb-2';
            fieldDiv.innerHTML = `
                <label class="form-label text-muted"><small>${key}</small></label>
                <input type="text" class="form-control form-control-sm" value="${value}" readonly>
            `;
            fieldsList.appendChild(fieldDiv);
        }
    });
    
    fieldDisplay.appendChild(fieldsList);
    
    // Remove existing fields display if it exists
    const existingAllFields = document.querySelector('.all-fields-display');
    if (existingAllFields) {
        existingAllFields.remove();
    }
    
    // Insert in the center area, right under the search results
    const searchResults = document.getElementById('searchResults');
    if (searchResults && searchResults.parentNode) {
        const centerArea = searchResults.parentNode;
        // Insert after the search results div
        centerArea.insertBefore(fieldDisplay, searchResults.nextSibling);
    }
}

// Generate label preview
async function generateLabelPreview(contact) {
    try {
        console.log('Generating label preview for contact:', contact);
        console.log('Current template:', currentTemplate);
        console.log('Current event:', currentEvent);
        
        // Load default template if not already loaded
        if (!currentTemplate) {
            console.log('No current template, trying to load default...');
            const response = await fetch('/api/templates/default');
            if (response.ok) {
                currentTemplate = await response.json();
                console.log('Loaded default template:', currentTemplate);
            } else {
                console.error('No default template available');
                displayLabelPreview({ preview: { elements: [] } });
                return;
            }
        }
        
        // Create preview data
        const previewData = {
            firstName: contact.first_name || '',
            lastName: contact.last_name || '',
            middleName: contact.middle_name || '',
            birthDate: contact.birth_date || '',
            address: contact.address || '',
            city: contact.city || '',
            state: contact.state || '',
            zip: contact.zip || '',
            phone: contact.phone || '',
            email: contact.email || '',
            eventName: currentEvent ? currentEvent.name : '',
            eventDate: currentEvent ? currentEvent.date : ''
        };
        
        // Add custom fields from CSV
        if (contact.custom_fields) {
            try {
                const customFields = JSON.parse(contact.custom_fields);
                Object.assign(previewData, customFields);
            } catch (e) {
                console.warn('Failed to parse custom fields for preview:', e);
            }
        }
        
        console.log('Preview data:', previewData);
        console.log('Calling preview endpoint for template:', currentTemplate.id);
        
        // Generate preview
        const response = await fetch(`/api/templates/${currentTemplate.id}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sampleData: previewData })
        });
        
        console.log('Preview response status:', response.status);
        
        if (response.ok) {
            const preview = await response.json();
            console.log('Preview response:', preview);
            displayLabelPreview(preview);
        } else {
            const errorText = await response.text();
            console.error('Template preview failed:', response.status, errorText);
            displayLabelPreview({ preview: { elements: [] } });
        }
    } catch (error) {
        console.error('Failed to generate preview:', error);
        // Don't fail the entire contact display if preview fails
        displayLabelPreview({ preview: { elements: [] } });
    }
}

// Display label preview
function displayLabelPreview(preview) {
    console.log('Displaying label preview:', preview);
    
    const previewDiv = document.getElementById('labelPreview');
    if (!previewDiv) {
        console.error('Preview div not found!');
        return;
    }
    
    if (preview.preview && preview.preview.elements) {
        console.log('Preview elements:', preview.preview.elements);
        let previewHtml = '<div class="text-center">';
        preview.preview.elements.forEach(element => {
            if (element.type === 'text') {
                const content = element.previewContent || element.content || '';
                previewHtml += `<div class="mb-1">${content}</div>`;
            } else if (element.type === 'checkbox') {
                previewHtml += `<div class="mb-1">
                    <input type="checkbox" ${element.checked ? 'checked' : ''} disabled>
                    <span>${element.label}</span>
                </div>`;
            } else if (element.type === 'image') {
                previewHtml += `<div class="mb-1">
                    <i class="fas fa-image"></i> [Image]
                </div>`;
            }
        });
        previewHtml += '</div>';
        
        // Add a button to show detailed PDF preview
        previewHtml += `
            <div class="mt-2">
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="showDetailedPreview()">
                    <i class="fas fa-eye"></i> Detailed Preview
                </button>
            </div>
        `;
        
        previewDiv.innerHTML = previewHtml;
        console.log('Preview HTML set successfully');
    } else {
        console.log('No preview data or elements found, showing fallback');
        previewDiv.innerHTML = '<small class="text-muted">Preview not available</small>';
    }
}

// Show detailed PDF preview for the current contact
async function showDetailedPreview() {
    if (!currentContact || !currentTemplate) {
        showError('No contact or template selected for preview');
        return;
    }
    
    console.log('=== Detailed Preview Debug ===');
    console.log('Current Contact:', currentContact);
    console.log('Current Template:', currentTemplate);
    console.log('Template Elements:', currentTemplate.config.elements);
    
    // Log the content of each text element to see what placeholders exist
    currentTemplate.config.elements.forEach((element, index) => {
        if (element.type === 'text') {
            console.log(`Element ${index} content: "${element.content}"`);
        }
    });
    
    // Create contact data for preview
    const contactData = {
        firstName: currentContact.first_name || '',
        lastName: currentContact.last_name || '',
        middleName: currentContact.middle_name || '',
        birthDate: currentContact.birth_date || '',
        address: currentContact.address || '',
        city: currentContact.city || '',
        state: currentContact.state || '',
        zip: currentContact.zip || '',
        phone: currentContact.phone || '',
        email: currentContact.email || '',
        eventName: currentEvent ? currentEvent.name : '',
        eventDate: currentEvent ? currentEvent.date : ''
    };
    
    // Add custom fields from CSV
    if (currentContact.custom_fields) {
        try {
            const customFields = JSON.parse(currentContact.custom_fields);
            Object.assign(contactData, customFields);
            console.log('🔍 Merged custom fields into contact data. Sample fields:', Object.keys(customFields).slice(0, 10));
        } catch (e) {
            console.warn('Failed to parse custom fields for detailed preview:', e);
        }
    }
    
    console.log('Final Contact Data for PDF:', contactData);
    
    // Generate PDF preview - use Visual Designer's own accurate method
    let pdfBlob;
    
    if (currentTemplate.category === 'Visual Designer' || 
        (currentTemplate.config && currentTemplate.config.designer === 'Visual Designer')) {
        console.log('Using Visual Designer for preview with real contact data');
        
        // Ensure Visual Designer instance exists and has the template loaded
        if (!window.visualDesigner) {
            console.log('Creating Visual Designer instance for preview');
            window.visualDesigner = new VisualDesigner();
            await window.visualDesigner.init();
        }
        
        // Load the template if needed
        if (!window.visualDesigner.fields.length) {
            console.log('Loading template into Visual Designer for preview');
            await window.visualDesigner.loadTemplate(currentTemplate);
        }
        
        // Use Visual Designer's own accurate PDF generation
        const pdfDoc = await window.visualDesigner.generatePDF(contactData);
        
        // Convert PDF document to blob
        if (pdfDoc) {
            pdfBlob = pdfDoc.output('blob');
        } else {
            console.warn('Visual Designer PDF generation failed for preview');
            showError('Failed to generate PDF preview using Visual Designer');
            return;
        }
    } else {
        console.log('Using legacy PDF generation');
        // Use legacy PDF generation for older templates
        pdfBlob = generatePdf(currentTemplate, contactData);
    }
    
    if (!pdfBlob) {
        showError('Failed to generate PDF preview');
        return;
    }
    
    // Show PDF preview modal
    const modal = new bootstrap.Modal(document.getElementById('pdfPreviewModal'));
    modal.show();
    
    // Display the PDF
    displayPdfPreview(pdfBlob);
    
    // Setup PDF modal buttons
    setupPdfModalButtons();
    
    // Update modal title
    document.querySelector('#pdfPreviewModal .modal-title').textContent = 'Label Preview';
}

// Print credential
async function printCredential() {
    if (!currentContact || !currentEvent || !currentTemplate) {
        showError('Missing required data for printing.');
        return;
    }
    
    try {
        // Get form data
        const formData = new FormData(document.getElementById('contactForm'));
        const contactData = Object.fromEntries(formData.entries());
        
        // Create contact data object for merging
        const mergedContactData = {
            firstName: contactData.firstName || currentContact.first_name || '',
            lastName: contactData.lastName || currentContact.last_name || '',
            middleName: contactData.middleName || currentContact.middle_name || '',
            birthDate: contactData.birthDate || currentContact.birth_date || '',
            address: contactData.address || currentContact.address || '',
            city: contactData.city || currentContact.city || '',
            state: contactData.state || currentContact.state || '',
            zip: contactData.zip || currentContact.zip || '',
            phone: contactData.phone || currentContact.phone || '',
            email: contactData.email || currentContact.email || '',
            eventName: currentEvent.name || '',
            eventDate: currentEvent.date || ''
        };
        
        // Add custom fields from CSV
        if (currentContact.custom_fields) {
            try {
                const customFields = JSON.parse(currentContact.custom_fields);
                Object.assign(mergedContactData, customFields);
                console.log('Added custom fields to PDF data:', customFields);
            } catch (e) {
                console.warn('Failed to parse custom fields for printing:', e);
            }
        }
        
        console.log('Final PDF Contact Data:', mergedContactData);
        
        let pdfBlob;
        
        // Check if using DOCX template
        if (window.docxManager && window.docxManager.currentTemplate && currentTemplate.type === 'docx') {
            // Use DOCX template system
            pdfBlob = await window.docxManager.generatePdfForContact({
                ...currentContact,
                first_name: mergedContactData.firstName,
                last_name: mergedContactData.lastName,
                middle_name: mergedContactData.middleName,
                birth_date: mergedContactData.birthDate,
                address: mergedContactData.address,
                city: mergedContactData.city,
                state: mergedContactData.state,
                zip: mergedContactData.zip,
                phone: mergedContactData.phone,
                email: mergedContactData.email
            });
        } else {
            // Check if it's a Visual Designer template
            if (currentTemplate.category === 'Visual Designer' || 
                (currentTemplate.config && currentTemplate.config.designer === 'Visual Designer')) {
                console.log('Using Visual Designer for printing with real contact data');
                
                // Ensure Visual Designer instance exists and has the template loaded
                if (!window.visualDesigner) {
                    console.log('Creating Visual Designer instance for printing');
                    window.visualDesigner = new VisualDesigner();
                    await window.visualDesigner.init();
                }
                
                // Load the template if needed
                if (!window.visualDesigner.fields.length) {
                    console.log('Loading template into Visual Designer for printing');
                    await window.visualDesigner.loadTemplate(currentTemplate);
                }
                
                // Use Visual Designer's own accurate PDF generation with real contact data
                const pdfDoc = await window.visualDesigner.generatePDF(mergedContactData);
                
                // Convert PDF document to blob
                if (pdfDoc) {
                    pdfBlob = pdfDoc.output('blob');
                } else {
                    console.warn('Visual Designer PDF generation failed for printing');
                    showError('Failed to generate PDF using Visual Designer');
                    return;
                }
            } else {
                console.log('Using legacy PDF generation for printing');
                // Use traditional template system for legacy templates
                pdfBlob = generatePdf(currentTemplate, mergedContactData);
            }
        }
        
        if (!pdfBlob) {
            showError('Failed to generate PDF for printing');
            return;
        }
        
        // SumatraPDF auto-print method
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Send PDF to backend for SumatraPDF printing
        const printFormData = new FormData();
        printFormData.append('pdf', pdfBlob, 'credential.pdf');
        printFormData.append('printer', 'RX106HD');
        
        try {
                            const response = await fetch('/api/printing/print-sumatra', {
                method: 'POST',
                body: printFormData
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('SumatraPDF print successful');
                    showSuccess('Credential printed successfully via SumatraPDF!');
                } else {
                    throw new Error(result.error || 'SumatraPDF print failed');
                }
            } else {
                throw new Error('Failed to send PDF to backend');
            }
        } catch (error) {
            console.error('SumatraPDF print error:', error);
            showError('SumatraPDF printing failed. Please check if SumatraPDF is installed and RX106HD printer is configured.');
        }
        
        // Mark as credentialed in the database
        await markContactAsCredentialed();
        
        // Show success message
        showSuccess('Credential printed successfully!');
        
    } catch (error) {
        console.error('Printing failed:', error);
        showError('Printing failed. Please try again.');
    }
}

// Show PDF preview for printing credentials
function showPdfPreviewForPrinting(pdfBlob, templateName) {
    // Show the PDF preview modal
    const modal = new bootstrap.Modal(document.getElementById('pdfPreviewModal'));
    modal.show();
    
    // Display the PDF
    displayPdfPreview(pdfBlob);
    
    // Setup PDF modal buttons
    setupPdfModalButtons();
    
    // Update modal title
    document.querySelector('#pdfPreviewModal .modal-title').textContent = 'Print Credential';
    
    // Show success message
    showSuccess('Credential generated successfully! You can now print or download.');
}

// Mark contact as credentialed in the database
async function markContactAsCredentialed() {
    try {
        const response = await fetch('/api/printing/print-credential', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contactId: currentContact.id,
                eventId: currentEvent.id,
                templateId: currentTemplate.id,
                contactData: {}
            })
        });
        
        if (response.ok) {
            // Update contact status locally
            currentContact.isCredentialed = true;
            displayContact(currentContact);
            
            // Refresh statistics
            loadStatistics();
        } else {
            console.warn('Failed to mark contact as credentialed in database');
        }
    } catch (error) {
        console.warn('Failed to mark contact as credentialed:', error);
    }
}

// Un-credential contact
async function unCredential() {
    if (!currentContact || !currentEvent) {
        showError('Missing required data.');
        return;
    }
    
    if (!confirm('Are you sure you want to un-credential this contact?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/printing/un-credential', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contactId: currentContact.id,
                eventId: currentEvent.id,
                reason: 'Manually revoked'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('Credential revoked successfully!');
            
            // Update contact status
            currentContact.isCredentialed = false;
            displayContact(currentContact);
            
            // Refresh statistics
            loadStatistics();
        } else {
            showError(result.error || 'Failed to revoke credential.');
        }
    } catch (error) {
        console.error('Failed to un-credential:', error);
        showError('Failed to revoke credential. Please try again.');
    }
}

// Save contact changes
async function saveContact() {
    try {
        const formData = new FormData(document.getElementById('contactForm'));
        const contactData = Object.fromEntries(formData.entries());
        
        let response;
        
        if (currentContact && currentContact.id && !currentContact.id.startsWith('new-contact-')) {
            // Update existing contact
            response = await fetch(`/api/contacts/${currentContact.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contactData)
            });
            
            if (response.ok) {
                showSuccess('Contact updated successfully!');
                // Refresh contact data
                await selectContact(currentContact.id);
            } else {
                const result = await response.json();
                showError(result.error || 'Failed to update contact.');
            }
        } else {
            // Create new contact
            if (!currentEvent) {
                showError('Please select an event first.');
                return;
            }
            
            // Add event ID to contact data
            contactData.event_id = currentEvent.id;
            
            response = await fetch(`/api/contacts/${currentEvent.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contactData)
            });
            
            if (response.ok) {
                const newContact = await response.json();
                showSuccess('Contact added successfully!');
                
                // Set the new contact as current and refresh display
                currentContact = newContact;
                displayContact(newContact);
                
                // Show credential button for the new contact
                document.getElementById('printBtn').style.display = 'block';
                document.getElementById('unCredentialBtn').style.display = 'none';
                
                // Refresh statistics
                loadStatistics();
                
                // Refresh search results to include the new contact
                if (window.currentEventContacts) {
                    window.currentEventContacts.push(newContact);
                }
            } else {
                const result = await response.json();
                showError(result.error || 'Failed to add contact.');
            }
        }
    } catch (error) {
        console.error('Failed to save contact:', error);
        showError('Failed to save contact. Please try again.');
    }
}

// Show event setup modal
function showEventSetup() {
    const modal = new bootstrap.Modal(document.getElementById('eventModal'));
    modal.show();
}

// Create event
async function createEvent() {
    const name = document.getElementById('modalEventName').value.trim();
    const date = document.getElementById('modalEventDate').value;
    const description = document.getElementById('modalEventDescription').value.trim();
    const csvFile = document.getElementById('csvFile').files[0];
    
    if (!name || !date) {
        showError('Event name and date are required.');
        return;
    }
    
    try {
        // Create event
        const eventResponse = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, date, description })
        });
        
        if (!eventResponse.ok) {
            const result = await eventResponse.json();
            throw new Error(result.error || 'Failed to create event.');
        }
        
        const event = await eventResponse.json();
        currentEvent = event;
        window.currentEvent = currentEvent; // Update global reference
        
        // Import CSV if provided
        if (csvFile) {
            await importCSV(event.id, csvFile);
        }
        
        // Update display
        updateEventDisplay();
        loadStatistics();
        
        // Refresh event history if there are multiple events
        const eventsResponse = await fetch('/api/events');
        const allEvents = await eventsResponse.json();
        if (allEvents.length > 1) {
            showEventHistory(allEvents);
        }
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
        
        showSuccess('Event created successfully!');
        
        // Clear form
        document.getElementById('eventForm').reset();
        
    } catch (error) {
        console.error('Failed to create event:', error);
        showError(error.message || 'Failed to create event.');
    }
}

// Refresh available fields in all components after CSV import
async function refreshAvailableFields() {
    console.log('🔄 Refreshing available fields after CSV import...');
    
    // Refresh Visual Designer fields if instance exists
    if (window.visualDesigner) {
        console.log('📝 Refreshing Visual Designer fields...');
        await window.visualDesigner.loadAvailableFields();
        window.visualDesigner.updateFieldSelector();
    }
    
    // Refresh Modern Label Designer fields if instance exists
    if (window.modernLabelDesigner) {
        console.log('🎨 Refreshing Modern Label Designer fields...');
        await window.modernLabelDesigner.loadAvailableFields();
    }
    
    // Notify user that fields have been updated
    showSuccess('Available fields updated with new CSV data!');
    
    console.log('✅ Field refresh complete');
}

// Import CSV
async function importCSV(eventId, file) {
    const formData = new FormData();
    formData.append('csvFile', file);
    
    try {
        const response = await fetch(`/api/events/${eventId}/import-csv`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess(`CSV imported successfully! ${result.contactCount} contacts loaded.`);
            
            // Refresh available fields in all components that use them
            await refreshAvailableFields();
        } else {
            throw new Error(result.error || 'CSV import failed.');
        }
    } catch (error) {
        console.error('CSV import failed:', error);
        showError(error.message || 'CSV import failed.');
    }
}

// Show templates modal
function showTemplates() {
    const modal = new bootstrap.Modal(document.getElementById('templatesModal'));
    loadTemplates();
    modal.show();
}

// Select a template for printing
async function selectTemplate(templateId) {
    try {
        const response = await fetch(`/api/templates/${templateId}`);
        if (response.ok) {
            const template = await response.json();
            currentTemplate = template;
            
            // Associate the selected template with the current event (creates a new event-specific template)
            if (currentEvent) {
                try {
                    const saveResponse = await fetch(`/api/templates/event/${currentEvent.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            template_id: template.id 
                        })
                    });
                    
                    if (saveResponse.ok) {
                        const result = await saveResponse.json();
                        // Update currentTemplate to the new event-specific template
                        currentTemplate = result.template;
                        console.log('Template associated with event successfully:', currentTemplate.name);
                        showSuccess(`Template "${template.name}" selected for event!`);
                    } else {
                        console.warn('Failed to associate template with event');
                        showSuccess(`Template "${template.name}" selected!`);
                    }
                } catch (e) {
                    console.warn('Failed to associate template with event:', e);
                    showSuccess(`Template "${template.name}" selected!`);
                }
            } else {
                showSuccess(`Template "${template.name}" selected successfully!`);
            }
            
            // Close the templates modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('templatesModal'));
            if (modal) {
                modal.hide();
            }
            
            // If a contact is currently selected, refresh the label preview with the new template
            if (currentContact) {
                await generateLabelPreview(currentContact);
            }
            
            // Reload templates to update the display
            await loadTemplates();
            
            // Close the modal after everything is loaded
            setTimeout(() => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('templatesModal'));
                if (modal) {
                    modal.hide();
                }
            }, 1000);
        } else {
            showError('Failed to load template.');
        }
    } catch (error) {
        console.error('Failed to select template:', error);
        showError('Failed to select template.');
    }
}

// Load templates
async function loadTemplates() {
    try {
        console.log('loadTemplates: Starting, currentTemplate:', currentTemplate ? currentTemplate.name : 'null', 'ID:', currentTemplate ? currentTemplate.id : 'null');
        console.log('loadTemplates: currentEvent:', currentEvent ? currentEvent.name : 'null', 'ID:', currentEvent ? currentEvent.id : 'null');
        
        const response = await fetch('/api/templates');
        const templates = await response.json();
        console.log('loadTemplates: Found', templates.length, 'templates');
        console.log('loadTemplates: Template IDs:', templates.map(t => ({ id: t.id, name: t.name, event_id: t.event_id })));
        
        const templatesList = document.getElementById('templatesList');
        if (templatesList) {
            let html = '';
            
            // First, show the current event template at the top if it exists
            if (currentTemplate && currentTemplate.event_id) {
                html += `
                    <div class="template-item current-event-template" data-template-id="${currentTemplate.id}">
                        <div class="template-info">
                            <h6 class="mb-1">
                                <span class="badge bg-success me-2">Active</span>
                                ${currentTemplate.name}
                            </h6>
                            <p class="text-muted mb-2">${currentTemplate.description}</p>
                            <small class="text-muted">Event-specific template (read-only)</small>
                        </div>
                        <div class="template-actions">
                            <button class="btn btn-sm btn-outline-primary" onclick="selectTemplate('${currentTemplate.id}')" disabled>
                                Selected
                            </button>
                        </div>
                    </div>
                    <hr class="my-3">
                `;
            }
            
            // Then show all other templates
            templates.forEach(template => {
                // Skip the current event template since we already displayed it at the top
                if (currentTemplate && currentTemplate.event_id && template.id === currentTemplate.id) {
                    return;
                }
                
                const isSelected = currentTemplate && currentTemplate.id === template.id;
                const isEventTemplate = template.event_id;
                
                // Check if this is a Visual Designer template
                // Visual Designer templates have config.elements array with proper structure
                const isVisualDesignerTemplate = template.config && 
                    template.config.elements && 
                    Array.isArray(template.config.elements) &&
                    template.config.width && 
                    template.config.height;
                
                html += `
                    <div class="template-item ${isSelected ? 'selected' : ''}" data-template-id="${template.id}">
                        <div class="template-info">
                            <h6 class="mb-1">
                                ${template.name}
                                ${isEventTemplate ? '<span class="badge bg-info ms-2">Event</span>' : ''}
                                ${isVisualDesignerTemplate ? '<span class="badge bg-success ms-2">Visual Designer</span>' : '<span class="badge bg-warning ms-2">Legacy</span>'}
                            </h6>
                            <p class="text-muted mb-2">${template.description}</p>
                            <small class="text-muted">
                                ${isEventTemplate ? 'Event-specific template' : isVisualDesignerTemplate ? 'Visual Designer template' : 'Legacy template (view only)'}
                            </small>
                        </div>
                        <div class="template-actions">
                            <button class="btn btn-sm btn-primary" onclick="selectTemplate('${template.id}')">
                                ${isSelected ? 'Selected' : 'Select'}
                            </button>
                            ${!isEventTemplate ? `
                                <button class="btn btn-sm btn-outline-secondary" onclick="editTemplate('${template.id}')">
                                    ${isVisualDesignerTemplate ? 'Edit' : 'View/Create New'}
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate('${template.id}')">
                                    Delete
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-outline-info" onclick="exportTemplateById('${template.id}')" title="Export Template">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            templatesList.innerHTML = html;
        }
        
        // Only auto-select default template if no event template is loaded
        // Don't override the event template that was loaded in loadEventTemplate()
        if (!currentTemplate && templates.length > 0 && !currentEvent) {
            const defaultTemplate = templates.find(t => t.is_default) || templates[0];
            currentTemplate = defaultTemplate;
            console.log('loadTemplates: Auto-selected default template:', defaultTemplate.name, 'ID:', defaultTemplate.id);
        } else if (currentTemplate) {
            console.log('loadTemplates: Template already selected, not overriding:', currentTemplate.name, 'ID:', currentTemplate.id, 'Event:', currentEvent ? currentEvent.name : 'none');
        } else if (currentEvent) {
            console.log('loadTemplates: Event loaded but no template found, will be loaded by loadEventTemplate');
        }
        
        console.log('loadTemplates: Final currentTemplate:', currentTemplate ? currentTemplate.name : 'null', 'ID:', currentTemplate ? currentTemplate.id : 'null');
        
    } catch (error) {
        console.error('Failed to load templates:', error);
        showError('Failed to load templates.');
    }
}

// Export data
async function exportData() {
    if (!currentEvent) {
        showError('Please select an event first.');
        return;
    }
    
    try {
        const response = await fetch('/api/exports/export-credentialed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: currentEvent.id })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Download the file
            const downloadResponse = await fetch(`/api/exports/download/${result.exportId}`);
            const blob = await downloadResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showSuccess('Export completed successfully!');
        } else {
            throw new Error(result.error || 'Export failed.');
        }
    } catch (error) {
        console.error('Export failed:', error);
        showError(error.message || 'Export failed.');
    }
}

// Print statistics
async function printStats() {
    if (!currentEvent || !currentTemplate) {
        showError('Please select an event and template first.');
        return;
    }
    
    try {
        const response = await fetch('/api/exports/print-statistics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventId: currentEvent.id,
                templateId: currentTemplate.id
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('Statistics label printed successfully!');
        } else {
            throw new Error(result.error || 'Failed to print statistics.');
        }
    } catch (error) {
        console.error('Failed to print statistics:', error);
        showError(error.message || 'Failed to print statistics.');
    }
}

// Show manual add form
function showManualAdd() {
    if (!currentEvent) {
        showError('Please select an event first.');
        return;
    }
    
    // Clear form
    document.getElementById('contactForm').reset();
    
    // Show contact panel
    document.getElementById('contactPanel').style.display = 'block';
    
    // Update display
    document.getElementById('contactName').textContent = 'New Contact';
    document.getElementById('credentialStatus').innerHTML = '<span class="ready-badge">Ready to Add</span>';
    document.getElementById('printBtn').style.display = 'none';
    document.getElementById('unCredentialBtn').style.display = 'none';
    
    // Clear current contact
    currentContact = null;
    
    // Focus first name field
    document.getElementById('firstName').focus();
}

// Utility functions
function showSuccess(message) {
    // Create a non-blocking success notification
    const toast = document.createElement('div');
    toast.className = 'position-fixed top-0 end-0 p-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="toast align-items-center text-white bg-success border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-check-circle me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Initialize and show the toast
    const toastElement = toast.querySelector('.toast');
    const bsToast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 3000
    });
    bsToast.show();
    
    // Remove the toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toast);
    });
}

function showError(message) {
    // Create a non-blocking error notification
    const toast = document.createElement('div');
    toast.className = 'position-fixed top-0 end-0 p-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="toast align-items-center text-white bg-danger border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-exclamation-circle me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Initialize and show the toast
    const toastElement = toast.querySelector('.toast');
    const bsToast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 5000
    });
    bsToast.show();
    
    // Remove the toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        document.body.removeChild(toast);
    });
}

// Template management functions
function showTemplateEditor() {
    // Initialize with default template
    loadDefaultTemplate();
    
    // Show the label designer modal
    const modal = new bootstrap.Modal(document.getElementById('labelDesignerModal'));
    modal.show();
    
    // Wait for modal to be shown before setting up
    modal._element.addEventListener('shown.bs.modal', () => {
        // Setup canvas event listeners (only once)
        setupCanvasEventListeners();
        
        // Setup tool buttons (only once)
        setupToolButtons();
        
        // Ensure fold line and half labels are visible
        ensureFoldLineVisible();
    }, { once: true });
}

async function editTemplate(templateId) {
    try {
        console.log('🎯 editTemplate called for ID:', templateId);
        
        // Load the specific template
        const response = await fetch(`/api/templates/${templateId}`);
        if (response.ok) {
            const template = await response.json();
            console.log('📋 Loaded template for editing:', template);
            
            // Check if this is a Visual Designer template or legacy template
            // Visual Designer templates have config.elements array with proper structure
            const isVisualDesignerTemplate = template.config && 
                template.config.elements && 
                Array.isArray(template.config.elements) &&
                template.config.width && 
                template.config.height;
            
            if (!isVisualDesignerTemplate) {
                // Legacy template - offer to create new one
                const result = confirm(
                    `"${template.name}" is a legacy template that cannot be edited.\n\n` +
                    `Would you like to create a new template using the Visual Designer instead?\n\n` +
                    `Click OK to create a new template, or Cancel to go back.`
                );
                
                if (result) {
                    // Open Visual Designer for new template
                    const modal = new bootstrap.Modal(document.getElementById('visualDesignerModal'));
                    modal.show();
                    showSuccess('Visual Designer opened. Create your new template here!');
                }
                return;
            }
            
            // Visual Designer template - load it
            const modal = new bootstrap.Modal(document.getElementById('visualDesignerModal'));
            modal.show();
            
            // Wait for modal to be shown before loading template
            modal._element.addEventListener('shown.bs.modal', () => {
                console.log('🎯 Visual Designer modal shown, loading template...');
                
                // Wait for the visual-designer.js to initialize the instance
                setTimeout(() => {
                    if (!window.visualDesigner) {
                        console.log('🎯 Creating Visual Designer instance...');
                        window.visualDesigner = new VisualDesigner();
                    }
                    
                    // Load the template into Visual Designer
                    console.log('🎯 Loading template into existing Visual Designer instance');
                    window.visualDesigner.loadTemplate(template);
                    showSuccess(`Template "${template.name}" loaded for editing in Visual Designer.`);
                }, 300); // Longer delay to ensure visual-designer.js runs first
                
            }, { once: true });
        } else {
            showError('Failed to load template for editing.');
        }
    } catch (error) {
        console.error('Failed to load template:', error);
        showError('Failed to load template for editing.');
    }
}

async function deleteTemplate(templateId) {
    if (!confirm('Are you sure you want to delete this template?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/templates/${templateId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccess('Template deleted successfully!');
            // Reload templates to update the display
            loadTemplates();
        } else {
            const result = await response.json();
            showError(result.error || 'Failed to delete template.');
        }
    } catch (error) {
        console.error('Failed to delete template:', error);
        showError('Failed to delete template. Please try again.');
    }
}

function importTemplate() {
    // Create a file input for template import
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const template = JSON.parse(text);
            
            // Validate template structure
            if (!template.name || !template.config || !template.config.elements) {
                throw new Error('Invalid template format');
            }
            
            // Set as current template for editing
            currentDesignerTemplate = template;
            
            // Show the label designer modal
            const modal = new bootstrap.Modal(document.getElementById('labelDesignerModal'));
            modal.show();
            
            // Wait for modal to be shown before setting up
            modal._element.addEventListener('shown.bs.modal', () => {
                // Render the template
                renderCanvas();
                updateTemplateInfo();
                
                // Setup canvas event listeners (only once)
                setupCanvasEventListeners();
                
                // Setup tool buttons (only once)
                setupToolButtons();
                
                // Ensure fold line and half labels are visible
                ensureFoldLineVisible();
                
                showSuccess('Template imported successfully! You can now edit and save it.');
            }, { once: true });
            
        } catch (error) {
            console.error('Failed to import template:', error);
            showError('Failed to import template. Please check the file format.');
        }
    };
    
    fileInput.click();
}

// Label Designer functionality
let canvasElements = [];

function showLabelDesigner() {
    // Initialize with default template or current event template
    if (currentEvent && currentTemplate) {
        // Use the current event template
        currentDesignerTemplate = { ...currentTemplate };
    } else {
        loadDefaultTemplate();
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('labelDesignerModal'));
    modal.show();
    
    // Wait for modal to be shown before setting up event listeners
    modal._element.addEventListener('shown.bs.modal', () => {
        // Setup canvas event listeners (only once)
        setupCanvasEventListeners();
        
        // Setup tool buttons (only once)
        setupToolButtons();
        
        // Ensure fold line and half labels are visible
        ensureFoldLineVisible();
        
        // Update template info if we have a template
        if (currentDesignerTemplate) {
            updateTemplateInfo();
            renderCanvas();
        }
    }, { once: true });
}

function showModernDesigner() {
    // Show the modern designer modal
    const modal = new bootstrap.Modal(document.getElementById('modernDesignerModal'));
    modal.show();
    
    // Wait for modal to be shown before initializing
    modal._element.addEventListener('shown.bs.modal', () => {
        // Initialize modern designer if not already done
        if (!window.modernDesigner) {
            window.modernDesigner = new ModernLabelDesigner();
        } else {
            // Refresh available fields if designer already exists
            window.modernDesigner.loadAvailableFields();
        }
    }, { once: true });
}

function ensureFoldLineVisible() {
    // Make sure the fold line and half labels are visible
    const foldLine = document.querySelector('.fold-line');
    const topHalf = document.querySelector('.top-half');
    const bottomHalf = document.querySelector('.bottom-half');
    
    if (foldLine) foldLine.style.display = 'block';
    if (topHalf) topHalf.style.display = 'block';
    if (bottomHalf) bottomHalf.style.display = 'block';
}

function loadDefaultTemplate() {
    currentDesignerTemplate = {
        name: 'Hello My Name Is',
        description: 'Standard 4x6 fold-over name badge template',
        config: {
            width: 4,
            height: 6,
            foldOver: true,
            backgroundPdf: null, // PDF background data (base64)
            elements: [
                {
                    type: 'text',
                    id: 'hello',
                    x: 0.5,
                    y: 0.5,
                    width: 3,
                    height: 0.6,
                    content: 'Hello, My Name Is',
                    fontSize: 18,
                    bold: true,
                    align: 'center',
                    color: '#333333'
                },
                {
                    type: 'text',
                    id: 'name',
                    x: 0.5,
                    y: 1.2,
                    width: 3,
                    height: 1,
                    content: '{{firstName}} {{lastName}}',
                    fontSize: 28,
                    bold: true,
                    align: 'center',
                    color: '#000000'
                },

                {
                    type: 'text',
                    id: 'event',
                    x: 0.5,
                    y: 3.1,
                    width: 3,
                    height: 0.5,
                    content: '{{eventName}}',
                    fontSize: 14,
                    align: 'center',
                    color: '#888888'
                },
                {
                    type: 'text',
                    id: 'date',
                    x: 0.5,
                    y: 3.7,
                    width: 3,
                    height: 0.4,
                    content: '{{eventDate}}',
                    fontSize: 12,
                    align: 'center',
                    color: '#888888'
                },
                {
                    type: 'checkbox',
                    id: 'credential',
                    x: 1.5,
                    y: 4.5,
                    width: 0.3,
                    height: 0.3,
                    label: 'Credentialed',
                    color: '#28a745'
                }
            ]
        }
    };
    
    renderCanvas();
    updateTemplateInfo();
    updatePdfBackgroundButtons();
}



function renderCanvas(isFoldPreview = false) {
    const canvas = document.getElementById('labelCanvas');
    canvas.innerHTML = '';
    
    // Add PDF background if present
    if (currentDesignerTemplate && currentDesignerTemplate.config.backgroundPdf) {
        const pdfBackground = document.createElement('div');
        pdfBackground.className = 'pdf-background';
        pdfBackground.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: url(${currentDesignerTemplate.config.backgroundPdf});
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            opacity: 0.8;
            z-index: 1;
            pointer-events: none;
        `;
        canvas.appendChild(pdfBackground);
    }
    
    // Always add the fold line and half labels first
    const foldLine = document.createElement('div');
    foldLine.className = 'fold-line';
    foldLine.style.zIndex = '1000';
    foldLine.innerHTML = '<span style="position: absolute; right: 10px; top: -10px; background: #ff6b6b; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold;">FOLD</span>';
    canvas.appendChild(foldLine);
    
    const topHalf = document.createElement('div');
    topHalf.className = 'badge-half top-half';
    topHalf.style.zIndex = '999';
    topHalf.innerHTML = '<div class="half-label">TOP HALF (4"x3")</div>';
    canvas.appendChild(topHalf);
    
    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'badge-half bottom-half';
    bottomHalf.style.zIndex = '999';
    bottomHalf.innerHTML = '<div class="half-label">BOTTOM HALF (4"x3") - PRINTS UPSIDE DOWN</div>';
    canvas.appendChild(bottomHalf);
    
    if (!currentDesignerTemplate || !currentDesignerTemplate.config.elements) {
        return;
    }
    
    currentDesignerTemplate.config.elements.forEach(element => {
        const elementDiv = createCanvasElement(element, isFoldPreview);
        canvas.appendChild(elementDiv);
    });
}

function createCanvasElement(element, isFoldPreview = false) {
    const div = document.createElement('div');
    div.className = 'canvas-element';
    div.id = `element-${element.id}`;
    
    // Calculate position - if fold preview and element is in bottom half, flip it
    let x = element.x * 100;
    let y = element.y * 100;
    
    if (isFoldPreview && element.y >= 3) { // Bottom half (y >= 3 inches)
        // Flip the element upside down for fold preview
        y = (6 - element.y - element.height) * 100; // Mirror vertically
    }
    
    div.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${element.width * 100}px;
        height: ${element.height * 100}px;
        border: 2px dashed #ccc;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${currentDesignerTemplate.config.backgroundPdf ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.9)'};
        font-size: ${element.fontSize || 12}px;
        font-weight: ${element.bold ? 'bold' : 'normal'};
        text-align: ${element.align || 'left'};
        color: ${element.color || '#000000'};
        z-index: 10;
    `;
    
    // Set content based on element type
    if (element.type === 'text') {
        div.textContent = element.content;
    } else if (element.type === 'checkbox') {
        div.innerHTML = `
            <input type="checkbox" ${element.checked ? 'checked' : ''}>
            <span>${element.label || ''}</span>
        `;
    } else if (element.type === 'image') {
        if (element.imageUrl) {
            const img = document.createElement('img');
            img.src = element.imageUrl;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            img.style.display = 'block';
            div.appendChild(img);
            
            // Add filename display below image
            if (element.imageFileName) {
                const filenameDiv = document.createElement('div');
                filenameDiv.style.cssText = `
                    position: absolute;
                    bottom: -20px;
                    left: 0;
                    right: 0;
                    font-size: 10px;
                    color: #666;
                    text-align: center;
                    background: rgba(255,255,255,0.8);
                    padding: 2px;
                    border-radius: 2px;
                `;
                filenameDiv.textContent = element.imageFileName;
                div.appendChild(filenameDiv);
            }
        } else {
            div.innerHTML = '<i class="fas fa-image fa-2x text-muted"></i>';
        }
    } else if (element.type === 'line') {
        div.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${element.width * 100}px;
            height: ${element.thickness || 2}px;
            background: ${element.color || '#000000'};
            border: none;
            cursor: pointer;
            user-select: none;
        `;
        // Add line style
        if (element.style === 'dashed') {
            div.style.borderTop = `${element.thickness || 2}px dashed ${element.color || '#000000'}`;
            div.style.background = 'transparent';
        } else if (element.style === 'dotted') {
            div.style.borderTop = `${element.thickness || 2}px dotted ${element.color || '#000000'}`;
            div.style.background = 'transparent';
        }
    } else if (element.type === 'square') {
        div.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${element.width * 100}px;
            height: ${element.height * 100}px;
            border: ${element.borderWidth || 2}px ${element.borderStyle || 'solid'} ${element.borderColor || '#000000'};
            background: ${element.fillColor || 'transparent'};
            cursor: pointer;
            user-select: none;
        `;
    } else if (element.type === 'textArea') {
        div.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${element.width * 100}px;
            height: ${element.height * 100}px;
            border: ${element.borderWidth || 1}px solid ${element.borderColor || '#cccccc'};
            background: ${element.backgroundColor || 'transparent'};
            cursor: pointer;
            user-select: none;
            display: flex;
            align-items: flex-start;
            justify-content: flex-start;
            padding: 8px;
            font-size: ${element.fontSize || 14}px;
            font-weight: ${element.bold ? 'bold' : 'normal'};
            text-align: ${element.align || 'left'};
            color: ${element.color || '#000000'};
            overflow: hidden;
        `;
        div.textContent = element.content;
    }
    
    // Add click event for selection
    div.addEventListener('click', (e) => {
        e.stopPropagation();
        selectElement(element);
    });
    
    // Add drag functionality
    div.draggable = true;
    div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', element.id);
        e.dataTransfer.effectAllowed = 'move';
    });
    
    // Add drag end event to update position
    div.addEventListener('dragend', (e) => {
        // Position will be updated in the canvas drop event
    });
    
    return div;
}

function selectElement(element) {
    selectedElement = element;
    
    // Update visual selection
    document.querySelectorAll('.canvas-element').forEach(el => {
        el.style.border = '2px dashed #ccc';
    });
    
    const selectedDiv = document.getElementById(`element-${element.id}`);
    if (selectedDiv) {
        selectedDiv.style.border = '2px solid #007bff';
    }
    
    // Update properties panel
    updatePropertiesPanel(element);
}

function updatePropertiesPanel(element) {
    const propertiesPanel = document.getElementById('elementProperties');
    
    if (element.type === 'text') {
        propertiesPanel.innerHTML = `
            <div class="mb-2">
                <label class="form-label">Content</label>
                <input type="text" class="form-control" id="contentInput" value="${element.content || ''}">
            </div>
            <div class="mb-2">
                <label class="form-label">CSV Field</label>
                <select class="form-control" id="csvFieldInput">
                    <option value="">-- Loading CSV Fields --</option>
                </select>
                <small class="form-text text-muted">Select a CSV field to insert as placeholder</small>
            </div>
            <div class="mb-2">
                <label class="form-label">Font Size</label>
                <input type="number" class="form-control" id="fontSizeInput" value="${element.fontSize || 12}" min="8" max="72">
            </div>
            <div class="mb-2">
                <label class="text-muted">Color</label>
                <input type="color" class="form-control" id="colorInput" value="${element.color || '#000000'}">
            </div>
            <div class="mb-2">
                <label class="form-label">Bold</label>
                <input type="checkbox" id="boldInput" ${element.bold ? 'checked' : ''}>
            </div>
            <div class="mb-2">
                <label class="form-label">Alignment</label>
                <select class="form-control" id="alignInput">
                    <option value="left" ${element.align === 'left' ? 'selected' : ''}>Left</option>
                    <option value="center" ${element.align === 'center' ? 'selected' : ''}>Center</option>
                    <option value="right" ${element.align === 'right' ? 'selected' : ''}>Right</option>
                </select>
            </div>
            <div class="mb-2">
                <label class="form-label">X Position</label>
                <input type="number" class="form-control" id="xInput" value="${element.x}" step="0.1" min="0" max="4">
            </div>
            <div class="mb-2">
                <div class="mb-2">
                    <label class="form-label">Y Position</label>
                    <input type="number" class="form-control" id="yInput" value="${element.y}" step="0.1" min="0" max="6">
                </div>
                <div class="mb-2">
                    <label class="form-label">Width</label>
                    <input type="number" class="form-control" id="widthInput" value="${element.width}" step="0.1" min="0.1" max="4">
                </div>
                <div class="mb-2">
                    <label class="form-label">Height</label>
                    <input type="number" class="form-control" id="heightInput" value="${element.height}" step="0.1" min="0.1" max="6">
                </div>
            </div>
        `;
        
        // Add event listeners for property changes
        setupPropertyListeners(element);
    } else if (element.type === 'checkbox') {
        propertiesPanel.innerHTML = `
            <div class="mb-2">
                <label class="form-label">Label</label>
                <input type="text" class="form-control" id="labelInput" value="${element.label || ''}">
            </div>
            <div class="mb-2">
                <label class="form-label">Color</label>
                <input type="color" class="form-control" id="colorInput" value="${element.color || '#000000'}">
            </div>
            <div class="mb-2">
                <label class="form-label">X Position</label>
                <input type="number" class="form-control" id="xInput" value="${element.x}" step="0.1" min="0" max="4">
            </div>
            <div class="mb-2">
                <label class="form-label">Y Position</label>
                <input type="number" class="form-control" id="yInput" value="${element.y}" step="0.1" min="0" max="6">
            </div>
            <div class="mb-2">
                <label class="form-label">Width</label>
                <input type="number" class="form-control" id="widthInput" value="${element.width}" step="0.1" min="0.1" max="4">
            </div>
            <div class="mb-2">
                <label class="form-label">Height</label>
                <input type="number" class="form-control" id="heightInput" value="${element.height}" step="0.1" min="0.1" max="6">
            </div>
        `;
        
        setupPropertyListeners(element);
    } else if (element.type === 'image') {
        propertiesPanel.innerHTML = `
            <div class="mb-2">
                <label class="form-label">Image</label>
                <input type="file" class="form-control" id="imageInput" accept="image/*">
                <small class="form-text text-muted">Select a new image</small>
            </div>
            ${element.imageFileName ? `<div class="mb-2">
                <label class="form-label">Current Image</label>
                <div class="form-control-plaintext">${element.imageFileName}</div>
            </div>` : ''}
            <div class="mb-2">
                <label class="form-label">X Position</label>
                <input type="number" class="form-control" id="xInput" value="${element.x}" step="0.1" min="0" max="4">
            </div>
            <div class="mb-2">
                <label class="form-label">Y Position</label>
                <input type="number" class="form-control" id="yInput" value="${element.y}" step="0.1" min="0" max="6">
            </div>
            <div class="mb-2">
                <label class="form-label">Width</label>
                <input type="number" class="form-control" id="widthInput" value="${element.width}" step="0.1" min="0.1" max="4">
            </div>
            <div class="mb-2">
                <label class="form-label">Height</label>
                <input type="number" class="form-control" id="heightInput" value="${element.height}" step="0.1" min="0.1" max="6">
            </div>
        `;
        
        setupPropertyListeners(element);
    } else if (element.type === 'line') {
        propertiesPanel.innerHTML = `
            <div class="mb-2">
                <label class="form-label">Color</label>
                <input type="color" class="form-control" id="colorInput" value="${element.color || '#000000'}">
            </div>
            <div class="mb-2">
                <label class="form-label">Thickness</label>
                <input type="number" class="form-control" id="thicknessInput" value="${element.thickness || 2}" min="1" max="10">
            </div>
            <div class="mb-2">
                <label class="form-label">Style</label>
                <select class="form-control" id="styleInput">
                    <option value="solid" ${element.style === 'solid' ? 'selected' : ''}>Solid</option>
                    <option value="dashed" ${element.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                    <option value="dotted" ${element.style === 'dotted' ? 'selected' : ''}>Dotted</option>
                </select>
            </div>
            <div class="mb-2">
                <label class="form-label">X Position</label>
                <input type="number" class="form-control" id="xInput" value="${element.x}" step="0.1" min="0" max="4">
            </div>
            <div class="mb-2">
                <label class="form-label">Y Position</label>
                <input type="number" class="form-control" id="yInput" value="${element.y}" step="0.1" min="0" max="6">
            </div>
            <div class="mb-2">
                <label class="form-label">Width</label>
                <input type="number" class="form-control" id="widthInput" value="${element.width}" step="0.1" min="0.1" max="4">
            </div>
        `;
        
        setupPropertyListeners(element);
    } else if (element.type === 'square') {
        propertiesPanel.innerHTML = `
            <div class="mb-2">
                <label class="form-label">Border Color</label>
                <input type="color" class="form-control" id="borderColorInput" value="${element.borderColor || '#000000'}">
            </div>
            <div class="mb-2">
                <label class="form-label">Fill Color</label>
                <input type="color" class="form-control" id="fillColorInput" value="${element.fillColor || 'transparent'}">
            </div>
            <div class="mb-2">
                <label class="form-label">Border Width</label>
                <input type="number" class="form-control" id="borderWidthInput" value="${element.borderWidth || 2}" min="0" max="10">
            </div>
            <div class="mb-2">
                <label class="form-label">Border Style</label>
                <select class="form-control" id="borderStyleInput">
                    <option value="solid" ${element.borderStyle === 'solid' ? 'selected' : ''}>Solid</option>
                    <option value="dashed" ${element.borderStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                    <option value="dotted" ${element.borderStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
                </select>
            </div>
            <div class="mb-2">
                <label class="form-label">X Position</label>
                <input type="number" class="form-control" id="xInput" value="${element.x}" step="0.1" min="0" max="4">
            </div>
            <div class="mb-2">
                <label class="form-label">Y Position</label>
                <input type="number" class="form-control" id="yInput" value="${element.y}" step="0.1" min="0" max="6">
            </div>
            <div class="mb-2">
                <label class="form-label">Width</label>
                <input type="number" class="form-control" id="widthInput" value="${element.width}" step="0.1" min="0.1" max="4">
            </div>
            <div class="mb-2">
                <label class="form-label">Height</label>
                <input type="number" class="form-control" id="heightInput" value="${element.height}" step="0.1" min="0.1" max="6">
            </div>
        `;
        
        setupPropertyListeners(element);
    } else if (element.type === 'textArea') {
        propertiesPanel.innerHTML = `
            <div class="mb-2">
                <label class="form-label">Background Color</label>
                <input type="color" class="form-control" id="backgroundColorInput" value="${element.backgroundColor || '#ffffff'}">
            </div>
            <div class="mb-2">
                <label class="form-label">Border Color</label>
                <input type="color" class="form-control" id="borderColorInput" value="${element.borderColor || '#cccccc'}">
            </div>
            <div class="mb-2">
                <label class="form-label">Border Width</label>
                <input type="number" class="form-control" id="borderWidthInput" value="${element.borderWidth || 1}" min="0" max="10">
            </div>
        `;
        
        setupPropertyListeners(element);
    }
}

function setupPropertyListeners(element) {
    // Content/Label
    const contentInput = document.getElementById('contentInput') || document.getElementById('labelInput');
    if (contentInput) {
        contentInput.addEventListener('input', (e) => {
            if (element.type === 'text') {
                element.content = e.target.value;
            } else if (element.type === 'checkbox') {
                element.label = e.target.value;
            }
            renderCanvas();
        });
    }
    
    // CSV Field dropdown
    const csvFieldInput = document.getElementById('csvFieldInput');
    if (csvFieldInput) {
        // Populate CSV fields asynchronously
        (async () => {
            try {
                const fields = await getAvailableCSVFields();
                csvFieldInput.innerHTML = `
                    <option value="">-- Select CSV Field --</option>
                    ${fields.map(field => 
                        `<option value="{{${field}}}" ${element.content === `{{${field}}}` ? 'selected' : ''}>${field}</option>`
                    ).join('')}
                `;
            } catch (error) {
                console.error('Failed to load CSV fields:', error);
                csvFieldInput.innerHTML = '<option value="">-- Failed to load fields --</option>';
            }
        })();
        
        csvFieldInput.addEventListener('change', (e) => {
            if (element.type === 'text' && e.target.value) {
                element.content = e.target.value;
                renderCanvas();
            }
        });
    }
    
    // Font size
    const fontSizeInput = document.getElementById('fontSizeInput');
    if (fontSizeInput) {
        fontSizeInput.addEventListener('input', (e) => {
            element.fontSize = parseInt(e.target.value);
            renderCanvas();
        });
    }
    
    // Color
    const colorInput = document.getElementById('colorInput');
    if (colorInput) {
        colorInput.addEventListener('input', (e) => {
            element.color = e.target.value;
            renderCanvas();
        });
    }
    
    // Bold
    const boldInput = document.getElementById('boldInput');
    if (boldInput) {
        boldInput.addEventListener('input', (e) => {
            element.bold = e.target.checked;
            renderCanvas();
        });
    }
    
    // Alignment
    const alignInput = document.getElementById('alignInput');
    if (alignInput) {
        alignInput.addEventListener('change', (e) => {
            element.align = e.target.value;
            renderCanvas();
        });
    }
    
    // Image file change
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && element.type === 'image') {
                // Convert file to base64 for persistence
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageData = e.target.result;
                    element.imageUrl = imageData;
                    element.imageData = imageData;
                    element.imageFileName = file.name;
                    renderCanvas();
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Position and size
    ['x', 'y', 'width', 'height'].forEach(prop => {
        const input = document.getElementById(`${prop}Input`);
        if (input) {
            input.addEventListener('input', (e) => {
                element[prop] = parseFloat(e.target.value);
                renderCanvas();
            });
        }
    });
    
    // Line-specific properties
    if (element.type === 'line') {
        const thicknessInput = document.getElementById('thicknessInput');
        if (thicknessInput) {
            thicknessInput.addEventListener('input', (e) => {
                element.thickness = parseInt(e.target.value);
                renderCanvas();
            });
        }
        
        const styleInput = document.getElementById('styleInput');
        if (styleInput) {
            styleInput.addEventListener('change', (e) => {
                element.style = e.target.value;
                renderCanvas();
            });
        }
    }
    
    // Square-specific properties
    if (element.type === 'square') {
        const borderColorInput = document.getElementById('borderColorInput');
        if (borderColorInput) {
            borderColorInput.addEventListener('input', (e) => {
                element.borderColor = e.target.value;
                renderCanvas();
            });
        }
        
        const fillColorInput = document.getElementById('fillColorInput');
        if (fillColorInput) {
            fillColorInput.addEventListener('input', (e) => {
                element.fillColor = e.target.value;
                renderCanvas();
            });
        }
        
        const borderWidthInput = document.getElementById('borderWidthInput');
        if (borderWidthInput) {
            borderWidthInput.addEventListener('input', (e) => {
                element.borderWidth = parseInt(e.target.value);
                renderCanvas();
            });
        }
        
        const borderStyleInput = document.getElementById('borderStyleInput');
        if (borderStyleInput) {
            borderStyleInput.addEventListener('change', (e) => {
                element.borderStyle = e.target.value;
                renderCanvas();
            });
        }
    }
    
    // TextArea-specific properties
    if (element.type === 'textArea') {
        const backgroundColorInput = document.getElementById('backgroundColorInput');
        if (backgroundColorInput) {
            backgroundColorInput.addEventListener('input', (e) => {
                element.backgroundColor = e.target.value;
                renderCanvas();
            });
        }
        
        const borderColorInput = document.getElementById('borderColorInput');
        if (borderColorInput) {
            borderColorInput.addEventListener('input', (e) => {
                element.borderColor = e.target.value;
                renderCanvas();
            });
        }
        
        const borderWidthInput = document.getElementById('borderWidthInput');
        if (borderWidthInput) {
            borderWidthInput.addEventListener('input', (e) => {
                element.borderWidth = parseInt(e.target.value);
                renderCanvas();
            });
        }
    }
}

function setupToolButtons() {
    // Add Text button
    const addTextBtn = document.getElementById('addTextBtn');
    if (addTextBtn) {
        addTextBtn.addEventListener('click', () => {
            addTextElement();
        });
    }
    
    // Add Image button
    const addImageBtn = document.getElementById('addImageBtn');
    if (addImageBtn) {
        addImageBtn.addEventListener('click', () => {
            addImageElement();
        });
    }
    
    // Add Checkbox button
    const addCheckboxBtn = document.getElementById('addCheckboxBtn');
    if (addCheckboxBtn) {
        addCheckboxBtn.addEventListener('click', () => {
            addCheckboxElement();
        });
    }
    
    // Add Line button
    const addLineBtn = document.getElementById('addLineBtn');
    if (addLineBtn) {
        addLineBtn.addEventListener('click', () => {
            addLineElement();
        });
    }
    
    // Add Square button
    const addSquareBtn = document.getElementById('addSquareBtn');
    if (addSquareBtn) {
        addSquareBtn.addEventListener('click', () => {
            addSquareElement();
        });
    }
    
    // Add Text Area button
    const addTextAreaBtn = document.getElementById('addTextAreaBtn');
    if (addTextAreaBtn) {
        addTextAreaBtn.addEventListener('click', () => {
            addTextAreaElement();
        });
    }
    
    // Add PDF Background button
    const addPdfBackgroundBtn = document.getElementById('addPdfBackgroundBtn');
    if (addPdfBackgroundBtn) {
        addPdfBackgroundBtn.addEventListener('click', () => {
            addPdfBackground();
        });
    }
    
    // Remove PDF Background button
    const removePdfBackgroundBtn = document.getElementById('removePdfBackgroundBtn');
    if (removePdfBackgroundBtn) {
        removePdfBackgroundBtn.addEventListener('click', () => {
            removePdfBackground();
        });
    }
    
    // Delete button
    deleteElementBtn = document.getElementById('deleteElementBtn');
    if (deleteElementBtn) {
        deleteElementBtn.addEventListener('click', () => {
            deleteSelectedElement();
        });
    }
    
    // Save Template button
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    if (saveTemplateBtn) {
        saveTemplateBtn.addEventListener('click', () => {
            saveTemplate();
        });
    }
    
    // Duplicate Template button
    const duplicateTemplateBtn = document.getElementById('duplicateTemplateBtn');
    if (duplicateTemplateBtn) {
        duplicateTemplateBtn.addEventListener('click', () => {
            duplicateTemplate();
        });
    }
    
    // Load Template button
    const loadTemplateBtn = document.getElementById('loadTemplateBtn');
    if (loadTemplateBtn) {
        loadTemplateBtn.addEventListener('click', () => {
            importTemplate();
        });
    }
    
    // Export Template button
    const exportTemplateBtn = document.getElementById('exportTemplateBtn');
    if (exportTemplateBtn) {
        exportTemplateBtn.addEventListener('click', () => {
            exportTemplate();
        });
    }
    
    // Preview button
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            showPdfPreview();
        });
    }
    
    // Fold Preview button
    const foldPreviewBtn = document.getElementById('foldPreviewBtn');
    if (foldPreviewBtn) {
        foldPreviewBtn.addEventListener('click', () => {
            toggleFoldPreview();
        });
    }
    
    // Test Print button
    const testPrintBtn = document.getElementById('testPrintBtn');
    if (testPrintBtn) {
        testPrintBtn.addEventListener('click', () => {
            showPdfPreview();
        });
    }
}

function addTextElement() {
    const newElement = {
        type: 'text',
        id: `text-${Date.now()}`,
        x: 0.5,
        y: 0.5,
        width: 2,
        height: 0.5,
        content: 'New Text',
        fontSize: 16,
        bold: false,
        align: 'left',
        color: '#000000'
    };
    
    currentDesignerTemplate.config.elements.push(newElement);
    renderCanvas();
    selectElement(newElement);
}

function addLineElement() {
    const newElement = {
        type: 'line',
        id: `line-${Date.now()}`,
        x: 0.5,
        y: 0.5,
        width: 3,
        height: 0.05,
        color: '#000000',
        thickness: 2,
        style: 'solid' // solid, dashed, dotted
    };
    
    currentDesignerTemplate.config.elements.push(newElement);
    renderCanvas();
    selectElement(newElement);
}

function addSquareElement() {
    const newElement = {
        type: 'square',
        id: `square-${Date.now()}`,
        x: 0.5,
        y: 0.5,
        width: 1,
        height: 1,
        color: '#000000',
        fillColor: 'transparent',
        borderWidth: 2,
        borderStyle: 'solid'
    };
    
    currentDesignerTemplate.config.elements.push(newElement);
    renderCanvas();
    selectElement(newElement);
}

function addPdfBackground() {
    // Create a file input for PDF upload
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.png,.jpg,.jpeg';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                
                // Set the PDF background
                currentDesignerTemplate.config.backgroundPdf = dataUrl;
                
                // Update UI
                updatePdfBackgroundButtons();
                renderCanvas();
                
                showSuccess(`${file.name} set as PDF background!`);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error loading PDF background:', error);
            showError('Failed to load PDF background. Please try again.');
        }
    };
    
    fileInput.click();
}

function removePdfBackground() {
    if (currentDesignerTemplate && currentDesignerTemplate.config) {
        currentDesignerTemplate.config.backgroundPdf = null;
        updatePdfBackgroundButtons();
        renderCanvas();
        showSuccess('PDF background removed!');
    }
}

function updatePdfBackgroundButtons() {
    const addBtn = document.getElementById('addPdfBackgroundBtn');
    const removeBtn = document.getElementById('removePdfBackgroundBtn');
    
    if (currentDesignerTemplate && currentDesignerTemplate.config.backgroundPdf) {
        // PDF background exists
        if (addBtn) addBtn.textContent = 'Change PDF Background';
        if (removeBtn) removeBtn.style.display = 'block';
    } else {
        // No PDF background
        if (addBtn) addBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF Background';
        if (removeBtn) removeBtn.style.display = 'none';
    }
}

function addTextAreaElement() {
    const newElement = {
        type: 'textArea',
        id: `textArea-${Date.now()}`,
        x: 0.5,
        y: 0.5,
        width: 3,
        height: 1.5,
        content: 'Large text area for longer content...',
        fontSize: 14,
        bold: false,
        align: 'left',
        color: '#000000',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#cccccc'
    };
    
    currentDesignerTemplate.config.elements.push(newElement);
    renderCanvas();
    selectElement(newElement);
}

function toggleFoldPreview() {
    isFoldPreviewActive = !isFoldPreviewActive;
    const foldPreviewBtn = document.getElementById('foldPreviewBtn');
    
    if (isFoldPreviewActive) {
        foldPreviewBtn.innerHTML = '<i class="fas fa-eye"></i> Normal View';
        foldPreviewBtn.classList.remove('btn-outline-warning');
        foldPreviewBtn.classList.add('btn-warning');
        // Show fold preview - bottom half elements upside down
        showFoldPreview();
    } else {
        foldPreviewBtn.innerHTML = '<i class="fas fa-undo"></i> Fold Preview';
        foldPreviewBtn.classList.remove('btn-warning');
        foldPreviewBtn.classList.add('btn-outline-warning');
        // Show normal view
        showNormalView();
    }
}

function showFoldPreview() {
    // Hide the fold line and half labels during preview
    const foldLine = document.querySelector('.fold-line');
    const topHalf = document.querySelector('.top-half');
    const bottomHalf = document.querySelector('.bottom-half');
    
    if (foldLine) foldLine.style.display = 'none';
    if (topHalf) topHalf.style.display = 'none';
    if (bottomHalf) bottomHalf.style.display = 'none';
    
    // Re-render canvas with bottom half elements upside down
    renderCanvas(true); // true = fold preview mode
}

function showNormalView() {
    // Show the fold line and half labels again
    const foldLine = document.querySelector('.fold-line');
    const topHalf = document.querySelector('.top-half');
    const bottomHalf = document.querySelector('.bottom-half');
    
    if (foldLine) foldLine.style.display = 'block';
    if (topHalf) topHalf.style.display = 'block';
    if (bottomHalf) bottomHalf.style.display = 'block';
    
    // Re-render canvas normally
    renderCanvas(false); // false = normal mode
}

// Get available CSV fields for the current event
async function getAvailableCSVFields() {
    if (!currentEvent) return [];
    
    // Standard fields that are always available
    const standardFields = [
        'firstName', 'lastName', 'middleName', 'birthDate', 
        'address', 'city', 'state', 'zip', 'phone', 'email',
        'eventName', 'eventDate'
    ];
    
    // Get CSV headers directly from the import records
    let csvHeaders = [];
    try {
        const response = await fetch(`/api/events/${currentEvent.id}/csv-headers`);
        if (response.ok) {
            const result = await response.json();
            csvHeaders = result.headers || [];
        } else {
            console.warn('Failed to get CSV headers, falling back to contact-based field extraction');
            // Fallback to the old method if the new API fails
            csvHeaders = await getCSVFieldsFromContacts();
        }
    } catch (error) {
        console.warn('Failed to get CSV headers, falling back to contact-based field extraction:', error);
        // Fallback to the old method if the new API fails
        csvHeaders = await getCSVFieldsFromContacts();
    }
    
    // Combine standard fields with CSV headers, removing duplicates
    const allFields = [...standardFields];
    csvHeaders.forEach(header => {
        if (!allFields.includes(header)) {
            allFields.push(header);
        }
    });
    
    return allFields;
}

// Fallback function to get CSV fields from contacts (old method)
async function getCSVFieldsFromContacts() {
    const customFields = [];
    try {
        // Get ALL contacts to find all possible custom fields
        const response = await fetch(`/api/contacts/search/${currentEvent.id}?q=&limit=1000`);
        if (response.ok) {
            const contacts = await response.json();
            
            // Collect all unique custom field names from all contacts
            const allCustomFields = new Set();
            contacts.forEach(contact => {
                if (contact.custom_fields) {
                    try {
                        const parsed = JSON.parse(contact.custom_fields);
                        Object.keys(parsed).forEach(key => {
                            allCustomFields.add(key);
                        });
                    } catch (e) {
                        console.warn('Could not parse custom fields for contact:', e);
                    }
                }
            });
            
            // Convert Set to array and sort alphabetically
            customFields.push(...Array.from(allCustomFields).sort());
        }
    } catch (error) {
        console.warn('Failed to load contacts for CSV fields:', error);
    }
    
    return customFields;
}

function addImageElement() {
    // Create a file input for image selection
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Convert file to base64 for persistence
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result; // This is the data URL
            
            // Create a new image element
            const newElement = {
                type: 'image',
                id: `image-${Date.now()}`,
                x: 0.5,
                y: 0.5,
                width: 1,
                height: 1,
                imageUrl: imageData, // Store the data URL for display
                imageData: imageData, // Store the data URL for PDF generation
                imageFileName: file.name // Store the filename
            };
            
            currentDesignerTemplate.config.elements.push(newElement);
            renderCanvas();
            selectElement(newElement);
        };
        reader.readAsDataURL(file);
    };
    
    fileInput.click();
}

function addCheckboxElement() {
    const newElement = {
        type: 'checkbox',
        id: `checkbox-${Date.now()}`,
        x: 0.5,
        y: 0.5,
        width: 0.3,
        height: 0.3,
        label: 'New Checkbox',
        color: '#000000'
    };
    
    currentDesignerTemplate.config.elements.push(newElement);
    renderCanvas();
    selectElement(newElement);
}

function deleteSelectedElement() {
    if (!selectedElement) {
        showError('No element selected');
        return;
    }
    
    const index = currentDesignerTemplate.config.elements.findIndex(el => el.id === selectedElement.id);
    if (index > -1) {
        currentDesignerTemplate.config.elements.splice(index, 1);
        selectedElement = null;
        renderCanvas();
        document.getElementById('elementProperties').innerHTML = '<p class="text-muted">Select an element to edit its properties</p>';
    }
}

function updateTemplateInfo() {
    if (currentDesignerTemplate) {
        document.getElementById('templateName').value = currentDesignerTemplate.name || '';
        document.getElementById('templateDescription').value = currentDesignerTemplate.description || '';
    }
}

async function saveTemplate() {
    if (!currentDesignerTemplate) {
        showError('No template to save');
        return;
    }
    
    // Update template info from form
    currentDesignerTemplate.name = document.getElementById('templateName').value;
    currentDesignerTemplate.description = document.getElementById('templateDescription').value;
    
    try {
        if (currentDesignerTemplate.event_id && currentDesignerTemplate.id && currentDesignerTemplate.id !== 'default-template') {
            // Update existing event-specific template
            const response = await fetch(`/api/templates/${currentDesignerTemplate.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentDesignerTemplate)
            });
            
            if (response.ok) {
                showSuccess('Event template updated successfully!');
                // Reload templates to refresh the display
                loadTemplates();
            } else {
                showError('Failed to update event template');
            }
        } else if (currentDesignerTemplate.event_id) {
            // Save as new event-specific template
            const response = await fetch(`/api/templates/event/${currentDesignerTemplate.event_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentDesignerTemplate)
            });
            
            if (response.ok) {
                showSuccess('Event template saved successfully!');
            } else {
                showError('Failed to save event template');
            }
        } else if (currentDesignerTemplate.id) {
            // Update existing template
            const response = await fetch(`/api/templates/${currentDesignerTemplate.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentDesignerTemplate)
            });
            
            if (response.ok) {
                showSuccess('Template updated successfully!');
                // Reload templates to refresh the display
                loadTemplates();
            } else {
                showError('Failed to update template');
            }
        } else {
            // Save as new general template
            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentDesignerTemplate)
            });
            
            if (response.ok) {
                const result = await response.json();
                // Update the template with the new ID
                currentDesignerTemplate.id = result.id;
                showSuccess('Template saved successfully!');
                // Reload templates to refresh the display
                loadTemplates();
            } else {
                showError('Failed to save template');
            }
        }
    } catch (error) {
        console.error('Failed to save template:', error);
        showError('Failed to save template');
    }
}

function setupCanvasEventListeners() {
    // Canvas click to deselect
    const canvas = document.getElementById('labelCanvas');
    canvas.addEventListener('click', () => {
        selectedElement = null;
        document.querySelectorAll('.canvas-element').forEach(el => {
            el.style.border = '2px dashed #ccc';
        });
        document.getElementById('elementProperties').innerHTML = '<p class="text-muted">Select an element to edit its properties</p>';
    });
    
    // Setup drag and drop for canvas elements
    setupDragAndDrop();
}

function setupDragAndDrop() {
    const canvas = document.getElementById('labelCanvas');
    
    // Handle drop on canvas
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });
    
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const elementId = e.dataTransfer.getData('text/plain');
        const element = currentDesignerTemplate.config.elements.find(el => el.id === elementId);
        
        if (element) {
            // Calculate new position relative to canvas
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / 100; // Convert to template units
            const y = (e.clientY - rect.top) / 100;
            
            // Update element position
            element.x = Math.max(0, Math.min(4 - element.width, x));
            element.y = Math.max(0, Math.min(6 - element.height, y));
            
            // Re-render canvas
            renderCanvas();
            
            // Update properties panel if this element is selected
            if (selectedElement && selectedElement.id === element.id) {
                updatePropertiesPanel(element);
            }
        }
    });
}

// PDF Preview functionality
function showPdfPreview() {
    if (!currentDesignerTemplate) {
        showError('No template to preview');
        return;
    }
    
    // Show the PDF preview modal
    const modal = new bootstrap.Modal(document.getElementById('pdfPreviewModal'));
    modal.show();
    
    // Generate PDF preview
    generatePdfPreview();
    
    // Setup PDF modal buttons
    setupPdfModalButtons();
}

function generatePdfPreview() {
    const previewContent = document.getElementById('pdfPreviewContent');
    previewContent.innerHTML = '<p class="text-muted">Generating PDF preview...</p>';
    
    try {
        // Create a sample contact for preview
        const sampleContact = {
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
            eventName: 'Sample Event',
            eventDate: '2024-01-01',
            // Add some sample custom fields that might be common in CSV imports
            organization: 'Sample Corp',
            title: 'Manager',
            department: 'Sales',
            badge_number: 'BN001',
            dietary_restrictions: 'None',
            emergency_contact: 'Jane Doe',
            emergency_phone: '(555) 987-6543'
        };
        
        // Generate the PDF preview
        const pdfBlob = generatePdf(currentDesignerTemplate, sampleContact);
        
        // Display the PDF preview
        displayPdfPreview(pdfBlob);
        
    } catch (error) {
        console.error('Failed to generate PDF preview:', error);
        previewContent.innerHTML = '<p class="text-danger">Failed to generate PDF preview</p>';
    }
}

// Generate PDF from Visual Designer template without requiring a full instance
async function generateVisualDesignerPDF(template, contactData) {
    try {
        console.log('🔄 Generating PDF from Visual Designer template');
        console.log('Template:', template);
        console.log('Template config dimensions:', {
            width: template.config.width,
            height: template.config.height,
            elements: template.config.elements.length
        });
        console.log('Contact Data:', contactData);
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: [288, 432] // 4x6 inches in points
        });
        
        // Add background image if present
        const backgroundElement = template.config.elements.find(el => el.type === 'background-image');
        if (backgroundElement && backgroundElement.content) {
            try {
                console.log('🖼️ Adding background image from template');
                pdf.addImage(backgroundElement.content, 'JPEG', 0, 0, 288, 432);
            } catch (e) {
                console.warn('Failed to add background image to PDF:', e);
            }
        }
        
        // Add text fields
        const textElements = template.config.elements.filter(el => el.type === 'text');
        console.log('📝 Processing', textElements.length, 'text elements');
        
        textElements.forEach(element => {
            try {
                let text;
                if (element.fieldType === 'customText') {
                    text = element.content || 'Custom Text';
                } else {
                    // For data fields, extract field name from content like {{field_name}}
                    let fieldType = element.fieldType;
                    
                    // If no fieldType, extract from content
                    if (!fieldType && element.content) {
                        const match = element.content.match(/\{\{(\w+)\}\}/);
                        fieldType = match ? match[1] : element.type;
                    }
                    
                    // Fallback to element type if nothing else works
                    if (!fieldType) {
                        fieldType = element.type;
                    }
                    
                                    console.log(`🔍 Looking for field: "${fieldType}" (extracted from: "${element.content}") in contact data`);
                console.log('Available contact data keys:', Object.keys(contactData));
                console.log('First 10 keys with values:', Object.keys(contactData).slice(0, 10).map(key => `${key}: "${contactData[key]}"`));
                    
                    // Use unified field mapping function
                    const fieldValue = window.mapFieldValue ? window.mapFieldValue(fieldType, contactData) : null;
                    
                    text = fieldValue || `[${fieldType}]`;
                    if (!fieldValue) {
                        console.log(`❌ No value found for field: ${fieldType}`);
                    }
                }
                
                console.log(`📄 Adding text: "${text}" at (${element.x}, ${element.y})`);
                
                // Set font properties
                pdf.setFont(element.fontFamily?.toLowerCase() || 'arial');
                if (element.bold) {
                    pdf.setFont(element.fontFamily?.toLowerCase() || 'arial', 'bold');
                }
                pdf.setFontSize(element.fontSize || 12);
                
                // STANDARDIZED: Simple 0.5 scaling for 576x864 -> 288x432
                const scaleX = 0.5;  // 288 / 576
                const scaleY = 0.5;  // 432 / 864
                const x = element.x * scaleX;
                const y = element.y * scaleY;
                
                console.log(`📍 STANDARDIZED: VD(${element.x}, ${element.y}) -> PDF(${x.toFixed(1)}, ${y.toFixed(1)}) [Scale: 0.5x0.5]`);
                
                // Apply text alignment exactly like Visual Designer
                let align = 'left';
                if (element.textAlign === 'center') align = 'center';
                else if (element.textAlign === 'right') align = 'right';
                
                // Add text to PDF with same positioning as Visual Designer
                const finalY = y + (element.fontSize || 12);
                pdf.text(text, x, finalY, { align: align });
                
                console.log(`📄 Final text position: (${x.toFixed(1)}, ${finalY.toFixed(1)})`);
                console.log(`✅ Field "${fieldType}" successfully added to PDF with text: "${text}"`);
                
            } catch (e) {
                console.warn('Failed to add text element to PDF:', element, e);
            }
        });
        
        console.log('✅ Visual Designer PDF generated successfully');
        return pdf;
        
    } catch (error) {
        console.error('❌ Error generating Visual Designer PDF:', error);
        return null;
    }
}

function generatePdf(template, contactData) {
    // Create new PDF document (4" x 6" = 288 x 432 points)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [288, 432] // 4" x 6"
    });
    
    // Debug: Log the contact data and template
    console.log('=== PDF Generation Debug ===');
    console.log('Template:', template);
    console.log('Contact Data:', contactData);
    console.log('Contact Data Keys:', Object.keys(contactData));
    
    // Add PDF background if present
    if (template.config.backgroundPdf) {
        try {
            // Add the background image/PDF to cover the entire page
            doc.addImage(template.config.backgroundPdf, 'JPEG', 0, 0, 288, 432);
        } catch (error) {
            console.warn('Failed to add PDF background to print document:', error);
        }
    }
    
    // Set default font
    doc.setFont('helvetica');
    
    // Process each element in the template
    template.config.elements.forEach(element => {
        // CORRECT coordinate conversion: Visual Designer canvas (576x864) -> PDF (288x432)
        const scaleX = 288 / 576; // = 0.5
        const scaleY = 432 / 864; // = 0.5
        const x = element.x * scaleX;
        const y = element.y * scaleY;
        
        if (element.type === 'text') {
            // Process text content with placeholders
            let content = element.content || '';
            console.log(`Processing text element: "${content}"`);
            
            // Replace all placeholders with actual data using a more flexible approach
            content = content.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
                console.log(`Replacing placeholder: ${match} with field: ${fieldName}`);
                
                // Convert field name to camelCase for standard fields
                const camelCaseField = fieldName.replace(/([-_][a-z])/g, (g) => g[1].toUpperCase());
                console.log(`CamelCase field: ${camelCaseField}`);
                
                // Check if it's a standard field first (camelCase)
                if (contactData[camelCaseField] !== undefined) {
                    console.log(`Found in standard fields (camelCase): ${contactData[camelCaseField]}`);
                    return contactData[camelCaseField] || '';
                }
                
                // Check if it's a direct field match
                if (contactData[fieldName] !== undefined) {
                    console.log(`Found in direct fields: ${contactData[fieldName]}`);
                    return contactData[fieldName] || '';
                }
                
                // Check if it's in custom fields
                if (contactData.custom_fields) {
                    try {
                        const customFields = JSON.parse(contactData.custom_fields);
                        console.log('Custom fields:', customFields);
                        if (customFields[fieldName] !== undefined) {
                            console.log(`Found in custom fields: ${customFields[fieldName]}`);
                            return customFields[fieldName] || '';
                        }
                    } catch (e) {
                        console.warn('Failed to parse custom fields for PDF generation:', e);
                    }
                }
                
                // Try to find a field that matches ignoring case and special characters
                const allKeys = Object.keys(contactData);
                const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                for (const key of allKeys) {
                    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (normalizedKey === normalizedFieldName) {
                        console.log(`Found field by normalized match: ${key} = ${contactData[key]}`);
                        return contactData[key] || '';
                    }
                }
                
                // Check custom fields with normalized matching
                if (contactData.custom_fields) {
                    try {
                        const customFields = JSON.parse(contactData.custom_fields);
                        const customKeys = Object.keys(customFields);
                        
                        for (const key of customKeys) {
                            const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                            if (normalizedKey === normalizedFieldName) {
                                console.log(`Found custom field by normalized match: ${key} = ${customFields[key]}`);
                                return customFields[key] || '';
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to parse custom fields for normalized matching:', e);
                    }
                }
                
                console.log(`No match found for field: ${fieldName}, returning original placeholder`);
                console.log(`Available keys:`, Object.keys(contactData));
                // Return the original placeholder if no match found
                return match;
            });
            
            console.log(`Final content after replacement: "${content}"`);
            
            // Set font properties
            const fontSize = element.fontSize || 12;
            doc.setFontSize(fontSize);
            
            // Set text color
            if (element.color) {
                doc.setTextColor(element.color);
            }
            
            // Set font weight
            if (element.bold) {
                doc.setFont('helvetica', 'bold');
            }
            
            // Text positioning with proper alignment (matching Visual Designer)
            let align = 'left';
            if (element.textAlign === 'center') align = 'center';
            else if (element.textAlign === 'right') align = 'right';
            
            // Add text to PDF (same positioning as Visual Designer)
            const finalY = y + fontSize;
            doc.text(content, x, finalY, { align: align });
            
            // Reset font to normal
            doc.setFont('helvetica', 'normal');
        } else if (element.type === 'checkbox') {
            // Simple checkbox rendering
            doc.rect(x, y, 20, 20);
            if (element.checked) {
                // Draw normal checkmark
                doc.line(x + 5, y + 10, x + 8, y + 15);
                doc.line(x + 8, y + 15, x + 15, y + 5);
            }
            
            // Add label
            if (element.label) {
                doc.setFontSize(12);
                doc.text(element.label, x + 25, y + 15);
            }
            
        } else if (element.type === 'image' && element.imageData) {
            // Handle image data (base64 or data URL)
            try {
                let imageData = element.imageData;
                let imageType = 'PNG';
                
                // If it's a data URL, extract the base64 part
                if (imageData.startsWith('data:')) {
                    const parts = imageData.split(',');
                    imageData = parts[1];
                    imageType = parts[0].split(':')[1].split(';')[0].split('/')[1].toUpperCase();
                }
                
                // Simple image rendering with correct scaling
                const scaledWidth = element.width * scaleX;
                const scaledHeight = element.height * scaleY;
                doc.addImage(imageData, imageType, x, y, scaledWidth, scaledHeight);
            } catch (error) {
                console.error('Failed to add image to PDF:', error);
                // Fallback to placeholder
                const scaledWidth = element.width * scaleX;
                const scaledHeight = element.height * scaleY;
                doc.rect(x, y, scaledWidth, scaledHeight);
                doc.setFontSize(10);
                doc.text('[Image Error]', x + (scaledWidth / 2), y + (scaledHeight / 2), { align: 'center' });
            }
        } else if (element.type === 'image') {
            // Fallback for images without data
            const scaledWidth = element.width * scaleX;
            const scaledHeight = element.height * scaleY;
            doc.rect(x, y, scaledWidth, scaledHeight);
            doc.setFontSize(10);
            doc.text('[No Image]', x + (scaledWidth / 2), y + (scaledHeight / 2), { align: 'center' });
        } else if (element.type === 'line') {
            // Simple line rendering with correct scaling
            const thickness = element.thickness || 2;
            const lineY = y + (thickness / 2);
            const scaledWidth = element.width * scaleX;
            
            if (false) { // Simplified - no fold logic
                // For bottom half, draw line from right to left to simulate rotation
                if (element.style === 'dashed') {
                    // Draw dashed line in reverse
                    const dashLength = 10;
                    const gapLength = 5;
                    let currentX = x + width;
                    while (currentX > x) {
                        const startX = Math.max(currentX - dashLength, x);
                        doc.line(startX, lineY, currentX, lineY);
                        currentX = startX - gapLength;
                    }
                } else if (element.style === 'dotted') {
                    // Draw dotted line in reverse
                    const dotSpacing = 8;
                    let currentX = x + width;
                    while (currentX > x) {
                        doc.circle(currentX, lineY, thickness / 2, 'F');
                        currentX -= dotSpacing;
                    }
                } else {
                    // Draw solid line in reverse
                    doc.line(x + width, lineY, x, lineY);
                }
            } else {
                // Normal line drawing for top half
                if (element.style === 'dashed') {
                    // Draw dashed line
                    const dashLength = 10;
                    const gapLength = 5;
                    let currentX = x;
                    while (currentX < x + scaledWidth) {
                        const endX = Math.min(currentX + dashLength, x + scaledWidth);
                        doc.line(currentX, lineY, endX, lineY);
                        currentX = endX + gapLength;
                    }
                } else if (element.style === 'dotted') {
                    // Draw dotted line
                    const dotSpacing = 8;
                    let currentX = x;
                    while (currentX < x + scaledWidth) {
                        doc.circle(currentX, lineY, thickness / 2, 'F');
                        currentX += dotSpacing;
                    }
                } else {
                    // Draw solid line
                    doc.line(x, lineY, x + scaledWidth, lineY);
                }
            }
            
        } else if (element.type === 'square') {
            // For bottom half elements, we'll handle the square normally
            // (squares don't need rotation as they look the same from all angles)
            
            // Draw square/rectangle
            if (element.fillColor && element.fillColor !== 'transparent') {
                doc.setFillColor(element.fillColor);
                doc.rect(x, y, width, height, 'F');
            }
            
            if (element.borderWidth > 0) {
                doc.setDrawColor(element.borderColor || '#000000');
                doc.setLineWidth(element.borderWidth);
                
                if (element.borderStyle === 'dashed') {
                    // Draw dashed border
                    const dashLength = 10;
                    const gapLength = 5;
                    
                    // Top line
                    let currentX = x;
                    while (currentX < x + width) {
                        const endX = Math.min(currentX + dashLength, x + width);
                        doc.line(currentX, y, endX, y);
                        currentX = endX + gapLength;
                    }
                    
                    // Right line
                    let currentY = y;
                    while (currentY < y + height) {
                        const endY = Math.min(currentY + dashLength, y + height);
                        doc.line(x + width, currentY, x + width, endY);
                        currentY = endY + gapLength;
                    }
                    
                    // Bottom line
                    currentX = x;
                    while (currentX < x + width) {
                        const endX = Math.min(currentX + dashLength, x + width);
                        doc.line(currentX, y + height, endX, y + height);
                        currentX = endX + gapLength;
                    }
                    
                    // Left line
                    currentY = y;
                    while (currentY < y + height) {
                        const endY = Math.min(currentY + dashLength, y + height);
                        doc.line(x, currentY, x, endY);
                        currentY = endY + gapLength;
                    }
                } else if (element.borderStyle === 'dotted') {
                    // Draw dotted border
                    const dotSpacing = 8;
                    
                    // Top line
                    let currentX = x;
                    while (currentX < x + width) {
                        doc.circle(currentX, y, element.borderWidth / 2, 'F');
                        currentX += dotSpacing;
                    }
                    
                    // Right line
                    let currentY = y;
                    while (currentY < y + height) {
                        doc.circle(x + width, currentY, element.borderWidth / 2, 'F');
                        currentY += dotSpacing;
                    }
                    
                    // Bottom line
                    currentX = x;
                    while (currentX < x + width) {
                        doc.circle(currentX, y + height, element.borderWidth / 2, 'F');
                        currentX += dotSpacing;
                    }
                    
                    // Left line
                    currentY = y;
                    while (currentY < y + height) {
                        doc.circle(x, currentY, element.borderWidth / 2, 'F');
                        currentY += dotSpacing;
                    }
                } else {
                    // Draw solid border
                    doc.rect(x, y, width, height);
                }
            }
            
        } else if (element.type === 'textArea') {
            // For bottom half elements, we'll handle text areas with rotation
            // Draw text area background
            if (element.backgroundColor && element.backgroundColor !== 'transparent') {
                doc.setFillColor(element.backgroundColor);
                doc.rect(x, y, width, height, 'F');
            }
            
            // Draw text area border
            if (element.borderWidth > 0) {
                doc.setDrawColor(element.borderColor || '#cccccc');
                doc.setLineWidth(element.borderWidth);
                doc.rect(x, y, width, height);
            }
            
            // Draw text content
            let content = element.content || '';
            
            // Replace placeholders with actual data using the same logic as text elements
            content = content.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
                // Convert field name to camelCase for standard fields
                const camelCaseField = fieldName.replace(/([-_][a-z])/g, (g) => g[1].toUpperCase());
                
                // Check if it's a standard field first
                if (contactData[camelCaseField] !== undefined) {
                    return contactData[camelCaseField] || '';
                }
                
                // Check if it's a direct field match
                if (contactData[fieldName] !== undefined) {
                    return contactData[fieldName] || '';
                }
                
                // Check if it's in custom fields
                if (contactData.custom_fields) {
                    try {
                        const customFields = JSON.parse(contactData.custom_fields);
                        if (customFields[fieldName] !== undefined) {
                            return customFields[fieldName] || '';
                        }
                    } catch (e) {
                        console.warn('Failed to parse custom fields for PDF generation:', e);
                    }
                }
                
                // Return the original placeholder if no match found
                return match;
            });
            
            // Set font properties
            const fontSize = element.fontSize || 14;
            doc.setFontSize(fontSize);
            
            // Set text color
            if (element.color) {
                doc.setTextColor(element.color);
            }
            
            // Set font weight
            if (element.bold) {
                doc.setFont('helvetica', 'bold');
            }
            
            // Draw text with word wrapping
            const padding = 8;
            const textX = x + padding;
            const textY = y + padding + fontSize;
            const maxWidth = width - (padding * 2);
            
            // Simple word wrapping
            const words = content.split(' ');
            let line = '';
            let currentY = textY;
            
            for (let word of words) {
                const testLine = line + word + ' ';
                const testWidth = doc.getTextWidth(testLine);
                
                if (testWidth > maxWidth && line !== '') {
                    // Draw current line and start new one
                    if (false) { // Simplified - no fold logic
                        doc.text(line.trim(), textX, currentY, { angle: 180 });
                    } else {
                        doc.text(line.trim(), textX, currentY);
                    }
                    line = word + ' ';
                    currentY += fontSize + 2;
                } else {
                    line = testLine;
                }
            }
            
            // Draw the last line
            if (line.trim()) {
                if (false) { // Simplified - no fold logic
                    doc.text(line.trim(), textX, currentY, { angle: 180 });
                } else {
                    doc.text(line.trim(), textX, currentY);
                }
            }
            
            // Reset font to normal
            doc.setFont('helvetica', 'normal');
        }
    });
    
    // Convert to blob
    const pdfBytes = doc.output('blob');
    return pdfBytes;
}

function displayPdfPreview(pdfBlob) {
    const previewContent = document.getElementById('pdfPreviewContent');
    
    // Create object URL for the PDF
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Create iframe to display PDF
    previewContent.innerHTML = `
        <iframe 
            src="${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0" 
            width="100%" 
            height="600px" 
            style="border: none;"
        ></iframe>
    `;
    
    // Store the blob for download/print
    window.currentPdfBlob = pdfBlob;
    window.currentPdfUrl = pdfUrl;
}

function setupPdfModalButtons() {
    // Download PDF button
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (window.currentPdfBlob) {
                const url = window.currentPdfUrl;
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentDesignerTemplate.name || 'template'}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        });
    }
    
    // Print PDF button
    const printBtn = document.getElementById('printPdfBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (window.currentPdfUrl) {
                const printWindow = window.open(window.currentPdfUrl);
                printWindow.onload = () => {
                    printWindow.print();
                };
            }
        });
    }
}

// Debug function to show all available fields
function debugAvailableFields() {
    console.log('=== DEBUG: Available Fields ===');
    
    if (!currentTemplate) {
        console.log('No current template loaded');
        return;
    }
    
    console.log('Template:', currentTemplate.name);
    console.log('Template Elements:');
    currentTemplate.config.elements.forEach((element, index) => {
        if (element.type === 'text') {
            console.log(`  Element ${index}: "${element.content}"`);
            // Extract all placeholders from this element
            const placeholders = element.content.match(/\{\{(\w+)\}\}/g);
            if (placeholders) {
                console.log(`    Placeholders: ${placeholders.join(', ')}`);
            }
        }
    });
    
    if (!currentContact) {
        console.log('No current contact loaded');
        return;
    }
    
    console.log('Contact Data:');
    console.log('  Standard fields:', {
        firstName: currentContact.first_name,
        lastName: currentContact.last_name,
        email: currentContact.email,
        phone: currentContact.phone
    });
    
    if (currentContact.custom_fields) {
        try {
            const customFields = JSON.parse(currentContact.custom_fields);
            console.log('  Custom fields:', customFields);
        } catch (e) {
            console.log('  Failed to parse custom fields:', e);
        }
    }
    
    console.log('=== END DEBUG ===');
}

// Settings functions
function showSettings() {
    // Load current settings
    loadSettings();
    
    // Show the settings modal
    const modal = new bootstrap.Modal(document.getElementById('settingsModal'));
    modal.show();
}

function loadSettings() {
    // Load printer settings
    document.getElementById('printerName').value = 'RX106HD';
    document.getElementById('labelSize').value = '4x6';
    document.getElementById('printerDpi').value = '203';
    document.getElementById('foldOver').checked = true;
    document.getElementById('autoPrint').checked = true;
    document.getElementById('showPrinterInfo').checked = true;
    
    // Load app settings
    document.getElementById('searchLimit').value = '50';
    document.getElementById('searchDebounce').value = '250';
    document.getElementById('enablePerformanceLogging').checked = false;
    document.getElementById('enableDebugMode').checked = false;
}

function saveSettings() {
    // Save printer settings
    const printerSettings = {
        name: document.getElementById('printerName').value,
        labelSize: document.getElementById('labelSize').value,
        dpi: parseInt(document.getElementById('printerDpi').value),
        foldOver: document.getElementById('foldOver').checked,
        autoPrint: document.getElementById('autoPrint').checked,
        showPrinterInfo: document.getElementById('showPrinterInfo').checked
    };
    
    // Save app settings
    const appSettings = {
        searchLimit: parseInt(document.getElementById('searchLimit').value),
        searchDebounce: parseInt(document.getElementById('searchDebounce').value),
        enablePerformanceLogging: document.getElementById('enablePerformanceLogging').checked,
        enableDebugMode: document.getElementById('enableDebugMode').checked
    };
    
    // Save to localStorage for now (in a real app, this would go to the backend)
    localStorage.setItem('printerSettings', JSON.stringify(printerSettings));
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    
    showSuccess('Settings saved successfully!');
    
    // Close the modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
    modal.hide();
}

function getPrinterSettings() {
    const saved = localStorage.getItem('printerSettings');
    if (saved) {
        return JSON.parse(saved);
    }
    return {
        name: 'RX106HD',
        labelSize: '4x6',
        dpi: 203,
        foldOver: true,
        autoPrint: true,
        showPrinterInfo: true
    };
}

// Add this to the global scope so it can be called from console
window.debugAvailableFields = debugAvailableFields;

// Duplicate template function
async function duplicateTemplate() {
    if (!currentDesignerTemplate) {
        showError('No template to duplicate. Please load a template first.');
        return;
    }
    
    // Prompt for new template name
    const newName = prompt('Enter a name for the duplicated template:', `${currentDesignerTemplate.name} (Copy)`);
    
    if (!newName || newName.trim() === '') {
        return; // User cancelled or entered empty name
    }
    
    try {
        // Create duplicate template data
        const duplicateData = {
            name: newName.trim(),
            description: `${currentDesignerTemplate.description || ''} (Copy)`,
            config: { ...currentDesignerTemplate.config }
        };
        
        // Save the duplicate template
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(duplicateData)
        });
        
        if (response.ok) {
            const savedTemplate = await response.json();
            showSuccess(`Template "${newName}" duplicated successfully!`);
            
            // Load the duplicated template
            currentDesignerTemplate = savedTemplate;
            renderCanvas();
            updateTemplateInfo();
            
            // Refresh templates list if visible
            if (document.getElementById('templatesSection').style.display !== 'none') {
                await loadTemplates();
            }
        } else {
            const error = await response.json();
            showError(`Failed to duplicate template: ${error.error}`);
        }
    } catch (error) {
        console.error('Error duplicating template:', error);
        showError('Failed to duplicate template. Please try again.');
    }
}

// Export template function
async function exportTemplate() {
    if (!currentDesignerTemplate) {
        showError('No template to export. Please load a template first.');
        return;
    }
    
    try {
        // Create export data
        const exportData = {
            ...currentDesignerTemplate,
            exported_at: new Date().toISOString(),
            version: '1.0'
        };
        
        // Create blob and download
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentDesignerTemplate.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccess(`Template "${currentDesignerTemplate.name}" exported successfully!`);
    } catch (error) {
        console.error('Error exporting template:', error);
        showError('Failed to export template. Please try again.');
    }
}

// Import template function
async function importTemplate() {
    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const templateData = JSON.parse(text);
            
            // Validate template data
            if (!templateData.name || !templateData.config || !templateData.config.elements) {
                showError('Invalid template file. Please select a valid template JSON file.');
                return;
            }
            
            // Check if template with same name already exists
            const existingTemplates = await fetch('/api/templates').then(r => r.json());
            const nameExists = existingTemplates.some(t => t.name === templateData.name);
            
            let finalName = templateData.name;
            if (nameExists) {
                const newName = prompt(
                    `Template "${templateData.name}" already exists. Enter a new name:`,
                    `${templateData.name} (Imported)`
                );
                if (!newName || newName.trim() === '') return;
                finalName = newName.trim();
            }
            
            // Prepare template for import
            const importData = {
                name: finalName,
                description: templateData.description || `${templateData.name} (Imported)`,
                config: templateData.config
            };
            
            // Import the template
            const response = await fetch('/api/templates/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ templateData: importData })
            });
            
            if (response.ok) {
                const savedTemplate = await response.json();
                showSuccess(`Template "${finalName}" imported successfully!`);
                
                // Load the imported template
                currentDesignerTemplate = savedTemplate;
                renderCanvas();
                updateTemplateInfo();
                
                // Refresh templates list if visible
                if (document.getElementById('templatesSection').style.display !== 'none') {
                    await loadTemplates();
                }
            } else {
                const error = await response.json();
                showError(`Failed to import template: ${error.error}`);
            }
        } catch (error) {
            console.error('Error importing template:', error);
            showError('Failed to import template. Please check the file format.');
        } finally {
            // Clean up
            document.body.removeChild(fileInput);
        }
    });
    
    // Trigger file selection
    document.body.appendChild(fileInput);
    fileInput.click();
}

// Export template by ID function (for templates list)
async function exportTemplateById(templateId) {
    try {
        // Fetch the template data
        const response = await fetch(`/api/templates/${templateId}`);
        if (!response.ok) {
            showError('Failed to fetch template data.');
            return;
        }
        
        const template = await response.json();
        
        // Create export data
        const exportData = {
            ...template,
            exported_at: new Date().toISOString(),
            version: '1.0'
        };
        
        // Create blob and download
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${template.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccess(`Template "${template.name}" exported successfully!`);
    } catch (error) {
        console.error('Error exporting template:', error);
        showError('Failed to export template. Please try again.');
    }
}

// ====================================
// CANVA IMPORT FUNCTIONALITY
// ====================================

// Show Canva import modal
function showCanvaImport() {
    const modal = new bootstrap.Modal(document.getElementById('canvaImportModal'));
    modal.show();
    
    // Reset the form
    document.getElementById('canvaFile').value = '';
    document.getElementById('canvaTemplateName').value = '';
    document.getElementById('canvaTemplateDescription').value = '';
    document.getElementById('canvaPreview').classList.add('d-none');
    document.getElementById('canvaFieldMapping').classList.add('d-none');
    document.getElementById('importCanvaDesign').disabled = true;
    
    // Set up event listeners for this modal session
    setupCanvaImportListeners();
}

// Set up Canva import event listeners
function setupCanvaImportListeners() {
    const fileInput = document.getElementById('canvaFile');
    const importBtn = document.getElementById('importCanvaDesign');
    
    // File input change handler
    fileInput.removeEventListener('change', handleCanvaFileUpload); // Remove any existing listener
    fileInput.addEventListener('change', handleCanvaFileUpload);
    
    // Import button handler
    importBtn.removeEventListener('click', processCanvaImport); // Remove any existing listener
    importBtn.addEventListener('click', processCanvaImport);
}

// Handle Canva file upload and preview
async function handleCanvaFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    
    try {
        if (fileName.endsWith('.svg') || fileType === 'image/svg+xml') {
            await processSVGFile(file);
        } else if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
            await processPDFFile(file);
        } else {
            showError('Please upload an SVG or PDF file.');
            return;
        }
        
        // Set default template name from filename
        const templateNameInput = document.getElementById('canvaTemplateName');
        if (!templateNameInput.value) {
            const baseName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
            templateNameInput.value = `${baseName} (Canva Import)`;
        }
        
        // Enable import button
        document.getElementById('importCanvaDesign').disabled = false;
        
    } catch (error) {
        console.error('Error processing file:', error);
        showError('Failed to process the uploaded file. Please check the format and try again.');
    }
}

// Process SVG file from Canva
async function processSVGFile(file) {
    const text = await file.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, 'image/svg+xml');
    
    // Check for parsing errors
    const parseError = svgDoc.querySelector('parsererror');
    if (parseError) {
        throw new Error('Invalid SVG file');
    }
    
    // Extract text elements and find placeholders
    const textElements = svgDoc.querySelectorAll('text, tspan');
    const placeholderFields = [];
    const processedElements = [];
    
    // Get SVG dimensions
    const svgElement = svgDoc.querySelector('svg');
    const viewBox = svgElement.getAttribute('viewBox');
    let svgWidth = 4, svgHeight = 6; // Default 4x6 inches
    
    if (viewBox) {
        const [, , width, height] = viewBox.split(' ').map(Number);
        svgWidth = width / 72; // Convert points to inches (assuming 72 DPI)
        svgHeight = height / 72;
    }
    
    // Process each text element
    textElements.forEach((element, index) => {
        const textContent = element.textContent || '';
        const rect = element.getBBox ? element.getBBox() : { x: 0, y: 0, width: 100, height: 20 };
        
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
            x: (rect.x || 0) / 72, // Convert to inches
            y: (rect.y || 0) / 72,
            width: (rect.width || 100) / 72,
            height: (rect.height || 20) / 72,
            fontSize: parseInt(getComputedStyle(element)['font-size']) || 12,
            color: getComputedStyle(element)['fill'] || '#000000',
            align: 'left',
            bold: getComputedStyle(element)['font-weight'] === 'bold'
        };
        
        processedElements.push(templateElement);
    });
    
    // Show preview
    showCanvaPreview(text, 'svg');
    
    // Show field mapping
    showFieldMapping(placeholderFields);
    
    // Store the processed data for import
    window.canvaImportData = {
        elements: processedElements,
        width: svgWidth,
        height: svgHeight,
        originalFormat: 'svg',
        originalContent: text
    };
}

// Process PDF file from Canva (basic implementation)
async function processPDFFile(file) {
    // For now, we'll provide a basic PDF import that creates a single image element
    // A full PDF text extraction would require pdf.js library
    
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            
            // Create a basic template with an image placeholder
            const templateElement = {
                type: 'image',
                id: 'canva_pdf_image',
                content: 'PDF Import',
                x: 0,
                y: 0,
                width: 4,
                height: 6,
                imageData: arrayBuffer
            };
            
            // Show basic preview
            showCanvaPreview('PDF imported - manual field mapping required', 'pdf');
            
            // Show info about manual field setup
            const fieldMappingDiv = document.getElementById('canvaFieldMapping');
            fieldMappingDiv.innerHTML = `
                <h6>PDF Import Notice:</h6>
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    PDF imports require manual field setup. After importing, use the Label Designer to add text fields and map them to contact data.
                </div>
            `;
            fieldMappingDiv.classList.remove('d-none');
            
            // Store the processed data
            window.canvaImportData = {
                elements: [templateElement],
                width: 4,
                height: 6,
                originalFormat: 'pdf',
                originalContent: arrayBuffer
            };
            
            resolve();
        };
        
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Show preview of the imported design
function showCanvaPreview(content, format) {
    const previewDiv = document.getElementById('canvaPreview');
    const previewContent = document.getElementById('canvaPreviewContent');
    
    if (format === 'svg') {
        // Display SVG directly
        previewContent.innerHTML = content;
        
        // Scale SVG to fit preview area
        const svg = previewContent.querySelector('svg');
        if (svg) {
            svg.style.width = '100%';
            svg.style.maxHeight = '300px';
            svg.style.border = '1px solid #ddd';
        }
    } else {
        // For PDF or other formats
        previewContent.innerHTML = `<div class="text-center p-4 bg-light border rounded">${content}</div>`;
    }
    
    previewDiv.classList.remove('d-none');
}

// Show detected field mapping
function showFieldMapping(fields) {
    const fieldMappingDiv = document.getElementById('canvaFieldMapping');
    const fieldCountSpan = document.getElementById('fieldCount');
    const detectedFieldsDiv = document.getElementById('detectedFields');
    
    fieldCountSpan.textContent = fields.length;
    
    if (fields.length > 0) {
        const fieldList = fields.map(field => `<span class="badge bg-primary me-1">{{${field}}}</span>`).join('');
        detectedFieldsDiv.innerHTML = `<div class="mt-2"><strong>Detected fields:</strong><br>${fieldList}</div>`;
    } else {
        detectedFieldsDiv.innerHTML = `<div class="mt-2 text-muted">No placeholder fields detected. You can add them manually after import.</div>`;
    }
    
    fieldMappingDiv.classList.remove('d-none');
}

// Process the Canva import and create template
async function processCanvaImport() {
    const templateName = document.getElementById('canvaTemplateName').value.trim();
    const templateDescription = document.getElementById('canvaTemplateDescription').value.trim();
    
    if (!templateName) {
        showError('Please enter a template name.');
        return;
    }
    
    if (!window.canvaImportData) {
        showError('No design data to import. Please upload a file first.');
        return;
    }
    
    try {
        // Create template in the app's format
        const templateData = {
            name: templateName,
            description: templateDescription || `Imported from Canva (${window.canvaImportData.originalFormat.toUpperCase()})`,
            config: {
                width: window.canvaImportData.width,
                height: window.canvaImportData.height,
                foldOver: true, // Default to fold-over for 4x6 labels
                elements: window.canvaImportData.elements
            }
        };
        
        // Save the template
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(templateData)
        });
        
        if (response.ok) {
            const savedTemplate = await response.json();
            showSuccess(`Template "${templateName}" imported from Canva successfully!`);
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('canvaImportModal'));
            modal.hide();
            
            // Refresh templates list if visible
            if (document.getElementById('templatesModal').classList.contains('show')) {
                await loadTemplates();
            }
            
            // Clean up
            delete window.canvaImportData;
            
        } else {
            const error = await response.json();
            showError(`Failed to import template: ${error.error}`);
        }
        
    } catch (error) {
        console.error('Error importing Canva design:', error);
        showError('Failed to import design. Please try again.');
    }
}

// ====================================
// DOWNLOAD FIELDS LIST FUNCTIONALITY
// ====================================

// Download a text file with all available fields
async function downloadFieldsList() {
    try {
        // Get the exact same fields that appear in the CSV Field dropdown
        let allFields = [];
        
        if (!currentEvent) {
            showError('Please select an event first to see available fields.');
            return;
        }

        try {
            // Fetch the exact same CSV headers that the app uses for the dropdown
            const response = await fetch(`/api/events/${currentEvent.id}/csv-headers`);
            if (response.ok) {
                const headers = await response.json();
                console.log('CSV Headers from API:', headers);
                console.log('Headers type:', typeof headers);
                console.log('Headers is array:', Array.isArray(headers));
                
                // Backend now returns a proper array of headers
                let headerList = [];
                if (Array.isArray(headers)) {
                    headerList = headers;
                } else {
                    console.error('Expected array but received:', typeof headers, headers);
                    throw new Error('Backend returned invalid headers format - expected array');
                }
                
                console.log('Final header list:', headerList);
                
                // Create the exact same fields that appear in the CSV Field dropdown
                allFields = headerList.map(header => `{{${header}}} - CSV field from your data`);
                
                // Add the standard event fields that are always available
                allFields.push('');
                allFields.push('--- STANDARD EVENT FIELDS ---');
                allFields.push('{{eventName}} - Name of the current event');
                allFields.push('{{eventDate}} - Date of the current event');
                allFields.push('{{printDate}} - Date and time when the label was printed');
                
            } else {
                throw new Error('Could not fetch CSV headers');
            }
        } catch (error) {
            console.error('Error fetching CSV headers:', error);
            showError('Could not fetch field list. Make sure an event with CSV data is loaded.');
            return;
        }

        // Create the file content
        const fileContent = `CREDENTIALING APP - AVAILABLE FIELDS FOR CANVA TEMPLATES
Generated: ${new Date().toLocaleString()}
${currentEvent ? `Current Event: ${currentEvent.name}` : 'No event selected'}

INSTRUCTIONS:
============
Use these field names in your Canva designs exactly as shown (including the curly braces).
When you import your design, these placeholders will automatically be replaced with actual contact data.

EXAMPLE CANVA TEXT ELEMENTS:
===========================
Hello, My Name Is
{{firstName}} {{lastName}}

{{eventName}}
{{eventDate}}

Contact: {{phone}}
{{email}}

AVAILABLE FIELDS:
================
${allFields.join('\n')}

USAGE TIPS:
===========
1. Design your label in Canva (4" × 6" recommended)
2. Use the field names above exactly as shown
3. Export as SVG from Canva
4. Import using "Import from Canva" button
5. The app will automatically detect and map your fields

For more help, see the Import from Canva instructions in the app.
`;

        // Create and download the file
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `canva-fields-list-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showSuccess('Field list downloaded successfully! Check your Downloads folder.');

    } catch (error) {
        console.error('Error downloading fields list:', error);
        showError('Failed to download fields list. Please try again.');
    }
}
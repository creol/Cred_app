// Global state
let currentEvent = null;
let currentContact = null;
let currentTemplate = null;
let searchTimeout = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadEvents();
    loadTemplates(); // Load templates on startup
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

    // Show Template Editor button
    const showTemplateEditorBtn = document.getElementById('showTemplateEditorBtn');
    if (showTemplateEditorBtn) {
        showTemplateEditorBtn.addEventListener('click', showTemplateEditor);
    }

    const showLabelDesignerBtn = document.getElementById('showLabelDesignerBtn');
    if (showLabelDesignerBtn) {
        showLabelDesignerBtn.addEventListener('click', showLabelDesigner);
    }

    // Import Template button
    const importTemplateBtn = document.getElementById('importTemplateBtn');
    if (importTemplateBtn) {
        importTemplateBtn.addEventListener('click', importTemplate);
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
    if (!currentEvent) return;
    
    try {
        const response = await fetch(`/api/templates/event/${currentEvent.id}`);
        if (response.ok) {
            const templates = await response.json();
            if (templates.length > 0) {
                // Set the event template as current template
                currentTemplate = templates[0];
                console.log('Loaded event template:', currentTemplate.name);
            }
        }
    } catch (error) {
        console.warn('Failed to load event template:', error);
    }
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
                updateEventDisplay();
                loadStatistics();
                
                // Load the event template
                await loadEventTemplate();
                
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
                updateEventDisplay();
                // Don't load statistics for ended events - clear them instead
                clearStats();
                
                // Load the event template
                await loadEventTemplate();
                
                // Always show event history when no active events
                showEventHistory(events);
            }
        } else {
            // No events - clear everything
            currentEvent = null;
            currentTemplate = null;
            updateEventDisplay();
            clearSearch();
            hideContactPanel();
            clearStats(); // Clear stats when no events exist
            
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
        
        // Generate label preview (but don't fail if it doesn't work)
        try {
            await generateLabelPreview(contact);
        } catch (previewError) {
            console.error('Label preview failed:', previewError);
            // Continue with contact display even if preview fails
        }
        
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
function showDetailedPreview() {
    if (!currentContact || !currentTemplate) {
        showError('No contact or template selected for preview');
        return;
    }
    
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
    
    // Generate PDF preview
    const pdfBlob = generatePdf(currentTemplate, contactData);
    
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
        
        // Create contact data object for PDF generation
        const pdfContactData = {
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
        
        // Generate PDF for printing
        const pdfBlob = generatePdf(currentTemplate, pdfContactData);
        
        // Show PDF preview modal for printing
        showPdfPreviewForPrinting(pdfBlob, currentTemplate.name || 'Credential');
        
        // Mark as credentialed in the database
        await markContactAsCredentialed();
        
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
            
            // Save the selected template to the current event if we have one
            if (currentEvent) {
                try {
                    const saveResponse = await fetch(`/api/templates/event/${currentEvent.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(template)
                    });
                    
                    if (saveResponse.ok) {
                        console.log('Template saved to event successfully');
                        showSuccess(`Template "${template.name}" selected and saved to event!`);
                    } else {
                        console.warn('Failed to save template to event');
                        showSuccess(`Template "${template.name}" selected!`);
                    }
                } catch (e) {
                    console.warn('Failed to save template to event:', e);
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
        const response = await fetch('/api/templates');
        const templates = await response.json();
        
        const templatesList = document.getElementById('templatesList');
        templatesList.innerHTML = templates.map(template => `
            <div class="card mb-2 ${currentTemplate && currentTemplate.id === template.id ? 'border-success' : ''}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${template.name}</h6>
                            <small class="text-muted">${template.description}</small>
                            ${currentTemplate && currentTemplate.id === template.id ? '<br><small class="text-success"><i class="fas fa-check-circle"></i> Currently Selected</small>' : ''}
                        </div>
                        <div>
                            ${template.is_default ? '<span class="badge bg-primary">Default</span>' : ''}
                            ${currentTemplate && currentTemplate.id === template.id ? 
                                '<span class="badge bg-success">Selected</span>' : 
                                `<button class="btn btn-sm btn-success" onclick="selectTemplate('${template.id}')" title="Select this template for printing">
                                    <i class="fas fa-check"></i> Select
                                </button>`
                            }
                            <button class="btn btn-sm btn-outline-primary" onclick="editTemplate('${template.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate('${template.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Automatically select the default template if none is selected
        if (!currentTemplate && templates.length > 0) {
            const defaultTemplate = templates.find(t => t.is_default) || templates[0];
            currentTemplate = defaultTemplate;
            console.log('Auto-selected template:', defaultTemplate.name);
        }
        
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
    // Simple success notification
    alert(`Success: ${message}`);
}

function showError(message) {
    // Simple error notification
    alert(`Error: ${message}`);
}

// Template management functions
function showTemplateEditor() {
    // Initialize with default template
    loadDefaultTemplate();
    
    // Show the label designer modal
    const modal = new bootstrap.Modal(document.getElementById('labelDesignerModal'));
    modal.show();
    
    // Setup canvas event listeners
    setupCanvasEventListeners();
    
    // Setup tool buttons
    setupToolButtons();
}

async function editTemplate(templateId) {
    try {
        // Load the specific template
        const response = await fetch(`/api/templates/${templateId}`);
        if (response.ok) {
            const template = await response.json();
            currentDesignerTemplate = template;
            
            // Show the label designer modal
            const modal = new bootstrap.Modal(document.getElementById('labelDesignerModal'));
            modal.show();
            
            // Render the template
            renderCanvas();
            updateTemplateInfo();
            
            // Setup canvas event listeners
            setupCanvasEventListeners();
            
            // Setup tool buttons
            setupToolButtons();
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
            
            // Render the template
            renderCanvas();
            updateTemplateInfo();
            
            // Setup canvas event listeners
            setupCanvasEventListeners();
            
            // Setup tool buttons
            setupToolButtons();
            
            showSuccess('Template imported successfully! You can now edit and save it.');
            
        } catch (error) {
            console.error('Failed to import template:', error);
            showError('Failed to import template. Please check the file format.');
        }
    };
    
    fileInput.click();
}

// Label Designer functionality
let currentDesignerTemplate = null;
let selectedElement = null;
let canvasElements = [];

function showLabelDesigner() {
    // Initialize with default template or current event template
    if (currentEvent) {
        loadEventTemplate();
    } else {
        loadDefaultTemplate();
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('labelDesignerModal'));
    modal.show();
    
    // Setup canvas event listeners
    setupCanvasEventListeners();
    
    // Setup tool buttons
    setupToolButtons();
}

function loadDefaultTemplate() {
    currentDesignerTemplate = {
        name: 'Hello My Name Is',
        description: 'Standard 4x6 fold-over name badge template',
        config: {
            width: 4,
            height: 6,
            foldOver: true,
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
}

async function loadEventTemplate() {
    try {
        const response = await fetch(`/api/templates/event/${currentEvent.id}`);
        if (response.ok) {
            const templates = await response.json();
            if (templates.length > 0) {
                currentDesignerTemplate = templates[0];
            } else {
                // Create new event template based on default
                currentDesignerTemplate = {
                    name: `${currentEvent.name} Template`,
                    description: `Custom template for ${currentEvent.name}`,
                    event_id: currentEvent.id,
                    config: {
                        width: 4,
                        height: 6,
                        foldOver: true,
                        elements: []
                    }
                };
            }
        } else {
            loadDefaultTemplate();
        }
    } catch (error) {
        console.error('Failed to load event template:', error);
        loadDefaultTemplate();
    }
    
    renderCanvas();
    updateTemplateInfo();
}

function renderCanvas() {
    const canvas = document.getElementById('labelCanvas');
    canvas.innerHTML = '';
    
    if (!currentDesignerTemplate || !currentDesignerTemplate.config.elements) {
        return;
    }
    
    currentDesignerTemplate.config.elements.forEach(element => {
        const elementDiv = createCanvasElement(element);
        canvas.appendChild(elementDiv);
    });
}

function createCanvasElement(element) {
    const div = document.createElement('div');
    div.className = 'canvas-element';
    div.id = `element-${element.id}`;
    div.style.cssText = `
        position: absolute;
        left: ${element.x * 100}px;
        top: ${element.y * 100}px;
        width: ${element.width * 100}px;
        height: ${element.height * 100}px;
        border: 2px dashed #ccc;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.9);
        font-size: ${element.fontSize || 12}px;
        font-weight: ${element.bold ? 'bold' : 'normal'};
        text-align: ${element.align || 'left'};
        color: ${element.color || '#000000'};
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
    
    // Preview button
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            showPdfPreview();
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

// Get available CSV fields for the current event
async function getAvailableCSVFields() {
    if (!currentEvent) return [];
    
    // Standard fields that are always available
    const standardFields = [
        'firstName', 'lastName', 'middleName', 'birthDate', 
        'address', 'city', 'state', 'zip', 'phone', 'email',
        'eventName', 'eventDate'
    ];
    
    // Get custom fields from all contacts in the current event
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
                            if (!standardFields.includes(key)) {
                                allCustomFields.add(key);
                            }
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
    
    return [...standardFields, ...customFields];
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
        if (currentDesignerTemplate.event_id) {
            // Save as event-specific template
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
            eventDate: '2024-01-01'
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

function generatePdf(template, contactData) {
    // Create new PDF document (4" x 6" = 288 x 432 points)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [288, 432] // 4" x 6"
    });
    
    // Set default font
    doc.setFont('helvetica');
    
    // Process each element in the template
    template.config.elements.forEach(element => {
        const x = element.x * 72; // Convert inches to points
        const y = element.y * 72;
        const width = element.width * 72;
        const height = element.height * 72;
        
        if (element.type === 'text') {
            // Process text content with placeholders
            let content = element.content || '';
            
            // Replace placeholders with actual data
            content = content.replace(/\{\{firstName\}\}/g, contactData.firstName || '');
            content = content.replace(/\{\{lastName\}\}/g, contactData.lastName || '');
            content = content.replace(/\{\{middleName\}\}/g, contactData.middleName || '');
            content = content.replace(/\{\{birthDate\}\}/g, contactData.birthDate || '');
            content = content.replace(/\{\{address\}\}/g, contactData.address || '');
            content = content.replace(/\{\{city\}\}/g, contactData.city || '');
            content = content.replace(/\{\{state\}\}/g, contactData.state || '');
            content = content.replace(/\{\{zip\}\}/g, contactData.zip || '');
            content = content.replace(/\{\{phone\}\}/g, contactData.phone || '');
            content = content.replace(/\{\{email\}\}/g, contactData.email || '');
            content = content.replace(/\{\{eventName\}\}/g, contactData.eventName || '');
            content = content.replace(/\{\{eventDate\}\}/g, contactData.eventDate || '');
            
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
            
            // Set text alignment
            let textX = x;
            if (element.align === 'center') {
                textX = x + (width / 2);
                doc.text(content, textX, y + fontSize, { align: 'center' });
            } else if (element.align === 'right') {
                textX = x + width;
                doc.text(content, textX, y + fontSize, { align: 'right' });
            } else {
                doc.text(content, textX, y + fontSize);
            }
            
            // Reset font to normal
            doc.setFont('helvetica', 'normal');
            
        } else if (element.type === 'checkbox') {
            // Draw checkbox
            doc.rect(x, y, 20, 20);
            if (element.checked) {
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
                
                // Add image to PDF
                doc.addImage(imageData, imageType, x, y, width, height);
            } catch (error) {
                console.error('Failed to add image to PDF:', error);
                // Fallback to placeholder
                doc.rect(x, y, width, height);
                doc.setFontSize(10);
                doc.text('[Image Error]', x + (width / 2), y + (height / 2), { align: 'center' });
            }
        } else if (element.type === 'image') {
            // Fallback for images without data
            doc.rect(x, y, width, height);
            doc.setFontSize(10);
            doc.text('[No Image]', x + (width / 2), y + (height / 2), { align: 'center' });
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

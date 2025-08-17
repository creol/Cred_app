// Global state
let currentEvent = null;
let currentContact = null;
let currentTemplate = null;
let searchTimeout = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadEvents();
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
                 loadStatistics();
                 
                 // Always show event history when no active events
                 showEventHistory(events);
             }
        } else {
            // No events - clear everything
            currentEvent = null;
            updateEventDisplay();
            clearSearch();
            hideContactPanel();
            
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
        } else {
            const result = await response.json();
            showError(result.error || 'Failed to end event.');
        }
    } catch (error) {
        console.error('Failed to end event:', error);
        showError('Failed to end event. Please try again.');
    }
}

// Reset an event (clear all contacts and credentials)
async function resetEvent(eventId, eventName) {
    const confirmation = prompt(`To reset the event "${eventName}", please type RESET in all caps:`);
    
    if (confirmation !== 'RESET') {
        if (confirmation !== null) { // User didn't cancel
            showError('Reset cancelled. You must type RESET exactly.');
        }
        return;
    }
    
    if (!confirm(`Are you sure you want to reset the event "${eventName}"? This will clear all contacts and credentials but keep the event. This action cannot be undone.`)) {
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
        // Load default template if not already loaded
        if (!currentTemplate) {
            const response = await fetch('/api/templates/default');
            if (response.ok) {
                currentTemplate = await response.json();
            } else {
                console.error('No default template available');
                displayLabelPreview({ preview: { elements: [] } });
                return;
            }
        }
        
        // Create preview data
        const previewData = {
            firstName: contact.first_name,
            lastName: contact.last_name,
            middleName: contact.middle_name,
            birthDate: contact.birth_date,
            address: contact.address,
            city: contact.city,
            state: contact.state,
            zip: contact.zip,
            phone: contact.phone,
            email: contact.email,
            eventName: currentEvent.name,
            eventDate: currentEvent.date
        };
        
        // Generate preview
        const response = await fetch(`/api/templates/${currentTemplate.id}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sampleData: previewData })
        });
        
        if (response.ok) {
            const preview = await response.json();
            displayLabelPreview(preview);
        } else {
            console.error('Template preview failed');
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
    const previewDiv = document.getElementById('labelPreview');
    
    if (preview.preview && preview.preview.elements) {
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
            }
        });
        previewHtml += '</div>';
        previewDiv.innerHTML = previewHtml;
    } else {
        previewDiv.innerHTML = '<small class="text-muted">Preview not available</small>';
    }
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
        
        const response = await fetch('/api/printing/print-credential', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contactId: currentContact.id,
                eventId: currentEvent.id,
                templateId: currentTemplate.id,
                contactData: contactData
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('Credential printed successfully!');
            
            // Update contact status
            currentContact.isCredentialed = true;
            displayContact(currentContact);
            
            // Refresh statistics
            loadStatistics();
            
            // Show search results again and focus for next person
            showSearchResults();
            document.getElementById('searchInput').focus();
        } else {
            showError(result.error || 'Printing failed.');
        }
    } catch (error) {
        console.error('Printing failed:', error);
        showError('Printing failed. Please try again.');
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
    if (!currentContact) return;
    
    try {
        const formData = new FormData(document.getElementById('contactForm'));
        const contactData = Object.fromEntries(formData.entries());
        
        const response = await fetch(`/api/contacts/${currentContact.id}`, {
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
    } catch (error) {
        console.error('Failed to update contact:', error);
        showError('Failed to update contact. Please try again.');
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

// Load templates
async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        const templates = await response.json();
        
        const templatesList = document.getElementById('templatesList');
        templatesList.innerHTML = templates.map(template => `
            <div class="card mb-2">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${template.name}</h6>
                            <small class="text-muted">${template.description}</small>
                        </div>
                        <div>
                            ${template.is_default ? '<span class="badge bg-primary">Default</span>' : ''}
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

// Placeholder functions for template management
function showTemplateEditor() {
    alert('Template editor coming soon!');
}

function editTemplate(templateId) {
    alert(`Edit template ${templateId} - coming soon!`);
}

function deleteTemplate(templateId) {
    if (confirm('Are you sure you want to delete this template?')) {
        alert(`Delete template ${templateId} - coming soon!`);
    }
}

function importTemplate() {
    alert('Template import coming soon!');
}

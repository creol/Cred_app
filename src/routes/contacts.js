const express = require('express');
const moment = require('moment');

module.exports = function(database, config, logger) {
  const router = express.Router();

  // Search contacts with fuzzy search
  router.get('/search/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { q: query, limit = 50 } = req.query;
      
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }

      const startTime = Date.now();
      
      // Use database search for better performance
      const contacts = await database.searchContacts(eventId, query.trim(), parseInt(limit));
      
      // Check credentialing status for each contact
      const contactsWithStatus = await Promise.all(
        contacts.map(async (contact) => {
          const isCredentialed = await database.isContactCredentialed(contact.id, eventId);
          return {
            ...contact,
            isCredentialed,
            displayName: `${contact.last_name}, ${contact.first_name}`.trim(),
            addressDisplay: [contact.address, contact.city, contact.state, contact.zip]
              .filter(Boolean)
              .join(', ')
          };
        })
      );

      const duration = Date.now() - startTime;
      logger.logPerformance('contact_search', duration, { 
        eventId, 
        query, 
        resultCount: contactsWithStatus.length 
      });

      res.json(contactsWithStatus);
    } catch (error) {
      logger.error('Contact search failed', { 
        error: error.message, 
        eventId: req.params.eventId,
        query: req.query.q 
      });
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Get specific contact
  router.get('/:contactId', async (req, res) => {
    try {
      const contact = await database.getContact(req.params.contactId);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // Get credentialing status
      const isCredentialed = await database.isContactCredentialed(contact.id, contact.event_id);
      
      // Get credentials history
      const credentials = await database.getCredentialsByContact(contact.id);

      res.json({
        ...contact,
        isCredentialed,
        credentials,
        displayName: `${contact.last_name}, ${contact.first_name}`.trim(),
        addressDisplay: [contact.address, contact.city, contact.state, contact.zip]
          .filter(Boolean)
          .join(', ')
      });
    } catch (error) {
      logger.error('Failed to get contact', { 
        error: error.message, 
        contactId: req.params.contactId 
      });
      res.status(500).json({ error: 'Failed to get contact' });
    }
  });

  // Update contact
  router.put('/:contactId', async (req, res) => {
    try {
      const contactId = req.params.contactId;
      const contact = await database.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // Prepare update data
      const updateData = {
        first_name: req.body.first_name || contact.first_name,
        last_name: req.body.last_name || contact.last_name,
        middle_name: req.body.middle_name || contact.middle_name,
        birth_date: req.body.birth_date || contact.birth_date,
        address: req.body.address || contact.address,
        city: req.body.city || contact.city,
        state: req.body.state || contact.state,
        zip: req.body.zip || contact.zip,
        phone: req.body.phone || contact.phone,
        email: req.body.email || contact.email,
        custom_fields: req.body.custom_fields || contact.custom_fields
      };

      const updatedContact = await database.updateContact(contactId, updateData);
      
      logger.logCredentialing(contactId, 'contact_updated', {
        eventId: contact.event_id,
        changes: req.body
      });

      res.json(updatedContact);
    } catch (error) {
      logger.error('Failed to update contact', { 
        error: error.message, 
        contactId: req.params.contactId 
      });
      res.status(500).json({ error: 'Failed to update contact' });
    }
  });

  // Add new contact manually
  router.post('/:eventId', async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const event = await database.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const { 
        first_name, last_name, middle_name, birth_date, 
        address, city, state, zip, phone, email, custom_fields 
      } = req.body;

      if (!first_name || !last_name) {
        return res.status(400).json({ error: 'First name and last name are required' });
      }

      const contactData = {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        middle_name: middle_name?.trim() || '',
        birth_date: birth_date || '',
        address: address?.trim() || '',
        city: city?.trim() || '',
        state: state?.trim() || '',
        zip: zip?.trim() || '',
        phone: phone?.trim() || '',
        email: email?.trim() || '',
        custom_fields: custom_fields || {}
      };

      const newContact = await database.addContact(eventId, contactData);
      
      logger.logCredentialing(newContact.id, 'contact_added_manually', {
        eventId,
        contactData
      });

      res.status(201).json(newContact);
    } catch (error) {
      logger.error('Failed to add contact', { 
        error: error.message, 
        eventId: req.params.eventId 
      });
      res.status(500).json({ error: 'Failed to add contact' });
    }
  });

  // Get all contacts for an event
  router.get('/event/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { page = 1, limit = 100, sortBy = 'last_name', sortOrder = 'asc' } = req.query;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Validate sort fields
      const allowedSortFields = ['last_name', 'first_name', 'birth_date', 'city', 'state'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'last_name';
      const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      
      const sql = `
        SELECT * FROM contacts 
        WHERE event_id = ? 
        ORDER BY ${sortField} ${order}, last_name ASC, first_name ASC
        LIMIT ? OFFSET ?
      `;
      
      const contacts = await database.all(sql, [eventId, parseInt(limit), offset]);
      
      // Get total count for pagination
      const countResult = await database.get(
        'SELECT COUNT(*) as total FROM contacts WHERE event_id = ?',
        [eventId]
      );
      
      // Add credentialing status
      const contactsWithStatus = await Promise.all(
        contacts.map(async (contact) => {
          const isCredentialed = await database.isContactCredentialed(contact.id, eventId);
          return {
            ...contact,
            isCredentialed,
            displayName: `${contact.last_name}, ${contact.first_name}`.trim(),
            addressDisplay: [contact.address, contact.city, contact.state, contact.zip]
              .filter(Boolean)
              .join(', ')
          };
        })
      );

      res.json({
        contacts: contactsWithStatus,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / parseInt(limit))
        },
        sort: {
          field: sortField,
          order: order.toLowerCase()
        }
      });
    } catch (error) {
      logger.error('Failed to get event contacts', { 
        error: error.message, 
        eventId: req.params.eventId 
      });
      res.status(500).json({ error: 'Failed to get contacts' });
    }
  });

  // Get credentialed contacts for an event
  router.get('/event/:eventId/credentialed', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { page = 1, limit = 100, sortBy = 'printed_at', sortOrder = 'desc' } = req.query;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Validate sort fields
      const allowedSortFields = ['printed_at', 'last_name', 'first_name', 'birth_date'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'printed_at';
      const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      
      const sql = `
        SELECT c.*, cr.id as credential_id, cr.printed_at, cr.template_id, cr.status as credential_status
        FROM contacts c
        INNER JOIN credentials cr ON c.id = cr.contact_id
        WHERE c.event_id = ? AND cr.status = 'active'
        ORDER BY cr.${sortField} ${order}, c.last_name ASC, c.first_name ASC
        LIMIT ? OFFSET ?
      `;
      
      const contacts = await database.all(sql, [eventId, parseInt(limit), offset]);
      
      // Get total count for pagination
      const countResult = await database.get(`
        SELECT COUNT(*) as total 
        FROM credentials cr
        WHERE cr.event_id = ? AND cr.status = 'active'
      `, [eventId]);
      
      // Format contacts
      const formattedContacts = contacts.map(contact => ({
        ...contact,
        isCredentialed: true,
        displayName: `${contact.last_name}, ${contact.first_name}`.trim(),
        addressDisplay: [contact.address, contact.city, contact.state, contact.zip]
          .filter(Boolean)
          .join(', ')
      }));

      res.json({
        contacts: formattedContacts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / parseInt(limit))
        },
        sort: {
          field: sortField,
          order: order.toLowerCase()
        }
      });
    } catch (error) {
      logger.error('Failed to get credentialed contacts', { 
        error: error.message, 
        eventId: req.params.eventId 
      });
      res.status(500).json({ error: 'Failed to get credentialed contacts' });
    }
  });

  // Bulk update contacts (for CSV re-import scenarios)
  router.post('/:eventId/bulk-update', async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const { contacts } = req.body;
      
      if (!Array.isArray(contacts)) {
        return res.status(400).json({ error: 'Contacts must be an array' });
      }

      const event = await database.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const updateResults = [];
      
      for (const contactUpdate of contacts) {
        try {
          if (contactUpdate.id) {
            // Update existing contact
            const updatedContact = await database.updateContact(contactUpdate.id, contactUpdate);
            updateResults.push({ id: contactUpdate.id, status: 'updated', contact: updatedContact });
          } else {
            // Add new contact
            const newContact = await database.addContact(eventId, contactUpdate);
            updateResults.push({ id: newContact.id, status: 'added', contact: newContact });
          }
        } catch (contactError) {
          updateResults.push({ 
            id: contactUpdate.id || 'unknown', 
            status: 'error', 
            error: contactError.message 
          });
        }
      }

      logger.logCredentialing('bulk', 'bulk_contact_update', {
        eventId,
        totalContacts: contacts.length,
        results: updateResults
      });

      res.json({
        message: `Bulk update completed for ${contacts.length} contacts`,
        results: updateResults
      });
    } catch (error) {
      logger.error('Bulk contact update failed', { 
        error: error.message, 
        eventId: req.params.eventId 
      });
      res.status(500).json({ error: 'Bulk update failed' });
    }
  });

  // Delete contact (only if not credentialed)
  router.delete('/:contactId', async (req, res) => {
    try {
      const contactId = req.params.contactId;
      const contact = await database.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // Check if contact is credentialed
      const isCredentialed = await database.isContactCredentialed(contactId, contact.event_id);
      if (isCredentialed) {
        return res.status(400).json({ 
          error: 'Cannot delete credentialed contact. Un-credential first.' 
        });
      }

      // Delete contact
      await database.run('DELETE FROM contacts WHERE id = ?', [contactId]);
      
      logger.logCredentialing(contactId, 'contact_deleted', {
        eventId: contact.event_id,
        contactData: contact
      });

      res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete contact', { 
        error: error.message, 
        contactId: req.params.contactId 
      });
      res.status(500).json({ error: 'Failed to delete contact' });
    }
  });

  return router;
};

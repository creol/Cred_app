const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class Database {
  constructor(config) {
    this.config = config;
    this.dbPath = path.join(config.getDataDir(), 'credentials.db');
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      // Ensure data directory exists
      fs.ensureDirSync(path.dirname(this.dbPath));
      
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  async createTables() {
    const tables = [
      // Events table
      `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // Contacts table (working copy of CSV data)
      `CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        original_row INTEGER NOT NULL,
        first_name TEXT,
        last_name TEXT,
        middle_name TEXT,
        birth_date TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        phone TEXT,
        email TEXT,
        custom_fields TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events (id)
      )`,

      // Credentials table (tracking who has been credentialed)
      `CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        printed_at TEXT NOT NULL,
        printed_by TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (contact_id) REFERENCES contacts (id),
        FOREIGN KEY (event_id) REFERENCES events (id),
        FOREIGN KEY (template_id) REFERENCES templates (id)
      )`,

      // Templates table
      `CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config TEXT NOT NULL,
        is_default BOOLEAN DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // Audit log table
      `CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL
      )`,

      // CSV imports table
      `CREATE TABLE IF NOT EXISTS csv_imports (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        working_copy_path TEXT NOT NULL,
        record_count INTEGER NOT NULL,
        headers TEXT NOT NULL,
        import_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events (id)
      )`,

      // Exports table
      `CREATE TABLE IF NOT EXISTS exports (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        record_count INTEGER NOT NULL,
        export_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events (id)
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Run migrations for existing databases
    await this.runMigrations();

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_contacts_event_id ON contacts(event_id)',
      'CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(last_name, first_name)',
      'CREATE INDEX IF NOT EXISTS idx_contacts_birth_date ON contacts(birth_date)',
      'CREATE INDEX IF NOT EXISTS idx_credentials_contact_id ON credentials(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_credentials_event_id ON credentials(event_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }
    
    // Create default template if none exists
    await this.createDefaultTemplate();
  }

  // Run database migrations for existing databases
  async runMigrations() {
    try {
      // Check if events table exists and has status column
      const tableInfo = await this.all("PRAGMA table_info(events)");
      const hasStatusColumn = tableInfo.some(col => col.name === 'status');
      
      if (!hasStatusColumn) {
        console.log('🔄 Adding status column to events table...');
        await this.run('ALTER TABLE events ADD COLUMN status TEXT DEFAULT "active"');
        
        // Set all existing events to 'active' status
        await this.run('UPDATE events SET status = "active" WHERE status IS NULL');
        console.log('✅ Status column added successfully');
      }
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }

  // Database operations
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Event operations
  async createEvent(eventData) {
    const id = uuidv4();
    const now = moment().toISOString();
    
    // Set all other events to ended first (only one active event at a time)
    await this.run('UPDATE events SET status = ? WHERE status = ?', ['ended', 'active']);
    
    const sql = `
      INSERT INTO events (id, name, date, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      id, eventData.name, eventData.date, eventData.description || '', 'active', now, now
    ]);
    
    return { id, ...eventData, status: 'active', created_at: now, updated_at: now };
  }

  async getEvent(eventId) {
    return await this.get('SELECT * FROM events WHERE id = ?', [eventId]);
  }

  async getAllEvents() {
    return await this.all('SELECT * FROM events ORDER BY CASE WHEN status = "active" THEN 0 ELSE 1 END, date DESC');
  }

  async updateEvent(eventId, eventData) {
    const now = moment().toISOString();
    
    const sql = `
      UPDATE events 
      SET name = ?, date = ?, description = ?, updated_at = ?
      WHERE id = ?
    `;
    
    await this.run(sql, [
      eventData.name, eventData.date, eventData.description || '', now, eventId
    ]);
    
    return await this.getEvent(eventId);
  }

  // Contact operations
  async importContacts(eventId, contacts, csvImportId) {
    const contactIds = [];
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const id = uuidv4();
      const now = moment().toISOString();
      
      // Debug: Log the first contact to see field structure
      if (i === 0) {
        console.log('Sample contact data structure:', contact);
        console.log('Available keys:', Object.keys(contact));
      }
      
      // Extract common fields
      const contactData = {
        id,
        event_id: eventId,
        original_row: i + 1,
        first_name: contact.firstName || contact['First Name'] || contact['first_name'] || '',
        last_name: contact.lastName || contact['Last Name'] || contact['last_name'] || '',
        middle_name: contact.middleName || contact['Middle Name'] || contact['middle_name'] || '',
        birth_date: contact.birthDate || contact['Birth Date'] || contact['birth_date'] || '',
        address: contact.address || contact['Address'] || contact['address'] || '',
        city: contact.city || contact['City'] || contact['city'] || '',
        state: contact.state || contact['State'] || contact['state'] || '',
        zip: contact.zip || contact['ZIP'] || contact['zip'] || contact['Zip Code'] || contact['Zip'] || contact['zipcode'] || contact['ZIPCODE'] || '',
        phone: contact.phone || contact['Phone'] || contact['phone'] || contact['mobile'] || contact['Mobile'] || contact['cell'] || contact['Cell'] || '',
        email: contact.email || contact['Email'] || contact['email'] || '',
        custom_fields: JSON.stringify(contact),
        created_at: now,
        updated_at: now
      };
      
      const sql = `
        INSERT INTO contacts (
          id, event_id, original_row, first_name, last_name, middle_name,
          birth_date, address, city, state, zip, phone, email, custom_fields,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.run(sql, Object.values(contactData));
      contactIds.push(id);
    }
    
    return contactIds;
  }

  async searchContacts(eventId, query, limit = 50) {
    const searchQuery = `
      SELECT * FROM contacts 
      WHERE event_id = ? 
      AND (
        LOWER(first_name) LIKE LOWER(?) OR 
        LOWER(last_name) LIKE LOWER(?) OR 
        LOWER(birth_date) LIKE LOWER(?) OR
        LOWER(address) LIKE LOWER(?) OR
        LOWER(city) LIKE LOWER(?) OR
        LOWER(state) LIKE LOWER(?) OR
        LOWER(zip) LIKE LOWER(?)
      )
      ORDER BY last_name, first_name
      LIMIT ?
    `;
    
    const searchTerm = `%${query}%`;
    return await this.all(searchQuery, [
      eventId, searchTerm, searchTerm, searchTerm, searchTerm, 
      searchTerm, searchTerm, searchTerm, limit
    ]);
  }

  async getContact(contactId) {
    return await this.get('SELECT * FROM contacts WHERE id = ?', [contactId]);
  }

  async createDefaultTemplate() {
    try {
      // Check if any templates exist
      const existingTemplate = await this.get('SELECT COUNT(*) as count FROM templates');
      if (existingTemplate.count > 0) {
        return; // Templates already exist
      }

      // Create default template
      const defaultTemplate = {
        id: 'default-template',
        name: 'Default Credential',
        description: 'Standard 4x6 fold-over credential template',
        config: JSON.stringify({
          width: 4,
          height: 6,
          foldOver: true,
          elements: [
            {
              type: 'text',
              id: 'name',
              x: 0.5,
              y: 0.5,
              width: 3,
              height: 0.75,
              content: '{{firstName}} {{lastName}}',
              fontSize: 24,
              bold: true,
              align: 'center'
            },
            {
              type: 'text',
              id: 'event',
              x: 0.5,
              y: 1.5,
              width: 3,
              height: 0.5,
              content: '{{eventName}}',
              fontSize: 16,
              align: 'center'
            },
            {
              type: 'text',
              id: 'date',
              x: 0.5,
              y: 2.1,
              width: 3,
              height: 0.4,
              content: '{{eventDate}}',
              fontSize: 14,
              align: 'center'
            },
            {
              type: 'checkbox',
              id: 'credential',
              x: 1.5,
              y: 2.8,
              width: 0.3,
              height: 0.3,
              label: 'Credentialed'
            }
          ]
        }),
        is_default: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const sql = `
        INSERT INTO templates (
          id, name, description, config, is_default, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await this.run(sql, [
        defaultTemplate.id,
        defaultTemplate.name,
        defaultTemplate.description,
        defaultTemplate.config,
        defaultTemplate.is_default,
        defaultTemplate.created_at,
        defaultTemplate.updated_at
      ]);

      console.log('✅ Created default template');
    } catch (error) {
      console.error('Failed to create default template:', error);
    }
  }

  async updateContact(contactId, contactData) {
    const now = moment().toISOString();
    
    const sql = `
      UPDATE contacts 
      SET first_name = ?, last_name = ?, middle_name = ?, birth_date = ?,
          address = ?, city = ?, state = ?, zip = ?, phone = ?, email = ?,
          custom_fields = ?, updated_at = ?
      WHERE id = ?
    `;
    
    await this.run(sql, [
      contactData.first_name, contactData.last_name, contactData.middle_name,
      contactData.birth_date, contactData.address, contactData.city,
      contactData.state, contactData.zip, contactData.phone, contactData.email,
      contactData.custom_fields, now, contactId
    ]);
    
    return await this.getContact(contactId);
  }

  async addContact(eventId, contactData) {
    const id = uuidv4();
    const now = moment().toISOString();
    
    const sql = `
      INSERT INTO contacts (
        id, event_id, original_row, first_name, last_name, middle_name,
        birth_date, address, city, state, zip, phone, email, custom_fields,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      id, eventId, 0, contactData.first_name, contactData.last_name,
      contactData.middle_name, contactData.birth_date, contactData.address,
      contactData.city, contactData.state, contactData.zip, contactData.phone,
      contactData.email, contactData.custom_fields, now, now
    ]);
    
    return { id, ...contactData, created_at: now, updated_at: now };
  }

  // Credential operations
  async createCredential(credentialData) {
    const id = uuidv4();
    const now = moment().toISOString();
    
    const sql = `
      INSERT INTO credentials (
        id, contact_id, event_id, template_id, printed_at, printed_by,
        status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      id, credentialData.contact_id, credentialData.event_id,
      credentialData.template_id, credentialData.printed_at || now,
      credentialData.printed_by || 'system', credentialData.status || 'active',
      credentialData.notes || '', now, now
    ]);
    
    return { id, ...credentialData, created_at: now, updated_at: now };
  }

  async getCredential(credentialId) {
    return await this.get('SELECT * FROM credentials WHERE id = ?', [credentialId]);
  }

  async getCredentialsByContact(contactId) {
    return await this.all('SELECT * FROM credentials WHERE contact_id = ? ORDER BY created_at DESC', [contactId]);
  }

  async updateCredentialStatus(credentialId, status) {
    const now = moment().toISOString();
    
    const sql = `
      UPDATE credentials 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `;
    
    await this.run(sql, [status, now, credentialId]);
    return await this.getCredential(credentialId);
  }

  async isContactCredentialed(contactId, eventId) {
    const result = await this.get(`
      SELECT COUNT(*) as count FROM credentials 
      WHERE contact_id = ? AND event_id = ? AND status = 'active'
    `, [contactId, eventId]);
    
    return result.count > 0;
  }

  // Template operations
  async saveTemplate(templateData) {
    const id = templateData.id || uuidv4();
    const now = moment().toISOString();
    
    const sql = `
      INSERT OR REPLACE INTO templates (
        id, name, description, config, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      id, templateData.name, templateData.description || '',
      JSON.stringify(templateData.config), templateData.is_default || false,
      templateData.created_at || now, now
    ]);
    
    return { id, ...templateData, created_at: templateData.created_at || now, updated_at: now };
  }

  async getTemplate(templateId) {
    const template = await this.get('SELECT * FROM templates WHERE id = ?', [templateId]);
    if (template) {
      template.config = JSON.parse(template.config);
    }
    return template;
  }

  async getAllTemplates() {
    const templates = await this.all('SELECT * FROM templates ORDER BY name');
    return templates.map(t => ({
      ...t,
      config: JSON.parse(t.config)
    }));
  }

  async deleteTemplate(templateId) {
    await this.run('DELETE FROM templates WHERE id = ?', [templateId]);
  }

  // Audit logging
  async logAudit(auditData) {
    const id = uuidv4();
    const now = moment().toISOString();
    
    const sql = `
      INSERT INTO audit_log (
        id, user_id, action, entity_type, entity_id, details,
        ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      id, auditData.user_id || 'system', auditData.action,
      auditData.entity_type, auditData.entity_id || null,
      JSON.stringify(auditData.details || {}),
      auditData.ip_address || null, auditData.user_agent || null, now
    ]);
    
    return { id, ...auditData, created_at: now };
  }

  // CSV import tracking
  async recordCSVImport(importData) {
    const id = uuidv4();
    const now = moment().toISOString();
    
    const sql = `
      INSERT INTO csv_imports (
        id, event_id, original_filename, working_copy_path, record_count,
        headers, import_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      id, importData.event_id, importData.original_filename,
      importData.working_copy_path, importData.record_count,
      JSON.stringify(importData.headers), importData.import_date || now, now
    ]);
    
    return { id, ...importData, created_at: now };
  }

  // Export tracking
  async recordExport(exportData) {
    const id = uuidv4();
    const now = moment().toISOString();
    
    const sql = `
      INSERT INTO exports (
        id, event_id, filename, file_path, record_count, export_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      id, exportData.event_id, exportData.filename,
      exportData.file_path, exportData.record_count,
      exportData.export_date || now, now
    ]);
    
    return { id, ...exportData, created_at: now };
  }

  // Statistics
  async getEventStatistics(eventId) {
    const stats = await this.get(`
      SELECT 
        (SELECT COUNT(*) FROM contacts WHERE event_id = ?) as total_contacts,
        (SELECT COUNT(*) FROM credentials WHERE event_id = ? AND status = 'active') as credentialed_count,
        (SELECT COUNT(*) FROM contacts WHERE event_id = ? AND original_row = 0) as manually_added_count
    `, [eventId, eventId, eventId]);
    
    if (stats) {
      stats.credentialed_percentage = stats.total_contacts > 0 
        ? Math.round((stats.credentialed_count / stats.total_contacts) * 100)
        : 0;
    }
    
    return stats;
  }

  // Close database connection
  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;

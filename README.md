# Credentialing App

A professional credentialing application for events with label printing, template management, and comprehensive contact management.

## Features

- **Event Setup**: Configure events with CSV import
- **Label Designer**: Drag-and-drop design with fold-over layout for 4"×6" labels
- **Live Search**: Fuzzy search through contacts with instant results
- **Credentialing**: Print credentials with real-time status tracking
- **Template System**: Local save/load with GitHub sync capabilities
- **Statistics**: Real-time tracking of credentialing progress
- **Export Management**: CSV exports with audit logging

## Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- Windows PowerShell or macOS/Linux bash
- Comer RX106HD thermal printer (for label printing)

### Installation

#### Windows (PowerShell)
```powershell
# Clone and install
git clone https://github.com/creol/Cred_app.git
cd Cred_app
npm install
npm run install-app

# Start the application
npm start
```

#### macOS/Linux (bash)
```bash
# Clone and install
git clone https://github.com/creol/Cred_app.git
cd Cred_app
npm install
npm run install-app

# Start the application
npm start
```

The app will be available at `http://localhost:3000`

### Uninstall/Reset

#### Windows (PowerShell)
```powershell
npm run uninstall-app
```

#### macOS/Linux (bash)
```bash
npm run uninstall-app
```

**Note**: This will remove all app files, local database, and working data while preserving:
- Exported CSV files
- Saved label templates
- User configuration files

## Usage

### 1. Event Setup
- Enter Event Name and Date
- Import CSV with contact information
- The app creates a working copy, leaving your original CSV untouched

### 2. Label Design
- Use the drag-and-drop designer to create credential labels
- Configure ballot credential checkboxes
- Set up fold-over layout (4"×6" with upside-down half)
- Save templates locally or sync with GitHub

### 3. Credentialing
- Use live search to find contacts
- View instant label previews
- Edit contact information inline if needed
- Print credentials with one click
- Track credentialing status in real-time

### 4. Management
- View statistics and progress
- Export credentialing data
- Manage templates
- Access audit logs

## File Structure

```
CredentialsApp/
├── config/           # App configuration
├── data/            # Working CSV copies and exports
├── templates/       # Label templates
├── logs/           # Audit logs
└── cache/          # GitHub template cache
```

## Printer Setup

The app is configured for the **Comer RX106HD** thermal printer with **4"×6" fold-over** labels. The fold-over layout automatically renders one half upside-down so both sides read upright when folded.

## Performance

- Handles 2,000-5,000 contacts smoothly
- Live search: <250ms latency per keystroke
- Label preview: <100ms update time
- Print queue: <1 second processing

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## Support

For issues and questions:
1. Check the in-app Help section
2. Review the audit logs in the app directory
3. Check the console output for error details

## License

ISC License

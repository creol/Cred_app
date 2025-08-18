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

## Complete Windows Installation Guide

### Prerequisites Installation (Bare Windows Laptop)

#### Step 1: Install Git
1. **Download Git**: Go to https://git-scm.com/download/win
2. **Run the installer**: Download and run `Git-2.x.x-64-bit.exe`
3. **Installation options**:
   - Click "Next" through all defaults
   - Choose "Use Git from Git Bash and the Windows Command Prompt"
   - Choose "Use bundled OpenSSH"
   - Choose "Use the OpenSSL library"
   - Choose "Checkout as-is, commit Unix-style line endings"
   - Choose "Use Windows' default console window"
   - Click "Install"

#### Step 2: Install Node.js
1. **Download Node.js**: Go to https://nodejs.org/
2. **Download LTS version**: Click the "LTS" button (recommended)
3. **Run the installer**: Download and run `node-v18.x.x-x64.msi`
4. **Installation options**:
   - Click "Next" through all defaults
   - Ensure "Add to PATH" is checked
   - Click "Install"

#### Step 3: Install SumatraPDF (for printing)
1. **Download SumatraPDF**: Go to https://www.sumatrapdfreader.org/download-free-pdf-viewer
2. **Download portable version**: Click "Download SumatraPDF portable"
3. **Extract to user directory**:
   - Create folder: `C:\Users\[YourUsername]\AppData\Local\SumatraPDF\`
   - Extract `SumatraPDF.exe` to this folder
   - **Important**: The app expects SumatraPDF at this exact path

#### Step 4: Verify Installation
1. **Open PowerShell as Administrator**:
   - Press `Windows + X`
   - Select "Windows PowerShell (Admin)" or "Terminal (Admin)"

2. **Test Git**:
   ```powershell
   git --version
   ```
   Should show: `git version 2.x.x.windows.x`

3. **Test Node.js**:
   ```powershell
   node --version
   ```
   Should show: `v18.x.x` or higher

4. **Test npm**:
   ```powershell
   npm --version
   ```
   Should show: `9.x.x` or higher

### Application Installation

#### Step 1: Clone the Repository
1. **Open PowerShell** (regular, not admin)
2. **Navigate to desired location**:
   ```powershell
   cd C:\Users\[YourUsername]\Documents
   ```

3. **Clone the repository**:
   ```powershell
   git clone https://github.com/creol/Cred_app.git
   cd Cred_app
   ```

#### Step 2: Install Dependencies
```powershell
npm install
```

#### Step 3: Initialize the Application
```powershell
npm run install-app
```

#### Step 4: Start the Application
```powershell
npm start
```

The app will be available at `http://localhost:3000`

### Printer Setup

#### Comer RX106HD Thermal Printer
1. **Connect printer** via USB
2. **Install printer drivers** (if not auto-detected)
3. **Set as default printer** (optional, app will use it specifically)
4. **Load 4"×6" fold-over labels**

#### Alternative Printers
- The app will automatically fall back to your default printer
- Any printer that supports PDF printing will work
- For best results, use a thermal label printer

### Troubleshooting

#### Common Issues

**"npm is not recognized"**
- Restart PowerShell after Node.js installation
- Ensure Node.js was added to PATH during installation

**"git is not recognized"**
- Restart PowerShell after Git installation
- Ensure Git was added to PATH during installation

**"SumatraPDF not found"**
- Verify SumatraPDF is at: `C:\Users\[YourUsername]\AppData\Local\SumatraPDF\SumatraPDF.exe`
- Create the folder structure if it doesn't exist

**"Port 3000 already in use"**
- Close other applications using port 3000
- Or change the port in `src/server.js` line 18

**"Permission denied"**
- Run PowerShell as Administrator
- Or change the installation directory to a user-writable location

#### Reset/Uninstall
```powershell
# Stop the application (Ctrl+C in the terminal)
# Then uninstall:
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

## Performance

- Handles 2,000-5,000 contacts smoothly
- Live search: <250ms latency per keystroke
- Label preview: <100ms update time
- Print queue: <1 second processing

## Development

```powershell
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
4. Verify all prerequisites are installed correctly

## License

ISC License

#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

console.log('🚀 Installing Credentialing App...');

// Determine app directory based on OS
const appDir = process.platform === 'win32' 
  ? path.join(process.env.USERPROFILE, 'CredentialsApp')
  : path.join(os.homedir(), 'CredentialsApp');

// Create directory structure
const directories = [
  appDir,
  path.join(appDir, 'config'),
  path.join(appDir, 'data'),
  path.join(appDir, 'templates'),
  path.join(appDir, 'logs'),
  path.join(appDir, 'cache'),
  path.join(appDir, 'exports')
];

try {
  // Create directories
  directories.forEach(dir => {
    fs.ensureDirSync(dir);
    console.log(`✅ Created directory: ${dir}`);
  });

  // Create default configuration
  const defaultConfig = {
    appName: 'Credentialing App',
    version: '1.0.0',
    port: 3000,
    printer: {
      type: 'Comer RX106HD',
      labelSize: '4x6',
      foldOver: true
    },
    paths: {
      appDir: appDir,
      dataDir: path.join(appDir, 'data'),
      templatesDir: path.join(appDir, 'templates'),
      exportsDir: path.join(appDir, 'exports'),
      logsDir: path.join(appDir, 'logs')
    },
    github: {
      enabled: false,
      repo: '',
      branch: 'main',
      path: 'templates'
    }
  };

  fs.writeJsonSync(path.join(appDir, 'config', 'app.json'), defaultConfig, { spaces: 2 });
  console.log('✅ Created default configuration');

  // Create initial database
  const dbPath = path.join(appDir, 'data', 'credentials.db');
  console.log(`✅ Database will be initialized at: ${dbPath}`);

  // Create sample template
  const sampleTemplate = {
    id: 'default',
    name: 'Default Credential',
    description: 'Standard 4x6 fold-over credential template',
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
    ],
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  fs.writeJsonSync(path.join(appDir, 'templates', 'default.json'), sampleTemplate, { spaces: 2 });
  console.log('✅ Created sample template');

  // Create CCM No Vote template
  const ccmNoVoteTemplate = {
    id: 'ccm-no-vote',
    name: 'CCM No Vote',
    description: 'CCM credential template with no vote checkbox',
    width: 4,
    height: 6,
    foldOver: true,
    elements: [
      {
        type: 'text',
        id: 'title',
        x: 0.5,
        y: 0.3,
        width: 3,
        height: 0.6,
        content: 'CCM Credential',
        fontSize: 20,
        bold: true,
        align: 'center'
      },
      {
        type: 'text',
        id: 'name',
        x: 0.5,
        y: 1.0,
        width: 3,
        height: 0.8,
        content: '{{firstName}} {{lastName}}',
        fontSize: 24,
        bold: true,
        align: 'center'
      },
      {
        type: 'text',
        id: 'event',
        x: 0.5,
        y: 2.0,
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
        y: 2.6,
        width: 3,
        height: 0.4,
        content: '{{eventDate}}',
        fontSize: 14,
        align: 'center'
      },
      {
        type: 'checkbox',
        id: 'noVote',
        x: 1.5,
        y: 3.5,
        width: 0.3,
        height: 0.3,
        label: 'No Vote'
      },
      {
        type: 'text',
        id: 'credentialed',
        x: 0.5,
        y: 4.2,
        width: 3,
        height: 0.4,
        content: 'Credentialed',
        fontSize: 12,
        align: 'center',
        color: '#28a745'
      }
    ],
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  fs.writeJsonSync(path.join(appDir, 'templates', 'ccm-no-vote.json'), ccmNoVoteTemplate, { spaces: 2 });
  console.log('✅ Created CCM No Vote template');

  console.log('\n🎉 Installation complete!');
  console.log(`📁 App directory: ${appDir}`);
  console.log('\nNext steps:');
  console.log('1. Run: npm start');
  console.log('2. Open: http://localhost:3000');
  console.log('3. Configure your event and import CSV data');

} catch (error) {
  console.error('❌ Installation failed:', error.message);
  process.exit(1);
}

#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

console.log('🗑️  Uninstalling Credentialing App...');

// Determine app directory based on OS
const appDir = process.platform === 'win32' 
  ? path.join(process.env.USERPROFILE, 'CredentialsApp')
  : path.join(os.homedir(), 'CredentialsApp');

try {
  if (!fs.existsSync(appDir)) {
    console.log('ℹ️  App directory not found. Nothing to uninstall.');
    process.exit(0);
  }

  // Backup important data before deletion
  const backupDir = path.join(os.tmpdir(), `CredentialsApp_backup_${Date.now()}`);
  fs.ensureDirSync(backupDir);

  // Preserve exported CSVs and templates
  const preserveDirs = ['exports', 'templates'];
  preserveDirs.forEach(dir => {
    const sourceDir = path.join(appDir, dir);
    const backupDirPath = path.join(backupDir, dir);
    
    if (fs.existsSync(sourceDir)) {
      fs.copySync(sourceDir, backupDirPath);
      console.log(`✅ Backed up ${dir} to: ${backupDirPath}`);
    }
  });

  // Remove app directory
  fs.removeSync(appDir);
  console.log(`✅ Removed app directory: ${appDir}`);

  // Restore preserved data
  preserveDirs.forEach(dir => {
    const backupDirPath = path.join(backupDir, dir);
    const restoreDir = path.join(appDir, dir);
    
    if (fs.existsSync(backupDirPath)) {
      fs.ensureDirSync(path.dirname(restoreDir));
      fs.copySync(backupDirPath, restoreDir);
      console.log(`✅ Restored ${dir} to: ${restoreDir}`);
    }
  });

  // Clean up backup
  fs.removeSync(backupDir);

  console.log('\n🎉 Uninstall complete!');
  console.log('\nPreserved during uninstall:');
  console.log('✅ Exported CSV files');
  console.log('✅ Label templates');
  console.log('✅ User configuration');
  
  console.log('\nRemoved:');
  console.log('🗑️  App files and database');
  console.log('🗑️  Working data and cache');
  console.log('🗑️  Log files');
  
  console.log('\nTo reinstall:');
  console.log('1. Run: npm run install-app');
  console.log('2. Run: npm start');

} catch (error) {
  console.error('❌ Uninstall failed:', error.message);
  console.log('\n⚠️  Some files may not have been removed.');
  console.log('Please check the app directory manually.');
  process.exit(1);
}

const fs = require('fs');

let app = fs.readFileSync('public/app.js', 'utf8');
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Remove Firebase scripts from HTML
html = html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[\s\S]*?firebase-init\.js"><\/script>\n?/g, '');
fs.writeFileSync('public/index.html', html, 'utf8');

// 2. Remove Firebase Auth listener in app.js
app = app.replace(/\/\/ Firebase Auth listener[\s\S]*?\}\);[\s\S]*?\}\n/m, '');
app = app.replace(/else if \(!window\.firebaseAuth\?\.currentUser\) \{/, 'else {');

// 3. Remove Firebase Login
app = app.replace(/\/\/ 1\. Try Firebase Auth \(New Backend\)[\s\S]*?\/\/ 2\. Try Supabase Auth \(Legacy Backend\)/, '// 1. Try Supabase Auth');

// 4. Update enterApp
app = app.replace(/const drivePromise = \(window\.firebaseAuth\?\.currentUser\) \? loadDriveSettingsFromDB\(\) : Promise\.resolve\(\);\s*/, '');
app = app.replace(/drivePromise\s*/, '');
app = app.replace(/loadSettingsFromDB\(\),/, 'loadSettingsFromDB()');
app = app.replace(/refreshInvestigatorDropdowns\(\);/, 'refreshInvestigatorDropdowns();\n  loadDriveSettingsFromDB();');

// 5. Update loadDriveSettingsFromDB
const newLoadDrive = `async function loadDriveSettingsFromDB() {
  if (settings && settings.fieldPermissions && settings.fieldPermissions._driveSettings) {
    window.driveSettings = settings.fieldPermissions._driveSettings;
    if (sessionStorage.getItem('drive_token')) {
      window.googleDriveService.setToken(sessionStorage.getItem('drive_token'));
    }
    updateDriveUI();
  }
}`;
app = app.replace(/async function loadDriveSettingsFromDB\(\) \{[\s\S]*?console\.error\('\[DRIVE\] Failed to load settings:', err\);\n  \}\n\}/, newLoadDrive);

// 6. Update connectGoogleDrive
app = app.replace(/await window\.firebaseDb\.collection\('settings'\)\.doc\('drive'\)\.set\(window\.driveSettings\);/, 
  'if (!settings.fieldPermissions) settings.fieldPermissions = {};\n      settings.fieldPermissions._driveSettings = window.driveSettings;\n      await saveSettings();'
);
app = app.replace(/if \(err\.message && err\.message\.includes\('permission'\)\) \{[\s\S]*?handleFirestoreError\(err, 'write', path\);\n      \}/, '');
app = app.replace(/const path = 'settings\/drive';/, '');

// 7. Update disconnectGoogleDrive
app = app.replace(/await window\.firebaseDb\.collection\('settings'\)\.doc\('drive'\)\.delete\(\);/,
  'if (settings.fieldPermissions) {\n      delete settings.fieldPermissions._driveSettings;\n      await saveSettings();\n    }'
);
app = app.replace(/const path = 'settings\/drive';/, '');
app = app.replace(/if \(err\.message && err\.message\.includes\('permission'\)\) \{[\s\S]*?handleFirestoreError\(err, 'delete', path\);\n    \}/, '');

fs.writeFileSync('public/app.js', app, 'utf8');
console.log("Firebase removed, Drive moved to Supabase!");

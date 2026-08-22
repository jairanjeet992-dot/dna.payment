const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Remove from the main cases toolbar
html = html.replace(
  /\s*<button class="btn btn-gold btn-sm" onclick="openBulkDocManager\(\)">📦 Bulk Docs & Dispatch<\/button>/,
  ''
);

// 2. Add to the Hard Copy Document Lookup panel
html = html.replace(
  /<div class="panel-title" style="margin-bottom:4px;">📁 Hard Copy Document Lookup<\/div>/,
  `<div class="panel-title" style="margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
        <span>📁 Hard Copy Document Lookup</span>
        <button class="btn btn-gold btn-sm admin-only" onclick="openBulkDocManager()">📦 Bulk Docs & Dispatch Manager</button>
      </div>`
);

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Moved Bulk Docs button to Document Lookup view');

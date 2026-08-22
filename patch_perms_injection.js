const fs = require('fs');
let app = fs.readFileSync('public/app.js', 'utf8');

app = app.replace(
  /document\.getElementById\('case-modal'\)\.classList\.add\('open'\);/g,
  "if(typeof applyFieldPermissions === 'function') applyFieldPermissions();\n  document.getElementById('case-modal').classList.add('open');"
);

fs.writeFileSync('public/app.js', app, 'utf8');
console.log("Injected applyFieldPermissions");

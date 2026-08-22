const fs = require('fs');
let app = fs.readFileSync('public/app.js', 'utf8');

app = app.replace(
  /function buildFieldPermissionsPayload\(\) \{\n\s*const perms = \{\};/,
  "function buildFieldPermissionsPayload() {\n  const perms = settings.fieldPermissions || {};"
);

fs.writeFileSync('public/app.js', app, 'utf8');

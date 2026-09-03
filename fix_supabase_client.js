const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

appJs = appJs.replace(/window\.supabaseClient\.from/g, 'supabaseClient.from');
fs.writeFileSync('app.js', appJs);
console.log('Fixed supabaseClient references.');

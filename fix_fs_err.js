const fs = require('fs');
let app = fs.readFileSync('public/app.js', 'utf8');

app = app.replace(/function handleFirestoreError\([\s\S]*?\}\n\}/, '');

fs.writeFileSync('public/app.js', app, 'utf8');

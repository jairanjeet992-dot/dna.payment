const fs = require('fs');
let app = fs.readFileSync('public/app.js', 'utf8');

// The remaining skipCinematicIntro
app = app.replace(/function skipCinematicIntro\(\) \{[\s\S]*?intro\.setAttribute\('aria-hidden', 'true'\);\n\}/, '');

fs.writeFileSync('public/app.js', app, 'utf8');

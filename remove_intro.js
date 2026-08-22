const fs = require('fs');

// 1. Clean index.html
let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace(/<!-- Presentation-only.*?<\/section>\s*/s, '');
fs.writeFileSync('public/index.html', html, 'utf8');

// 2. Clean app.js
let app = fs.readFileSync('public/app.js', 'utf8');
app = app.replace(/\s*playCinematicIntro\(\);/g, '');
app = app.replace(/\/\/ Presentation-only brand moment.*?\n\}\n/s, ''); 
// Just in case the regex doesn't catch everything, let's just replace the exact block:
app = app.replace(/let cinematicIntroTimer;[\s\S]*?function skipCinematicIntro\(\) \{[\s\S]*?\n\}/, '');
fs.writeFileSync('public/app.js', app, 'utf8');

// 3. Clean role-permissions.js
let rp = fs.readFileSync('public/role-permissions.js', 'utf8');
rp = rp.replace(/installUI\(\);/g, '');
rp = rp.replace(/function installUI\(\)\{.*?\}/, '');
fs.writeFileSync('public/role-permissions.js', rp, 'utf8');

console.log("Intro animations removed successfully.");

const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

const matches = [...appJs.matchAll(/function hardcopyStatusCell.*?\{[\s\S]*?\n\}/g)];
if(matches.length > 0) {
    console.log(matches[0][0]);
}


// Just a quick check to verify the UI logic
const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

const matches = appJs.match(/hc1\.toLowerCase\(\) === 'received'.*?\?/);
console.log("Buggy line found: " + matches[0]);


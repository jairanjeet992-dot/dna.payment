const fs = require('fs');
const p = 'public/app.js';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "return `\n    <div style=\"font-family:'Segoe UI',Arial,sans-serif;",
  "return `\n    <style>tr { page-break-inside: avoid; }</style>\n    <div style=\"font-family:'Segoe UI',Arial,sans-serif;"
);

fs.writeFileSync(p, c);
console.log('Patched TR break in app.js');

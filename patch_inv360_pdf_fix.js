const fs = require('fs');
const p = 'public/frontend/investigator-360/investigator-360.js';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "html2canvas: { scale: 2, useCORS: true, letterRendering: true, onclone: window.sanitizeHtml2Canvas },",
  "html2canvas: { scale: 2, useCORS: true, letterRendering: true, onclone: window.sanitizeHtml2Canvas, windowWidth: 1024 },\n    pagebreak: { mode: ['css', 'legacy', 'avoid-all'] },"
);

fs.writeFileSync(p, c);
console.log('Patched investigator-360.js');

const fs = require('fs');
const p = 'public/app.js';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "html2canvas: { scale: 2, useCORS: true, logging: false, onclone: window.sanitizeHtml2Canvas, windowWidth: 800 },",
  "html2canvas: { scale: 2, useCORS: true, logging: false, onclone: window.sanitizeHtml2Canvas, windowWidth: 800, scrollY: 0, scrollX: 0 },"
);

c = c.replace(
  "html2canvas: { scale: 2, useCORS: true, onclone: window.sanitizeHtml2Canvas, windowWidth: 800 },",
  "html2canvas: { scale: 2, useCORS: true, onclone: window.sanitizeHtml2Canvas, windowWidth: 800, scrollY: 0, scrollX: 0 },"
);

fs.writeFileSync(p, c);
console.log('Patched scrollY in app.js');

const p2 = 'public/frontend/investigator-360/investigator-360.js';
let c2 = fs.readFileSync(p2, 'utf8');

c2 = c2.replace(
  "html2canvas: { scale: 2, useCORS: true, letterRendering: true, onclone: window.sanitizeHtml2Canvas, windowWidth: 1024 },",
  "html2canvas: { scale: 2, useCORS: true, letterRendering: true, onclone: window.sanitizeHtml2Canvas, windowWidth: 1024, scrollY: 0, scrollX: 0 },"
);

fs.writeFileSync(p2, c2);
console.log('Patched scrollY in inv360');

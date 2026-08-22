const fs = require('fs');

// 1. Fix app.js
let appJs = fs.readFileSync('public/app.js', 'utf8');

// Revert styling to flexible width
appJs = appJs.replace(
  /padding:40px;width:794px;margin:0;box-sizing:border-box;background:#fff;color:#1B2530;/g,
  "padding:40px;max-width:800px;margin:0 auto;box-sizing:border-box;background:#fff;color:#1B2530;"
);
appJs = appJs.replace(
  /padding:40px;width:794px;margin:0;box-sizing:border-box;color:#1B2530;background:#fff;/g,
  "padding:40px;max-width:800px;margin:0 auto;box-sizing:border-box;background:#fff;color:#1B2530;"
);

// Fix html2canvas options to just use scrollY: 0
appJs = appJs.replace(
  /html2canvas:\s*\{\s*scale:\s*2,\s*useCORS:\s*true,\s*logging:\s*false,\s*onclone:\s*window\.sanitizeHtml2Canvas[^}]*\}/g,
  "html2canvas: { scale: 2, useCORS: true, logging: false, onclone: window.sanitizeHtml2Canvas, scrollY: 0 }"
);
appJs = appJs.replace(
  /html2canvas:\s*\{\s*scale:\s*2,\s*useCORS:\s*true,\s*onclone:\s*window\.sanitizeHtml2Canvas[^}]*\}/g,
  "html2canvas: { scale: 2, useCORS: true, logging: false, onclone: window.sanitizeHtml2Canvas, scrollY: 0 }"
);

// Remove the doc.body.style.width hack from sanitizeHtml2Canvas
appJs = appJs.replace(
  "doc.head.appendChild(style);\n  if(doc.body) { doc.body.style.width = '1024px'; doc.documentElement.style.width = '1024px'; }",
  "doc.head.appendChild(style);"
);

fs.writeFileSync('public/app.js', appJs);

// 2. Fix investigator-360.js
let invJs = fs.readFileSync('public/frontend/investigator-360/investigator-360.js', 'utf8');

// Revert hardcoded width styles
invJs = invJs.replace(/clone\.style\.width = '1000px';\s*clone\.style\.maxWidth = 'none';/g, "clone.style.maxWidth = '1000px';");

// Fix html2canvas options
invJs = invJs.replace(
  /html2canvas:\s*\{\s*scale:\s*2,\s*useCORS:\s*true,\s*letterRendering:\s*true,\s*onclone:\s*window\.sanitizeHtml2Canvas[^}]*\}/g,
  "html2canvas: { scale: 2, useCORS: true, letterRendering: true, onclone: window.sanitizeHtml2Canvas, scrollY: 0 }"
);

fs.writeFileSync('public/frontend/investigator-360/investigator-360.js', invJs);

console.log('Fixed everything');

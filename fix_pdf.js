const fs = require('fs');
let appJs = fs.readFileSync('public/app.js', 'utf8');

// Revert absolute wrapping in app.js
appJs = appJs.replace(
  /const wrapped = '<div style="width:800px;position:absolute;left:0;top:0;background:#fff;text-align:left;">' \+ html \+ '<\/div>';\s*const worker = html2pdf\(\)\.from\(wrapped\)\.set\(opt\);/g,
  "const worker = html2pdf().from(html).set(opt);"
);

appJs = appJs.replace(
  /const wrapped = '<div style="width:800px;position:absolute;left:0;top:0;background:#fff;text-align:left;">' \+ sanitizedHtml \+ '<\/div>';\s*await html2pdf\(\)\.from\(wrapped\)\.set\(opt\)\.save\(\);/g,
  "await html2pdf().from(sanitizedHtml).set(opt).save();"
);

// Revert x, y, scrollX, scrollY
appJs = appJs.replace(/windowWidth: 800, scrollY: 0, scrollX: 0, x: 0, y: 0/g, 'windowWidth: 1024');
appJs = appJs.replace(/windowWidth: 800, scrollY: 0, scrollX: 0/g, 'windowWidth: 1024');

// Improve sanitizeHtml2Canvas
appJs = appJs.replace(
  "doc.head.appendChild(style);",
  "doc.head.appendChild(style);\n  if(doc.body) { doc.body.style.width = '1024px'; doc.documentElement.style.width = '1024px'; }"
);

fs.writeFileSync('public/app.js', appJs);

// Revert in inv360
let invJs = fs.readFileSync('public/frontend/investigator-360/investigator-360.js', 'utf8');

invJs = invJs.replace(
  /clone\.style\.position = 'absolute';\s*clone\.style\.left = '0';\s*clone\.style\.top = '0';\s*clone\.style\.width = '1000px';\s*const wrap = document\.createElement\('div'\);\s*wrap\.style\.position = 'absolute';\s*wrap\.style\.left = '0';\s*wrap\.style\.top = '0';\s*wrap\.style\.width = '1000px';\s*wrap\.appendChild\(clone\);\s*document\.body\.appendChild\(wrap\);\s*const pdfBlob = await html2pdf\(\)\.set\(opt\)\.from\(wrap\)\.output\('blob'\);\s*document\.body\.removeChild\(wrap\);/g,
  "const pdfBlob = await html2pdf().set(opt).from(clone).output('blob');"
);

invJs = invJs.replace(/windowWidth: 1024, scrollY: 0, scrollX: 0, x: 0, y: 0/g, 'windowWidth: 1024');
invJs = invJs.replace(/windowWidth: 1024, scrollY: 0, scrollX: 0/g, 'windowWidth: 1024');

fs.writeFileSync('public/frontend/investigator-360/investigator-360.js', invJs);

console.log('Fixed');

const fs = require('fs');
const p = 'public/app.js';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "const worker = html2pdf().from(html).set(opt);",
  "const wrapped = '<div style=\"width:800px;position:absolute;left:0;top:0;background:#fff;text-align:left;\">' + html + '</div>';\n    const worker = html2pdf().from(wrapped).set(opt);"
);

c = c.replace(
  "await html2pdf().from(sanitizedHtml).set(opt).save();",
  "const wrapped = '<div style=\"width:800px;position:absolute;left:0;top:0;background:#fff;text-align:left;\">' + sanitizedHtml + '</div>';\n      await html2pdf().from(wrapped).set(opt).save();"
);

fs.writeFileSync(p, c);
console.log('Patched app.js');

const p2 = 'public/frontend/investigator-360/investigator-360.js';
let c2 = fs.readFileSync(p2, 'utf8');

c2 = c2.replace(
  "const pdfBlob = await html2pdf().set(opt).from(clone).output('blob');",
  "clone.style.position = 'absolute';\n    clone.style.left = '0';\n    clone.style.top = '0';\n    clone.style.width = '1000px';\n    const wrap = document.createElement('div');\n    wrap.style.position = 'absolute';\n    wrap.style.left = '0';\n    wrap.style.top = '0';\n    wrap.style.width = '1000px';\n    wrap.appendChild(clone);\n    document.body.appendChild(wrap);\n    const pdfBlob = await html2pdf().set(opt).from(wrap).output('blob');\n    document.body.removeChild(wrap);"
);

fs.writeFileSync(p2, c2);
console.log('Patched inv360');

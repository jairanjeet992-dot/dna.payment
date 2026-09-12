const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

app = app.replace(
  /const d = new Date\(c\.date\);\s*return \(d\.getMonth\(\)\+1\)\+'-'\+d\.getFullYear\(\);/g,
  `const { y, m } = parseDateComponents(c.date);\n    return m + '-' + y;`
);

app = app.replace(
  /const d = new Date\(c\.date\);\s*const fyStart = d\.getMonth\(\) >= 3 \? d\.getFullYear\(\) : d\.getFullYear\(\)-1;/g,
  `const { y, m } = parseDateComponents(c.date);\n    const fyStart = m >= 4 ? y : y - 1;` // Note: JS getMonth() is 0-indexed, so getMonth() >= 3 means April. m is 1-indexed, so m >= 4 means April.
);

app = app.replace(
  /const d = new Date\(c\.date\);\s*return fyMonths\.some\(m => \(d\.getMonth\(\)\+1\)===m\.m && d\.getFullYear\(\)===m\.y\);/g,
  `const { y: cy, m: cm } = parseDateComponents(c.date);\n    return fyMonths.some(m => cm===m.m && cy===m.y);`
);

app = app.replace(
  /const d = new Date\(c\.date\);\s*const isMonth = \(d\.getMonth\(\)\+1\)===mo\.m && d\.getFullYear\(\)===mo\.y;/g,
  `const { y: cy, m: cm } = parseDateComponents(c.date);\n      const isMonth = cm===mo.m && cy===mo.y;`
);

fs.writeFileSync('app.js', app);
console.log('Patched date functions in app.js');

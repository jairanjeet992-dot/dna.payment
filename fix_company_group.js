const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

if (code.includes("const comp = c.company || 'Unknown';")) {
  code = code.replace(
    "const comp = c.company || 'Unknown';",
    "const rawComp = (c.company || 'Unknown').trim();\n    const compKey = rawComp.toUpperCase();\n    const comp = rawComp;"
  );
  code = code.replace(
    "const key = comp + '_' + fy;",
    "const key = compKey + '_' + fy;"
  );
  fs.writeFileSync('app.js', code);
  console.log('Fixed company grouping');
} else {
  console.log('Could not find company assignment');
}

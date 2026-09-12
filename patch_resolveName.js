const fs = require('fs');

function patchFile(filename, oldStr, newStr) {
  if (fs.existsSync(filename)) {
    let content = fs.readFileSync(filename, 'utf8');
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(filename, content);
    console.log('Patched ' + filename);
  }
}

// app.js
patchFile('app.js', 
`  const resolveName = (n) => {
    if (!n || n==='NA') return n||'';
    return nameResolution[n] !== undefined ? nameResolution[n] : n;
  };`, 
`  const resolveName = (n) => {
    if (!n || n==='NA') return n||'';
    if (nameResolution[n] !== undefined && nameResolution[n] !== n) return nameResolution[n];
    const exact = knownInvLower.get(n.toLowerCase());
    return exact || n;
  };`);

// smart-merge-engine.js
patchFile('smart-merge-engine.js', 
`    const resolveName = (n) => {
      if (!n || n === 'NA') return n || '';
      return nameResolution[n] !== undefined ? nameResolution[n] : n;
    };`, 
`    const resolveName = (n) => {
      if (!n || n === 'NA') return n || '';
      if (nameResolution[n] !== undefined && nameResolution[n] !== n) return nameResolution[n];
      const exact = knownInvLower.get(n.toLowerCase());
      return exact || n;
    };`);

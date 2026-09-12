const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const autoFixer = `
// Automatically scans database and fixes investigator names that match case-insensitively but have the wrong exact casing
async function autoFixInvestigatorCasing() {
  if (typeof getAllInvestigators !== 'function') return;
  const known = getAllInvestigators();
  if (!known || !known.length) return;
  
  const knownMap = new Map();
  known.forEach(k => knownMap.set(k.toLowerCase(), k));
  
  const updates = [];
  
  for (const c of cases) {
    let needsUpdate = false;
    const payload = {};
    
    if (c.inv1 && c.inv1 !== 'NA') {
      const correct = knownMap.get(c.inv1.toLowerCase());
      if (correct && correct !== c.inv1) {
        c.inv1 = correct; // mutate local state immediately
        payload.inv1 = correct;
        needsUpdate = true;
      }
    }
    
    if (c.inv2 && c.inv2 !== 'NA') {
      const correct = knownMap.get(c.inv2.toLowerCase());
      if (correct && correct !== c.inv2) {
        c.inv2 = correct;
        payload.inv2 = correct;
        needsUpdate = true;
      }
    }
    
    if (needsUpdate && c.doc_code) {
      updates.push({ doc_code: c.doc_code, payload });
    }
  }
  
  if (updates.length > 0) {
    console.log(\`[Auto-Fix] Repairing exact casing for \${updates.length} case(s)...\`);
    // Batch updates sequentially to avoid locking the client
    for (const u of updates) {
      await supabaseClient.from('cases').update(u.payload).eq('doc_code', u.doc_code);
    }
    console.log('[Auto-Fix] Investigator casing repair complete.');
    if (typeof renderAll === 'function') renderAll();
  }
}
`;

// Insert the function before fixMalformedDocCodes is defined, so it's around the same place.
app = app.replace(
  '// Automatically scans database and fixes malformed doc_codes',
  autoFixer + '\n// Automatically scans database and fixes malformed doc_codes'
);

// Call it at the end of init(), right after fixMalformedDocCodes();
app = app.replace(
  'fixMalformedDocCodes();',
  'fixMalformedDocCodes();\n      autoFixInvestigatorCasing();'
);

// We should also patch openCaseModal just in case some cases are newly inserted locally before sync
app = app.replace(
  `  document.getElementById('f-inv1').value = c.inv1||'';
  document.getElementById('f-inv2').value = c.inv2||'';`,
  `  // Ensure casing matches dropdown before assigning
  const resolveCasing = (v) => {
    if (!v || v === 'NA') return v || '';
    const exact = getAllInvestigators().find(x => x.toLowerCase() === v.toLowerCase());
    return exact || v;
  };
  document.getElementById('f-inv1').value = resolveCasing(c.inv1);
  document.getElementById('f-inv2').value = resolveCasing(c.inv2);`
);

fs.writeFileSync('app.js', app);
console.log('Patched auto-fix for investigator casing.');

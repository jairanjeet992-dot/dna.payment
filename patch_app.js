const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Bug 1: genDocCodeDB Race Condition
app = app.replace(
  `      let doc_code;
      if (localMonthCounters[monthCode]) {
        localMonthCounters[monthCode]++;
        doc_code = \`\${monthCode}-\${String(localMonthCounters[monthCode]).padStart(4, '0')}\`;
      } else {
        doc_code = await genDocCodeDB(r.date);
        const match = doc_code.match(/-(\\d+)$/);
        localMonthCounters[monthCode] = match ? parseInt(match[1], 10) : 1;
      }`,
  `      // Bug 1 Fix: Always await genDocCodeDB to guarantee atomic sequences and prevent Race Conditions
      let doc_code = await genDocCodeDB(r.date);`
);

app = app.replace(
  `        for (const item of toInsert) {
          const { data: existing } = await supabaseClient.from('cases').select('id, doc_code').eq('company', item.company).eq('claim_no', item.claim_no).maybeSingle();
          if (existing) {
            await supabaseClient.from('cases').update(item).eq('doc_code', existing.doc_code);
          } else {
            await supabaseClient.from('cases').insert([item]);
          }
        }`,
  `        for (const item of toInsert) {
          const { data: existing } = await supabaseClient.from('cases').select('id, doc_code').eq('company', item.company).eq('claim_no', item.claim_no).maybeSingle();
          if (existing) {
            const { doc_code, ...updateFields } = item;
            await supabaseClient.from('cases').update(updateFields).eq('doc_code', existing.doc_code);
          } else {
            item.doc_code = await genDocCodeDB(item.date);
            await supabaseClient.from('cases').insert([item]);
          }
        }`
);

// Bug 2: Timezone Shifts
app = app.replace(
  /const d = new Date\(c\.date\);\s*return \(d\.getMonth\(\)\s*\+\s*1\)\s*===\s*mo\.m\s*&&\s*d\.getFullYear\(\)\s*===\s*mo\.y/g,
  `const { y, m } = parseDateComponents(c.date);\n    return m === mo.m && y === mo.y`
);

app = app.replace(
  /const d = new Date\(e\.date\);\s*return \(d\.getMonth\(\)\s*\+\s*1\)\s*===\s*mo\.m\s*&&\s*d\.getFullYear\(\)\s*===\s*mo\.y/g,
  `const { y, m } = parseDateComponents(e.date);\n    return m === mo.m && y === mo.y`
);

// We need to replace it everywhere it appears.
// Line 3358, 3593 etc.
app = app.replace(
  /const d = new Date\(c\.date\);\s*const m = MONTHS\[d\.getMonth\(\)\];\s*if \(!yMap\.has\(m\.code\)\)/g,
  `const { code: mCode } = parseDateComponents(c.date);\n    const m = MONTHS.find(x => x.code === mCode);\n    if (!m) return;\n    if (!yMap.has(m.code))`
);

app = app.replace(
  /const d = new Date\(c\.date\);\s*const m = MONTHS\[d\.getMonth\(\)\];\s*if \(d\.getFullYear\(\) === selectedYear\)/g,
  `const { y, code } = parseDateComponents(c.date);\n    const m = MONTHS.find(x => x.code === code);\n    if (y === selectedYear && m)`
);

// Bug 3: Empty filter fallback
app = app.replace(
  /const sourceList = \(filteredCases && filteredCases\.length\) \? filteredCases : cases;/g,
  `const sourceList = (typeof isFilterActive === 'function' && isFilterActive()) ? (filteredCases || []) : cases;`
);

app = app.replace(
  `const rows = filteredCases.length ? filteredCases : cases;`,
  `const rows = (typeof isFilterActive === 'function' && isFilterActive()) ? (filteredCases || []) : cases;`
);

app = app.replace(
  `let lastFilterState = null;`,
  `let lastFilterState = null;\nfunction isFilterActive() { return lastFilterState && lastFilterState !== '|||||'; }\n`
);

fs.writeFileSync('app.js', app);
console.log('Patched app.js');

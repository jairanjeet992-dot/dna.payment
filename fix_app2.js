const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

code = code.replace(
  /const { error: casesErr } = await supabaseClient\.from\('cases'\)\.delete\(\)\.neq\('doc_code', '__never_matches__'\);\n\s*if \(casesErr\) throw casesErr;/,
  `const { data: casesData, error: casesErr } = await supabaseClient.from('cases').delete().neq('doc_code', '__never_matches__').select('id');
    if (casesErr) throw casesErr;
    if (!casesData || casesData.length === 0) {
      console.warn("Delete all cases returned 0 rows. This might be due to RLS blocking or the table is already empty.");
    }`
);

fs.writeFileSync('public/app.js', code);

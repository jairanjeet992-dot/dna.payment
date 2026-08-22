const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Update applyBulkEdit
code = code.replace(
  /await supabaseClient\.from\('cases'\)\.update\(update\)\.in\('doc_code', docCodes\);/,
  `const { data: updateData, error: updateErr } = await supabaseClient.from('cases').update(update).in('doc_code', docCodes).select('id');
    if (updateErr) throw updateErr;
    if (!updateData || updateData.length === 0) throw new Error("Bulk edit blocked by database permissions (RLS). Please ensure you have the 'admin' role.");`
);

fs.writeFileSync('public/app.js', code);

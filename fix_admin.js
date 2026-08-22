const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Update deleteCasesDB
code = code.replace(
  /async function deleteCasesDB\(docCodes\) {[\s\S]*?if \(error\) throw error;\n}/,
  `async function deleteCasesDB(docCodes) {
  const { data, error } = await supabaseClient.from('cases').delete().in('doc_code', docCodes).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Deletion blocked by database permissions (RLS). Please ensure you have the 'admin' role in the user_roles table in Supabase.");
  }
}`
);

fs.writeFileSync('public/app.js', code);

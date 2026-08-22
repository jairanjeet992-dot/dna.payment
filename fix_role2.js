const fs = require('fs');
let code = fs.readFileSync('public/role-permissions.js', 'utf8');

code = code.replace(
  /await ensureInvestigator360\(\);return; try\{ if\(getClient\(\)\) \{ await getClient\(\)\.from\('user_roles'\)\.upsert\(\[\{user_id: user\.id, role: 'admin'\}\]\); \} \}catch\(e\)\{\} \}/,
  `await ensureInvestigator360(); try{ if(getClient()) { await getClient().from('user_roles').upsert([{user_id: user.id, role: 'admin'}]); } }catch(e){} return; }`
);

fs.writeFileSync('public/role-permissions.js', code);

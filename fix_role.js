const fs = require('fs');
let code = fs.readFileSync('public/role-permissions.js', 'utf8');

// Find the block where hardcoded admin is checked and add a Supabase upsert
code = code.replace(
  /if\(user\.email==='jairanjeet992@gmail\.com'\|\|user\.email==='admin@example\.com'\)\{([^}]+)\}/,
  `if(user.email==='jairanjeet992@gmail.com'||user.email==='admin@example.com'){ $1; try{ if(getClient()) { await getClient().from('user_roles').upsert([{user_id: user.id, role: 'admin'}]); } }catch(e){} }`
);

fs.writeFileSync('public/role-permissions.js', code);

const fs = require('fs');

// --- 1. UPDATE index.html ---
let html = fs.readFileSync('public/index.html', 'utf8');

const roleManagerHtml = `
        <div class="panel-title admin-only" style="margin:20px 0 10px;">👥 Manage Staff Roles</div>
        <div class="admin-only" style="font-size:11.5px;color:var(--sub);margin-bottom:10px;">Assign roles directly by their email address.</div>
        <div class="admin-only" style="display:flex; gap:10px; margin-bottom:14px; align-items:end;">
           <div class="fg" style="flex:2; margin-bottom:0;"><label>User Email</label><input type="email" id="assign-role-email" placeholder="staff@agency.com"></div>
           <div class="fg" style="flex:1; margin-bottom:0;"><label>Role</label><select id="assign-role-select">
              <option value="staff">Staff (Basic)</option>
              <option value="junior">Junior</option>
              <option value="senior">Senior</option>
              <option value="accounts">Accounts</option>
              <option value="company">Company</option>
           </select></div>
           <button class="btn btn-navy btn-sm" onclick="assignRoleByEmail()">Assign</button>
        </div>
        <div class="admin-only" id="assigned-roles-list" style="border:1px solid var(--line); border-radius:4px; max-height:150px; overflow-y:auto; font-size:11.5px;">
           <div style="padding:10px; color:var(--sub); text-align:center;">Loading roles...</div>
        </div>
`;

html = html.replace(
  /<div id="invite-status" style="font-size:11px;margin-top:8px;"><\/div>/,
  '<div id="invite-status" style="font-size:11px;margin-top:8px;"></div>\n' + roleManagerHtml
);

fs.writeFileSync('public/index.html', html, 'utf8');

// --- 2. UPDATE app.js ---
let appJs = fs.readFileSync('public/app.js', 'utf8');

const jsCode = `
function renderAssignedRoles() {
  const container = document.getElementById('assigned-roles-list');
  if (!container) return;
  const staffRoles = (settings.fieldPermissions && settings.fieldPermissions._staffRoles) ? settings.fieldPermissions._staffRoles : {};
  const emails = Object.keys(staffRoles);
  
  if (emails.length === 0) {
    container.innerHTML = '<div style="padding:10px; color:var(--sub); text-align:center;">No custom roles assigned yet.</div>';
    return;
  }
  
  let html = '<table class="data-table" style="width:100%; margin:0;"><tbody>';
  emails.forEach(email => {
    html += \`<tr>
      <td style="font-weight:600;">\${email}</td>
      <td style="text-transform:capitalize;">\${staffRoles[email]}</td>
      <td style="text-align:right;"><button class="btn btn-ghost btn-sm" style="color:var(--amber); padding:2px 6px;" onclick="removeAssignedRole('\${email}')">Remove</button></td>
    </tr>\`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function assignRoleByEmail() {
  const email = document.getElementById('assign-role-email').value.trim().toLowerCase();
  const role = document.getElementById('assign-role-select').value;
  if (!email || !email.includes('@')) { showToast('Enter a valid email.', true); return; }
  
  if (!settings.fieldPermissions) settings.fieldPermissions = {};
  if (!settings.fieldPermissions._staffRoles) settings.fieldPermissions._staffRoles = {};
  
  settings.fieldPermissions._staffRoles[email] = role;
  saveSettings();
  renderAssignedRoles();
  document.getElementById('assign-role-email').value = '';
  showToast(\`Assigned '\${role}' to \${email}\`);
}

function removeAssignedRole(email) {
  if (settings.fieldPermissions && settings.fieldPermissions._staffRoles) {
    delete settings.fieldPermissions._staffRoles[email];
    saveSettings();
    renderAssignedRoles();
    showToast(\`Removed role for \${email}\`);
  }
}
`;

// Hook into loadSettingsFromDB to render the list
appJs = appJs.replace(
  /if\(typeof renderPermissionsMatrix === 'function'\) renderPermissionsMatrix\(\);/,
  "if(typeof renderPermissionsMatrix === 'function') renderPermissionsMatrix();\n  if(typeof renderAssignedRoles === 'function') renderAssignedRoles();"
);

appJs += '\n' + jsCode;
fs.writeFileSync('public/app.js', appJs, 'utf8');

// --- 3. UPDATE role-permissions.js ---
let roleJs = fs.readFileSync('public/role-permissions.js', 'utf8');

// We need to inject the logic to read _staffRoles in loadCurrentUserRole
// Find: const {data,error}=await c.from('user_roles').select('role').eq('user_id',user.id).maybeSingle();if(error)throw error;window.currentUserRole=data?.role||'staff';

roleJs = roleJs.replace(
  /const \{data,error\}=await c\.from\('user_roles'\)\.select\('role'\)\.eq\('user_id',user\.id\)\.maybeSingle\(\);if\(error\)throw error;window\.currentUserRole=data\?\.role\|\|'staff';/,
  `
  let dbRole = 'staff';
  try {
    const {data: urData} = await c.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (urData?.role) dbRole = urData.role;
  } catch(e) {}
  
  try {
    const {data: asData} = await c.from('agency_settings').select('field_permissions').eq('id', 1).maybeSingle();
    if (asData?.field_permissions?._staffRoles?.[user.email]) {
      dbRole = asData.field_permissions._staffRoles[user.email];
    }
  } catch(e) {}
  
  window.currentUserRole = dbRole;
  `
);

fs.writeFileSync('public/role-permissions.js', roleJs, 'utf8');
console.log('Patched role assignment UI');

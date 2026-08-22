const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// 1. In `loadSettingsFromDB()`, add field_permissions
code = code.replace(
  /settings = \{ agencyName: data\.agency_name, agencyAddress: data\.agency_address \|\| '', logo: data\.logo \|\| null \};/,
  "settings = { agencyName: data.agency_name, agencyAddress: data.agency_address || '', logo: data.logo || null, fieldPermissions: data.field_permissions || {} };\n  if(typeof renderPermissionsMatrix === 'function') renderPermissionsMatrix();"
);

// 2. In `saveSettings()`, build and save field_permissions
code = code.replace(
  /settings\.agencyAddress = document\.getElementById\('agency-address'\)\.value;/,
  "settings.agencyAddress = document.getElementById('agency-address').value;\n  if(typeof buildFieldPermissionsPayload === 'function') settings.fieldPermissions = buildFieldPermissionsPayload();"
);

code = code.replace(
  /agency_name: settings\.agencyName, agency_address: settings\.agencyAddress, logo: settings\.logo/,
  "agency_name: settings.agencyName, agency_address: settings.agencyAddress, logo: settings.logo, field_permissions: settings.fieldPermissions"
);

// 3. Inject the `applyFieldPermissions` before `openModal` calls
code = code.replace(
  /document\.getElementById\('f-remarks'\)\.value = '';/,
  "document.getElementById('f-remarks').value = '';\n  if(typeof applyFieldPermissions === 'function') applyFieldPermissions();"
);

code = code.replace(
  /document\.getElementById\('f-remarks'\)\.value = c\.remarks \|\| '';/,
  "document.getElementById('f-remarks').value = c.remarks || '';\n  if(typeof applyFieldPermissions === 'function') applyFieldPermissions();"
);

// Add the Field Permissions logic at the bottom of the file
const permLogic = `
// ============================================================
// ADVANCED FIELD PERMISSIONS
// ============================================================
const FIELD_GROUPS = [
  { id: 'group_company', label: 'Company & Case Type', elements: ['f-company', 'f-casetype', 'f-date'] },
  { id: 'group_patient', label: 'Claim & Patient Details', elements: ['f-claim', 'f-policy', 'f-insured', 'f-hospital', 'f-location', 'f-sla'] },
  { id: 'group_assignment', label: 'Investigator Assignment', elements: ['f-inv1', 'f-inv2', 'f-transfer-reason'] },
  { id: 'group_fees', label: 'Investigator Fees & TA', elements: ['f-fee1', 'f-fee2', 'f-ta1', 'f-ta2', 'f-total'] },
  { id: 'group_payout', label: 'Client Payouts & Invoicing', elements: ['f-received', 'f-invoice', 'f-profit'] },
  { id: 'group_paystatus', label: 'Payment Statuses', elements: ['f-inv1status', 'f-inv2status'] },
  { id: 'group_hardcopy', label: 'Investigator Hard Copies', elements: ['f-hardcopy1status', 'f-hardcopy2status', 'f-hardcopy-same-btn'] },
  { id: 'group_dispatch', label: 'Company Dispatch Details', elements: ['f-companyhardcopy', 'f-companyawb'] },
  { id: 'group_outcome', label: 'Outcome & Remarks', elements: ['f-outcome', 'f-remarks'] }
];
const PERM_ROLES = ['senior', 'junior', 'accounts', 'company'];

function renderPermissionsMatrix() {
  const tbody = document.getElementById('permissions-matrix')?.querySelector('tbody');
  if (!tbody) return;
  
  const perms = settings.fieldPermissions || {};
  
  tbody.innerHTML = FIELD_GROUPS.map(group => {
    let rowHtml = \`<tr><td style="font-weight:600;">\${group.label}</td>\`;
    
    PERM_ROLES.forEach(role => {
      // Default is 'edit'
      const val = perms[group.id] && perms[group.id][role] ? perms[group.id][role] : 'edit';
      rowHtml += \`<td style="text-align:center;">
        <select class="perm-select" data-group="\${group.id}" data-role="\${role}" style="padding:4px; font-size:11px; border-radius:3px; border:1px solid var(--line);">
          <option value="edit" \${val === 'edit' ? 'selected' : ''}>✏️ Edit</option>
          <option value="read" \${val === 'read' ? 'selected' : ''}>🔒 Read-Only</option>
          <option value="hide" \${val === 'hide' ? 'selected' : ''}>🚫 Hidden</option>
        </select>
      </td>\`;
    });
    
    rowHtml += '</tr>';
    return rowHtml;
  }).join('');
}

function buildFieldPermissionsPayload() {
  const perms = {};
  const selects = document.querySelectorAll('.perm-select');
  selects.forEach(sel => {
    const group = sel.getAttribute('data-group');
    const role = sel.getAttribute('data-role');
    const val = sel.value;
    if (!perms[group]) perms[group] = {};
    perms[group][role] = val;
  });
  return perms;
}

function applyFieldPermissions() {
  // Always reset everything to visible and editable first
  FIELD_GROUPS.forEach(group => {
    group.elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        // Find closest form-grid (fg) wrapper if exists to hide it
        const fg = el.closest('.fg');
        if (fg) fg.style.display = 'block';
        else el.style.display = '';
        
        // Don't enable strictly readonly fields like auto-calculated totals
        if (id !== 'f-total' && id !== 'f-profit') {
          el.disabled = false;
        }
      }
    });
  });

  // Admin sees everything editable always
  if (window.isCurrentUserAdmin) return;
  
  const role = window.currentUserRole;
  if (!role || !PERM_ROLES.includes(role)) return; // Default staff fallback

  const perms = settings.fieldPermissions || {};
  
  FIELD_GROUPS.forEach(group => {
    const permission = perms[group.id] && perms[group.id][role] ? perms[group.id][role] : 'edit';
    
    group.elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const fg = el.closest('.fg');
        
        if (permission === 'hide') {
          if (fg) fg.style.display = 'none';
          else el.style.display = 'none';
        } else if (permission === 'read') {
          el.disabled = true; // Still submits value in saveCase() since it reads DOM value directly
        }
      }
    });
  });
}
`;

code += '\n' + permLogic;

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('Patched Settings JS');

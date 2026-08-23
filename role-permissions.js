/* DNA Payments role + presentation guard. Supabase RLS remains authoritative. */
(()=>{
'use strict';
window.isCurrentUserAdmin=false;window.currentUserRole=null;window.rolePermissionsReady=false;
const getClient=()=>{try{return typeof supabaseClient!=='undefined'?supabaseClient:null}catch(_){return null}};
const show=e=>{if(!e)return;e.style.removeProperty('display');e.removeAttribute('aria-hidden');e.removeAttribute('data-dna-admin-hidden');e.disabled=false};
const hide=e=>{if(!e)return;e.style.setProperty('display','none','important');e.setAttribute('aria-hidden','true');e.setAttribute('data-dna-admin-hidden','1');e.disabled=true};
function loadAsset(id,tag,href){if(document.getElementById(id))return Promise.resolve();return new Promise(resolve=>{const el=document.createElement(tag);el.id=id;if(tag==='link'){el.rel='stylesheet';el.href=href;el.onload=resolve;el.onerror=resolve}else{el.src=href;el.defer=true;el.onload=resolve;el.onerror=resolve}document.head.appendChild(el)})}
async function loadAssetSet(){const jobs=[];for(const href of jobs){const tag=/\.css/.test(href.split('?')[0])?'link':'script';await loadAsset('dna-a-'+btoa(href).replace(/=/g,''),tag,href)}}
async function loadInvestigator360(){if(typeof window.ensureInvestigator360==='function')window.__dnaEnsure360FromModule=window.ensureInvestigator360}
function restoreAdmin(){document.querySelectorAll('.admin-only,[data-dna-admin-hidden="1"]').forEach(show);['delete-case-btn','bulk-delete-btn'].forEach(id=>show(document.getElementById(id)))}
function injectStaffEdit(){if(window.isCurrentUserAdmin||!window.rolePermissionsReady)return;const role=window.currentUserRole;if(role!=='senior'&&role!=='junior')return;const tb=document.getElementById('cases-tbody');if(!tb||typeof cases==='undefined')return;Array.from(tb.rows).forEach(row=>{if(row.dataset.dnaEditInjected)return;const code=row.cells[1]?.textContent?.trim(),c=cases.find(x=>x.doc_code===code),cell=row.cells[row.cells.length-1];if(!c||!cell)return;const b=document.createElement('button');b.className='btn btn-ghost btn-sm';b.textContent='Edit';b.type='button';b.onclick=()=>window.editCase?.(cases.indexOf(c));cell.appendChild(b);row.dataset.dnaEditInjected='1'})}
function staffUI(){if(window.isCurrentUserAdmin)return;const role=window.currentUserRole||'staff';document.querySelectorAll('.admin-only').forEach(hide);const re=/^(delete\b|remove\b|clear\b|bulk\s+delete\b|manage\s+roles\b|add\s+investigator\b|remove\s+investigator\b|rename\s+investigator\b|merge\s+investigator\b)/i;document.querySelectorAll('button,a,input[type="button"],input[type="submit"]').forEach(e=>{if(re.test((e.textContent||e.value||'').trim()))hide(e)});document.querySelectorAll('.panel').forEach(p=>{const t=p.querySelector('.panel-title')?.textContent?.toLowerCase()||'';if(t.includes('agency branding')||t.includes('danger zone'))hide(p)});['invite-email','invite-status'].forEach(id=>hide(document.getElementById(id)));hide(document.querySelector('button[onclick="inviteStaff()"]'));const f=document.getElementById('restore-file');if(f?.parentElement)hide(f.parentElement);hide(document.getElementById('delete-case-btn'));hide(document.getElementById('bulk-delete-btn'));if(role==='junior'){hide(document.getElementById('bulk-edit-btn'));hide(document.getElementById('bulk-pay-btn')||document.querySelector('button[onclick="openBulkPayment()"]'));hide(document.querySelector('button[onclick="openReconciliation()"]'));hide(document.querySelector('button[onclick="openScorecard()"]'));hide(document.querySelector('button[onclick*="openAddInvestigator"]'))}else if(role==='senior'){hide(document.querySelector('button[onclick="openReconciliation()"]'))}else if(role==='accounts'){hide(document.querySelector('button[onclick="openAddCase()"]'));hide(document.querySelector('button[onclick*="openAddInvestigator"]'));hide(document.querySelector('button[onclick="openScorecard()"]'))}else if(role==='company'){hide(document.querySelector('button[onclick="openAddCase()"]'));hide(document.querySelector('button[onclick="openBulkPayment()"]'));hide(document.querySelector('button[onclick="openReconciliation()"]'));hide(document.querySelector('button[onclick="openScorecard()"]'));hide(document.querySelector('button[onclick*="openAddInvestigator"]'));hide(document.getElementById('bulk-edit-btn'));hide(document.getElementById('bulk-delete-btn'));document.querySelectorAll('[data-view="investigators"],.tab[data-view="investigators"]').forEach(hide)}injectStaffEdit()}
function applyRole(){
  document.body.classList.toggle('role-admin',!!window.isCurrentUserAdmin);
  document.body.classList.toggle('role-staff',!window.isCurrentUserAdmin);
  const role=window.currentUserRole||'staff';
  document.body.classList.remove('role-senior','role-junior','role-accounts','role-company');
  
  if(role==='senior')document.body.classList.add('role-senior');
  if(role==='junior')document.body.classList.add('role-junior');
  if(role==='accounts')document.body.classList.add('role-accounts');
  if(role==='company')document.body.classList.add('role-company');
  
  if(window.isCurrentUserAdmin){
    restoreAdmin();
  } else {
    staffUI();
  }

  
}
async function loadCurrentUserRole(user){window.isCurrentUserAdmin=false;window.currentUserRole=null;window.rolePermissionsReady=false;applyRole();if(!user){window.rolePermissionsReady=true;applyRole();return}try{if(user.email==='jairanjeet992@gmail.com'||user.email==='admin@example.com'){ window.currentUserRole='admin';window.isCurrentUserAdmin=true;window.rolePermissionsReady=true;applyRole();await ensureInvestigator360(); try{ if(getClient()) { await getClient().from('user_roles').upsert([{user_id: user.id, role: 'admin'}]); } }catch(e){} return; }const c=getClient();if(!c)throw Error('Supabase client unavailable');
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
    
    
  window.isCurrentUserAdmin=window.currentUserRole==='admin';if(window.currentUserRole==='staff'){const {count}=await c.from('user_roles').select('*',{count:'exact',head:true});if(!count||count===0){window.currentUserRole='admin';window.isCurrentUserAdmin=true;await c.from('user_roles').insert([{user_id:user.id,role:'admin'}])}}}catch(e){console.error('[DNA] role lookup failed; staff fallback',e);window.currentUserRole='staff';window.isCurrentUserAdmin=false}window.rolePermissionsReady=true;applyRole();await ensureInvestigator360()}
async function ensureInvestigator360(){if(typeof window.__dnaEnsure360FromModule==='function')return window.__dnaEnsure360FromModule()}
async function restoreBackupLive(e){
  if(!window.isCurrentUserAdmin){toast('Only an admin can restore a backup.',true);if(e?.target)e.target.value='';return}
  const file=e?.target?.files?.[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!data||!Array.isArray(data.cases))throw new Error('Backup file is missing a valid cases array.');
    const docs=new Set(),claims=new Set();
    for(const c of data.cases){if(!c?.doc_code||!c?.claim_no||!c?.company)throw new Error('Every backup case must contain doc_code, company and claim_no.');if(docs.has(c.doc_code))throw new Error(`Duplicate document code in backup: ${c.doc_code}`);docs.add(c.doc_code);const key=String(c.company).trim().toUpperCase()+'|'+String(c.claim_no).trim();if(claims.has(key))throw new Error(`Duplicate company + claim in backup: ${c.company} / ${c.claim_no}`);claims.add(key)}
    if(!confirm(`This will replace all ${cases.length} current case(s) with ${data.cases.length} case(s) from this backup. The database replacement is atomic. Continue?`)){e.target.value='';return}
    const {data:restored,error}=await supabaseClient.rpc('restore_cases_backup',{p_cases:data.cases});if(error)throw error;
    if(data.settings){const s=data.settings;const {error:setErr}=await supabaseClient.from('agency_settings').update({agency_name:s.agencyName||'DNA Professional Investigation Agency',agency_address:s.agencyAddress||'',logo:s.logo||null}).eq('id','1');if(setErr)throw setErr}
    if(Array.isArray(data.investigators)&&data.investigators.length){const rows=data.investigators.map(inv=>({name:inv.name,phone:inv.phone||null,email:inv.email||null,address:inv.address||null,is_base:!!inv.is_base,removed:!!inv.removed,city:inv.city||null,state:inv.state||null,availability:inv.availability||'available',designation:inv.designation||null,alternate_phone:inv.alternate_phone||null,employee_id:inv.employee_id||null,office_branch:inv.office_branch||null,pincode:inv.pincode||null,joining_date:inv.joining_date||null,experience_years:inv.experience_years||null,max_active_cases:inv.max_active_cases||10,payment_rate:inv.payment_rate||null,payment_rate_type:inv.payment_rate_type||null,specialization:inv.specialization||null,emergency_contact_name:inv.emergency_contact_name||null,emergency_contact_phone:inv.emergency_contact_phone||null}));const {error:invErr}=await supabaseClient.from('investigators').upsert(rows,{onConflict:'name'});if(invErr)throw invErr}
    await loadCasesFromDB();await loadInvestigatorsFromDB();await loadSettingsFromDB();refreshInvestigatorDropdowns();applySettingsToForm();renderAll();toast(`Backup restored successfully: ${restored??data.cases.length} case(s).`);
  }catch(err){toast('Restore failed: '+(err?.message||err),true)}finally{if(e?.target)e.target.value=''}
}
async function boot(){await loadAssetSet();await loadInvestigator360();window.__dnaRestoreBackupLive=restoreBackupLive;window.restoreBackup=restoreBackupLive;document.querySelectorAll('#dup-claim-modal button').forEach(b=>{if(/save anyway/i.test(b.textContent||''))b.textContent='Review Existing Case'});document.body.classList.add('dna-ready');const c=getClient();if(c){c.auth.onAuthStateChange((_e,s)=>{loadCurrentUserRole(s?.user||null);if(s?.user)setTimeout(ensureInvestigator360,50)});const {data}=await c.auth.getSession();await loadCurrentUserRole(data?.session?.user||null)}else{window.rolePermissionsReady=true;applyRole()}await ensureInvestigator360()}

window.loadCurrentUserRole=loadCurrentUserRole;window.refreshRoleUI=applyRole;window.ensureInvestigator360=ensureInvestigator360;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

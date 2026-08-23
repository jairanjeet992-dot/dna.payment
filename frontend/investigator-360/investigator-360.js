(()=>{'use strict';
const S=()=>window.supabaseClient;
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const money=v=>'₹'+Math.round(Number(v)||0).toLocaleString('en-IN');
const norm=v=>String(v??'').trim().toLowerCase();
let rows=[], currentId=null;
const admin=()=>window.isCurrentUserAdmin===true;
function toast(msg,error=false){let e=document.querySelector('.inv360-toast');if(e)e.remove();e=document.createElement('div');e.className='inv360-toast'+(error?' error':'');e.textContent=msg;document.body.appendChild(e);setTimeout(()=>e.remove(),2800)}
function legacyGuard(){
 const v=document.getElementById('view-investigators'); if(!v)return;
 const cssId='dna-investigator-360-single';
 if(!document.getElementById(cssId)){const s=document.createElement('style');s.id=cssId;s.textContent='#view-investigators>.panel-head,#view-investigators>#inv-grid,#view-investigators>.inv-grid,#view-investigators>.inv360-legacy-report{display:none!important} #view-investigators>.inv360-wrap{display:block!important}';document.head.appendChild(s)}
 v.querySelectorAll(':scope>#inv-grid,:scope>.inv-grid,:scope>.inv360-legacy-report').forEach(e=>{e.style.setProperty('display','none','important');e.setAttribute('aria-hidden','true')});
}
function shell(){const v=document.getElementById('view-investigators');if(!v)return null;legacyGuard();let w=v.querySelector('.inv360-wrap');if(!w){w=document.createElement('div');w.className='inv360-wrap';v.appendChild(w)}return w}
async function fetchRows(){
  // Fast path: if app.js already loaded them, just use it
  if (window.investigatorRows && window.investigatorRows.length > 0) {
    return window.investigatorRows;
  }
  const c=S();
  if(!c){
    toast('Supabase client unavailable',true);
    return window.investigatorRows || [];
  }
  try{
    const {data,error}=await c.from('investigators').select('*').eq('removed',false).order('name');
    if(error){
      if (error.message === 'Failed to fetch' || error.message === 'Load failed') {
         console.debug('[DNA 360] fetchRows network warning (safe to ignore if offline/adblock):', error.message);
         return window.investigatorRows || [];
      }
      console.warn('[DNA 360] fetchRows warning:',error.message);
      return window.investigatorRows || [];
    }
    return data||[];
  }catch(err){
    if (err?.message === 'Failed to fetch' || err?.message === 'Load failed') {
       console.debug('[DNA 360] fetchRows network exception (safe to ignore if offline/adblock):', err?.message);
       return window.investigatorRows || [];
    }
    console.warn('[DNA 360] fetchRows exception:',err?.message||err);
    return window.investigatorRows || [];
  }
}
function casesFor(name){const cs=Array.isArray(window.cases)?window.cases:[];return cs.filter(c=>norm(c.inv1)===norm(name)||norm(c.inv2)===norm(name))}
function caseAmount(c,name){let cost=0,paid=0,status=[];if(norm(c.inv1)===norm(name)){cost+=Number(c.fee1||0)+Number(c.ta1||0);if(c.inv1_status==='Paid')paid+=Number(c.fee1||0)+Number(c.ta1||0);status.push(c.inv1_status||'Pending')}if(norm(c.inv2)===norm(name)){cost+=Number(c.fee2||0)+Number(c.ta2||0);if(c.inv2_status==='Paid')paid+=Number(c.fee2||0)+Number(c.ta2||0);status.push(c.inv2_status||'Pending')}return {cost,paid,status:status.join(' / ')}}
function detail(k,v){return `<div class="inv360-detail"><label>${esc(k)}</label><b>${esc(v==null||v===''?'Not set':v)}</b></div>`}
function filtered(){const q=norm(document.getElementById('inv360-search')?.value),st=document.getElementById('inv360-status')?.value||'';return rows.filter(r=>(!q||[r.name,r.email,r.city,r.state,r.office_branch,r.employee_id,r.specialization].some(x=>norm(x).includes(q)))&&(!st||r.availability===st))}
function render(){const w=shell();if(!w)return;w.innerHTML=`<div class="inv360-head"><div><div class="inv360-eyebrow">PEOPLE & WORKLOAD</div><div class="inv360-title">Investigator 360°</div><div class="inv360-sub">Live Supabase profiles, workload, payments, documents, activity and full admin editing.</div></div><div class="inv360-actions"><input id="inv360-search" class="fin inv360-search" placeholder="Search investigator, branch, city…"><select id="inv360-status" class="fin"><option value="">All availability</option><option value="available">Available</option><option value="limited">Limited</option><option value="leave">On Leave</option><option value="inactive">Inactive</option></select>${admin()?`<button class="btn btn-gold" style="height:38px;padding:0 16px;white-space:nowrap;font-weight:750" onclick="window.openAddInvestigator()">+ Add Investigator</button>`:''}</div></div><div id="inv360-grid" class="inv360-grid"></div><div id="inv360-drawer" class="inv360-drawer"></div>`;let debounceTimer360;
document.getElementById('inv360-search').oninput = () => {
    clearTimeout(debounceTimer360);
    debounceTimer360 = setTimeout(paint, 250);
};document.getElementById('inv360-status').onchange=paint;paint()}
function paint(){const g=document.getElementById('inv360-grid');if(!g)return;const list=filtered();if(!list.length){g.innerHTML='<div class="inv360-empty">No investigators match this filter.</div>';return}g.innerHTML=list.map(r=>{const cs=casesFor(r.name),st=cs.reduce((a,c)=>{const x=caseAmount(c,r.name);a.cost+=x.cost;a.paid+=x.paid;return a},{cost:0,paid:0}),cap=Math.max(1,Number(r.max_active_cases)||10),pct=Math.min(100,Math.round(cs.length/cap*100)),pending=Math.max(0,st.cost-st.paid);return `<article class="inv360-card"><div class="inv360-card-top"><div class="inv360-avatar">${esc((r.name||'I').split(/\s+/).map(x=>x[0]).slice(0,2).join(''))}</div><div><div class="inv360-name">${esc(r.name)}</div><div class="inv360-role">${esc(r.designation||'Investigator')} · ${esc(r.employee_id||'ID not set')}</div></div><span class="inv360-status ${esc(r.availability||'available')}">${esc(String(r.availability||'available').replace('_',' '))}</span></div><div class="inv360-location">📍 ${esc([r.city,r.state].filter(Boolean).join(', ')||'Location not set')}${r.office_branch?' · '+esc(r.office_branch):''}</div><div class="inv360-stats"><div class="inv360-stat"><b>${cs.length}</b><span>Cases</span></div><div class="inv360-stat"><b>${money(st.cost)}</b><span>Payable</span></div><div class="inv360-stat"><b>${money(st.paid)}</b><span>Paid</span></div><div class="inv360-stat"><b>${money(pending)}</b><span>Outstanding</span></div></div><div class="inv360-meter"><span style="width:${pct}%"></span></div><div class="inv360-card-actions"><button class="btn btn-navy btn-sm" type="button" data-inv360-open="${esc(r.id)}">Open 360°</button>${admin()?`<button class="btn btn-gold btn-sm" type="button" data-inv360-edit="${esc(r.id)}">✎ Edit Details</button>`:''}${r.email?`<button class="btn btn-ghost btn-sm" type="button" data-inv360-email="${encodeURIComponent(r.email)}">✉ Email</button>`:''}</div></article>`}).join('');g.querySelectorAll('[data-inv360-open]').forEach(b=>b.onclick=()=>open360(b.dataset.inv360Open));g.querySelectorAll('[data-inv360-edit]').forEach(b=>b.onclick=()=>edit360(b.dataset.inv360Edit));g.querySelectorAll('[data-inv360-email]').forEach(b=>b.onclick=()=>location.href='mailto:'+decodeURIComponent(b.dataset.inv360Email))}
function drawer(){const w=shell();if(!w)return null;return document.getElementById('inv360-drawer')}
function close360(){document.getElementById('inv360-drawer')?.classList.remove('open')}
function stats(r){return casesFor(r.name).reduce((a,c)=>{const x=caseAmount(c,r.name);a.cost+=x.cost;a.paid+=x.paid;return a},{cost:0,paid:0})}
async function printInv360(id){
  const r = rows.find(x=>x.id===id);
  if(!r) return;
  const element = document.querySelector('.inv360-sheet');
  if(!element){ toast('Print source not found', true); return; }
  
  toast('Generating PDF Preview...');
  
  // Clone element for printing to avoid messing with live UI
  const clone = element.cloneNode(true);
  clone.style.background = '#ffffff';
  clone.style.color = '#172033';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.margin = '0';
  clone.style.padding = '40px';
  clone.style.maxWidth = '1000px';
  clone.style.borderRadius = '0';
  clone.style.backdropFilter = 'none';
  clone.style.webkitBackdropFilter = 'none';
  clone.style.height = 'auto';
  clone.style.overflow = 'visible';
  
  // Remove interactive elements from print
  clone.querySelectorAll('button, select, .inv360-doc-add, .inv360-quick').forEach(el => el.remove());
  clone.querySelectorAll('.inv360-detail, .inv360-stat').forEach(el => {
    el.style.background = '#f8fafc';
    el.style.border = '1px solid #e2e8f0';
  });
  
  const opt = {
    margin: 10,
    filename: `Investigator_360_${esc(r.name).replace(/\s+/g,'_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, onclone: window.sanitizeHtml2Canvas, scrollY: 0 },
    pagebreak: { mode: ['css', 'legacy', 'avoid-all'] },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    const pdfBlob = await html2pdf().set(opt).from(clone).output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    showPreview(pdfUrl, opt.filename);
    toast('Preview Ready');
  } catch(e) {
    console.error('[DNA 360] Print Error:', e);
    toast('Preview failed: ' + e.message, true);
  }
}

function showPreview(url, filename) {
  let overlay = document.getElementById('inv360-preview-overlay');
  if(!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'inv360-preview-overlay';
    overlay.className = 'inv360-preview-overlay';
    overlay.innerHTML = `
      <div class="inv360-preview-box">
        <div class="inv360-preview-head">
          <h2>PDF Preview</h2>
          <button class="inv360-close" id="inv360-preview-close">✕</button>
        </div>
        <div class="inv360-preview-body">
          <iframe id="inv360-preview-iframe"></iframe>
        </div>
        <div class="inv360-preview-footer">
          <button class="btn btn-ghost" id="inv360-preview-cancel">Cancel</button>
          <button class="btn btn-gold" id="inv360-preview-download">Download PDF</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  
  const iframe = document.getElementById('inv360-preview-iframe');
  iframe.src = url;
  
  overlay.classList.add('open');
  
  const close = () => {
    overlay.classList.remove('open');
    iframe.src = 'about:blank';
  };
  
  document.getElementById('inv360-preview-close').onclick = close;
  document.getElementById('inv360-preview-cancel').onclick = close;
  document.getElementById('inv360-preview-download').onclick = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    toast('Downloading...');
  };
}
async function open360(id){currentId=id;const r=rows.find(x=>x.id===id);if(!r)return;const d=drawer();if(!d)return;const cs=casesFor(r.name),st=stats(r);d.innerHTML=`<div class="inv360-sheet"><div class="inv360-sheet-head"><div><div class="inv360-eyebrow">INVESTIGATOR 360° · LIVE</div><div class="inv360-sheet-title">${esc(r.name)}</div><div class="inv360-sheet-sub">${esc(r.designation||'Investigator')} · ${esc(r.employee_id||'ID not set')}</div></div><button class="inv360-close" type="button">✕</button></div><div class="inv360-section"><div class="inv360-quick">${r.email?`<button class="btn btn-navy btn-sm" data-a="email">✉ Email</button>`:''}${r.phone?`<button class="btn btn-ghost btn-sm" data-a="wa">💬 WhatsApp</button>`:''}<button class="btn btn-ghost btn-sm" data-a="print">🖨 Print Profile</button>${admin()?`<button class="btn btn-gold btn-sm" data-a="edit">✎ Edit Full Profile</button>`:''}</div></div><div class="inv360-section"><h3>Performance & Payment</h3><div class="inv360-stats"><div class="inv360-stat"><b>${cs.length}</b><span>Cases</span></div><div class="inv360-stat"><b>${money(st.cost)}</b><span>Payable</span></div><div class="inv360-stat"><b>${money(st.paid)}</b><span>Paid</span></div><div class="inv360-stat"><b>${money(Math.max(0,st.cost-st.paid))}</b><span>Outstanding</span></div></div></div><div class="inv360-section"><h3>Contact & Location</h3><div class="inv360-detail-grid">${detail('Email',r.email)}${detail('Phone',r.phone)}${detail('Alternate Phone',r.alternate_phone)}${detail('Address',r.address)}${detail('City',r.city)}${detail('State',r.state)}${detail('Pincode',r.pincode)}${detail('Office / Branch',r.office_branch)}</div></div><div class="inv360-section"><h3>Professional</h3><div class="inv360-detail-grid">${detail('Employee ID',r.employee_id)}${detail('Designation',r.designation)}${detail('Joining Date',r.joining_date)}${detail('Experience',r.experience_years!=null?r.experience_years+' years':'')}${detail('Specialization',r.specialization)}${detail('Availability',r.availability)}${detail('Max Active Cases',r.max_active_cases)}${detail('Payment Rate',r.payment_rate?money(r.payment_rate)+' / '+(r.payment_rate_type||'case'):'')}${detail('Emergency Contact',r.emergency_contact_name)}${detail('Emergency Phone',r.emergency_contact_phone)}</div></div><div class="inv360-section"><h3>Assigned Cases</h3>${cs.length?cs.slice(0,50).map(c=>{const x=caseAmount(c,r.name);return `<div class="inv360-case"><b>${esc(c.doc_code||'—')}</b><span>${esc(c.claim_no||'')} · ${esc(c.company||'')} · ${esc(c.date||'')}</span><strong>${money(x.cost)}<small>${esc(x.status)}</small></strong></div>`}).join(''):'<div class="inv360-empty">No cases assigned.</div>'}</div><div class="inv360-section"><h3>Documents</h3><div id="inv360-docs">Loading…</div>${admin()?`<div class="inv360-doc-add"><select id="inv360-doc-type"><option>ID Proof</option><option>Agreement</option><option>Bank Details</option><option>Address Proof</option><option>Other</option></select><input id="inv360-doc-name" placeholder="Document name"><input type="file" id="inv360-doc-file" style="font-size:11px"><input id="inv360-doc-url" placeholder="Or paste URL" style="display:none"><button class="btn btn-gold btn-sm" id="inv360-add-doc" type="button">Add</button></div>`:''}</div><div class="inv360-section"><h3>Recent Activity</h3><div id="inv360-audit">Loading…</div></div></div>`;d.classList.add('open');d.querySelector('.inv360-close').onclick=close360;d.querySelector('[data-a="edit"]')?.addEventListener('click',()=>edit360(id));d.querySelector('[data-a="print"]')?.addEventListener('click',()=>printInv360(id));d.querySelector('[data-a="email"]')?.addEventListener('click',()=>location.href='mailto:'+encodeURIComponent(r.email));d.querySelector('[data-a="wa"]')?.addEventListener('click',()=>{const n=String(r.phone).replace(/\D/g,'');if(n)window.open('https://wa.me/'+(n.length===10?'91':'')+n,'_blank','noopener')});d.querySelector('#inv360-add-doc')?.addEventListener('click',()=>addDoc(id));await loadExtras(id)}
async function loadExtras(id){const c=S();if(!c)return;try{const [dr,ar]=await Promise.allSettled([c.from('investigator_documents').select('*').eq('investigator_id',id).order('created_at',{ascending:false}),c.from('investigator_audit_log').select('*').eq('investigator_id',id).order('created_at',{ascending:false}).limit(20)]);const docs=document.getElementById('inv360-docs'),aud=document.getElementById('inv360-audit');if(docs){if(dr.status==='rejected'||dr.value?.error)docs.innerHTML='<div class="inv360-empty">Documents unavailable.</div>';else docs.innerHTML=(dr.value?.data||[]).map(x=>`<div class="inv360-doc"><span><b>${esc(x.document_name||x.file_name||x.name||'Document')}</b><small>${esc(x.document_type||x.doc_type||'Other')}</small></span>${(x.document_url||x.file_url)?`<a href="${esc(x.document_url||x.file_url)}" target="_blank" rel="noopener">Open</a>`:''}${admin()?`<button class="btn btn-ghost btn-sm" data-doc-del="${esc(x.id)}">Delete</button>`:''}</div>`).join('')||'<div class="inv360-empty">No documents.</div>';docs.querySelectorAll('[data-doc-del]').forEach(b=>b.onclick=()=>deleteDoc(b.dataset.docDel))}if(aud){if(ar.status==='rejected'||ar.value?.error)aud.innerHTML='<div class="inv360-empty">Activity unavailable.</div>';else aud.innerHTML=(ar.value?.data||[]).map(x=>`<div class="inv360-doc"><span><b>${esc(x.action)}</b><small>${esc(JSON.stringify(x.details||{}))}</small></span><span>${esc(new Date(x.created_at).toLocaleString('en-IN'))}</span></div>`).join('')||'<div class="inv360-empty">No recent activity.</div>'}}catch(e){console.warn('[DNA 360] loadExtras exception:',e?.message||e)}}
function editField(label,key,value,type='text'){return `<label class="inv360-edit-field"><span>${esc(label)}</span><input data-edit-key="${esc(key)}" type="${type}" value="${esc(value??'')}"></label>`}
async function edit360(id){if(!admin()){toast('Admin access required to edit investigator details.',true);return}currentId=id;const r=rows.find(x=>x.id===id);if(!r)return;const d=drawer();if(!d)return;d.innerHTML=`<div class="inv360-sheet"><div class="inv360-sheet-head"><div><div class="inv360-eyebrow">ADMIN EDIT</div><div class="inv360-sheet-title">Edit ${esc(r.name)}</div><div class="inv360-sheet-sub">Changes are written directly to Supabase.</div></div><button class="inv360-close" type="button">✕</button></div><div class="inv360-section"><div class="inv360-edit-grid">${editField('Name','name',r.name)}${editField('Phone','phone',r.phone)}${editField('Alternate Phone','alternate_phone',r.alternate_phone)}${editField('Email','email',r.email,'email')}${editField('Employee ID','employee_id',r.employee_id)}${editField('Designation','designation',r.designation)}${editField('Office / Branch','office_branch',r.office_branch)}${editField('Address','address',r.address)}${editField('City','city',r.city)}${editField('State','state',r.state)}${editField('Pincode','pincode',r.pincode)}${editField('Joining Date','joining_date',r.joining_date,'date')}${editField('Experience (years)','experience_years',r.experience_years,'number')}${editField('Max Active Cases','max_active_cases',r.max_active_cases,'number')}<label class="inv360-edit-field"><span>Payment Type</span><select id="inv360-pay-type" data-edit-key="payment_type"><option value="Per Case" ${r.payment_type!=='Salary'?'selected':''}>Per Case</option><option value="Salary" ${r.payment_type==='Salary'?'selected':''}>Salary</option></select></label><div id="inv360-wrap-percase" style="display:${r.payment_type==='Salary'?'none':'contents'}">${editField('Payment Rate','payment_rate',r.payment_rate,'number')}${editField('Payment Rate Type','payment_rate_type',r.payment_rate_type)}</div><div id="inv360-wrap-salary" style="display:${r.payment_type==='Salary'?'contents':'none'}">${editField('Monthly Salary (₹)','salary_amount',r.salary_amount,'number')}</div>${editField('Specialization','specialization',r.specialization)}${editField('Emergency Contact','emergency_contact_name',r.emergency_contact_name)}${editField('Emergency Phone','emergency_contact_phone',r.emergency_contact_phone)}</div><label class="inv360-edit-field"><span>Availability</span><select data-edit-key="availability"><option value="available" ${r.availability==='available'?'selected':''}>Available</option><option value="limited" ${r.availability==='limited'?'selected':''}>Limited</option><option value="leave" ${r.availability==='leave'?'selected':''}>On Leave</option><option value="inactive" ${r.availability==='inactive'?'selected':''}>Inactive</option></select></label><div class="inv360-quick"><button class="btn btn-gold" id="inv360-save-profile" type="button">Save Changes</button><button class="btn btn-ghost" id="inv360-cancel-edit" type="button">Cancel</button></div></div></div>`;d.classList.add('open');d.querySelector('.inv360-close').onclick=close360;d.querySelector('#inv360-cancel-edit').onclick=()=>open360(id);d.querySelector('#inv360-save-profile').onclick=()=>save360(id);const pt=d.querySelector('#inv360-pay-type');if(pt)pt.onchange=(e)=>{const v=e.target.value;d.querySelector('#inv360-wrap-percase').style.display=v==='Salary'?'none':'contents';d.querySelector('#inv360-wrap-salary').style.display=v==='Salary'?'contents':'none'}}
async function save360(id){if(!admin())return;const c=S(),d=document.getElementById('inv360-drawer');const payload={};d.querySelectorAll('[data-edit-key]').forEach(e=>{const k=e.dataset.editKey;let v=e.value;if(['experience_years','max_active_cases','payment_rate','salary_amount'].includes(k))v=v===''?null:Number(v);payload[k]=v===''?null:v});if(payload.payment_type==='Salary'){payload.payment_rate=null;payload.payment_rate_type=null}else{payload.salary_amount=0}const old=rows.find(x=>x.id===id);if(payload.payment_type&&old&&payload.payment_type!==old.payment_type)payload.payment_type_changed_at=new Date().toISOString();const {data,error}=await c.from('investigators').update(payload).eq('id',id).select('*').single();if(error){if(error.code==='23505'){if(error.message&&error.message.includes('uq_investigators_phone')){toast('Save failed: This Phone Number is already registered to another investigator.',true);return}if(error.message&&error.message.includes('uq_investigators_email')){toast('Save failed: This Email Address is already registered to another investigator.',true);return}toast('Save failed: A duplicate entry was detected (Phone or Email).',true);return}toast('Save failed: '+error.message,true);return}const idx=rows.findIndex(x=>x.id===id);if(idx>=0)rows[idx]=data;toast('Investigator details saved');await open360(id);paint()}
async function addDoc(id){if(!admin())return;const c=S(),d=document.getElementById('inv360-drawer');const fileInput=d.querySelector('#inv360-doc-file');const file=fileInput?.files[0];const docName=d.querySelector('#inv360-doc-name')?.value?.trim()||(file?file.name:'');const docType=d.querySelector('#inv360-doc-type')?.value||'Other';let docUrl=d.querySelector('#inv360-doc-url')?.value?.trim()||null;if(!docName){toast('Enter document name or select a file',true);return}if(file){if(!window.driveSettings||!window.googleDriveService?.accessToken){toast('Google Drive not connected. Go to Settings to connect.',true);return}try{toast('Uploading to Google Drive...');const inv=rows.find(x=>x.id===id);const invFolder=await window.googleDriveService.getOrCreateFolder(inv.name,window.driveSettings.investigatorsId);const uploadRes=await window.googleDriveService.uploadFile(file,{name:docName,parents:[invFolder.id]});docUrl=uploadRes.webViewLink;toast('Upload successful!')}catch(e){toast('Upload failed: '+e.message,true);return}}const row={investigator_id:id,document_type:docType,document_name:docName,document_url:docUrl};const {error}=await c.from('investigator_documents').insert(row);if(error){toast('Document add failed: '+error.message,true);return}toast('Document added');await loadExtras(id)}
async function deleteDoc(id){if(!admin()||!confirm('Delete this investigator document?'))return;const c=S(),{error}=await c.from('investigator_documents').delete().eq('id',id);if(error){toast('Delete failed: '+error.message,true);return}toast('Document deleted');await loadExtras(currentId)}
window.openInvestigator360=open360;window.closeInvestigator360=close360;window.inv360PrintStatement=id=>{close360();window.print()};window.ensureInvestigator360=async()=>{legacyGuard();rows=await fetchRows();render()};window.addEventListener('dna:investigators-ready',window.ensureInvestigator360);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(window.ensureInvestigator360,300));else setTimeout(window.ensureInvestigator360,300);})();

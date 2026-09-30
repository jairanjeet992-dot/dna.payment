/* DNA Payments live runtime fixes — existing-file patch layer.
 * Loaded after app.js. Patches runtime behavior without changing the
 * application's Supabase data model.
 */
(()=>{
'use strict';
const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
const role=()=>window.currentUserRole||'staff';
const isAdmin=()=>window.isCurrentUserAdmin===true;
const canEditCases=()=>isAdmin()||role()==='senior'||role()==='junior';
const toast=(m,e)=>window.showToast?.(m,e);
const norm=v=>String(v??'').trim().toUpperCase();
const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
const phone=v=>{const n=String(v??'').replace(/\D/g,'');return n?(n.length===10?'91'+n:n):''};
const amount=v=>Number(v||0);
const assignedSlots=c=>[
  c?.inv1&&c.inv1!=='NA'?{status:c.inv1_status||'',hardcopy:c.hardcopy1_status||''}:null,
  c?.inv2&&c.inv2!=='NA'?{status:c.inv2_status||'',hardcopy:c.hardcopy2_status||''}:null
].filter(Boolean);
const paymentState=c=>{const s=assignedSlots(c).map(x=>x.status);if(!s.length||s.every(x=>!x))return'notset';if(s.every(x=>x==='Paid'))return'paid';return'pending'};
const sameClaimCompany=(a,b)=>norm(a?.claim_no)===norm(b?.claim_no)&&norm(a?.company)===norm(b?.company);
ready(()=>{
  if(typeof window.startInlineEdit==='function'){const original=window.startInlineEdit;window.startInlineEdit=function(cell){if(!isAdmin()){toast('Inline editing is available to admins only.',true);return}return original.apply(this,arguments)}}
  if(typeof window.editCase==='function'){const original=window.editCase;window.editCase=function(idx){if(!canEditCases()){toast('You do not have permission to edit cases.',true);return}const c=(window.cases||[])[idx];window.__dnaEditingDocCode=c?.doc_code||null;return original.apply(this,arguments)}}
  if(typeof window.openAddCase==='function'){const original=window.openAddCase;window.openAddCase=function(){if(!canEditCases()){toast('You do not have permission to create cases.',true);return}window.__dnaEditingDocCode=null;return original.apply(this,arguments)}}
  if(typeof window.deleteCurrentCase==='function'){const original=window.deleteCurrentCase;window.deleteCurrentCase=function(){if(!isAdmin()){toast('Only an admin can delete a case.',true);return}return original.apply(this,arguments)}}
  if(typeof window.bulkDeleteSelected==='function'){const original=window.bulkDeleteSelected;window.bulkDeleteSelected=function(){if(!isAdmin()){toast('Only an admin can bulk-delete cases.',true);return}return original.apply(this,arguments)}}
  if(typeof window.clearAllData==='function'){const original=window.clearAllData;window.clearAllData=function(){if(!isAdmin()){toast('Only an admin can clear all case data.',true);return}return original.apply(this,arguments)}}
  if(typeof window.restoreBackup==='function'){const original=window.restoreBackup;window.restoreBackup=function(e){if(!isAdmin()){toast('Only an admin can restore a backup.',true);if(e?.target)e.target.value='';return}return original.apply(this,arguments)}}
  if(typeof window.saveSettings==='function'){const original=window.saveSettings;window.saveSettings=function(){if(!isAdmin()){toast('Only an admin can change agency settings.',true);return}return original.apply(this,arguments)}}

  window.showDupClaimModal=function(existingCase){
    const box=document.getElementById('dup-claim-details');
    if(box){const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));box.innerHTML=[['Doc Code',existingCase?.doc_code||'—'],['Claim No',existingCase?.claim_no||'—'],['Company',existingCase?.company||'—'],['Insured',existingCase?.insured_name||'—'],['Date',existingCase?.date||'—'],['Investigator',existingCase?.inv1||'—'],['Payable',`Rs ${fmt(existingCase?.total_payable)}`],['Received',`Rs ${fmt(existingCase?.received)}`]].map(([k,v])=>`<div><b>${k}:</b> ${esc(v)}</div>`).join('')}
    window.__dnaDuplicateExisting=existingCase||null;document.getElementById('dup-claim-modal')?.classList.add('open');
  };
  window.confirmDupClaimSave=function(){const existing=window.__dnaDuplicateExisting;closeModal?.('dup-claim-modal');if(existing){const idx=(window.cases||[]).findIndex(c=>c.doc_code===existing.doc_code);if(idx>=0){window.editCase?.(idx);return}}toast('Duplicate claim was not saved. Review the existing case instead.',true)};
  window.saveCase=async function(){
    const $=id=>document.getElementById(id);const claim=$('f-claim')?.value.trim()||'',company=$('f-company')?.value.trim()||'',inv1=$('f-inv1')?.value||'',insured=$('f-insured')?.value.trim()||'',date=$('f-date')?.value||'';
    if(!claim||!company||!inv1||!insured||!date){toast('Please fill all required fields.',true);return}
    const editing=window.__dnaEditingDocCode||null;const duplicate=(window.cases||[]).find(c=>c.doc_code!==editing&&sameClaimCompany(c,{claim_no:claim,company}));if(duplicate){window.showDupClaimModal(duplicate);return}
    const outcome = $('f-outcome')?$('f-outcome').value:'Pending';
    const sla_hours = parseInt($('f-sla')?.value)||null;
    let due_date = null;
    if (sla_hours && date) { const d = new Date(date); d.setHours(d.getHours() + sla_hours); due_date = d.toISOString(); }
    const existingCase = editing ? (window.cases||[]).find(c=>c.doc_code===editing) : null;
    const exception_type = existingCase ? existingCase.exception_type : null;
    const exception_reason = existingCase ? existingCase.exception_reason : null;
    const exception_at = existingCase ? existingCase.exception_at : null;
    const exception_by = existingCase ? existingCase.exception_by : null;
    const risk_level = existingCase ? existingCase.risk_level : null;
    const isResolvedOutcome = ['genuine', 'repudiated', 'fraud', 'settled', 'closed'].includes((outcome || '').toLowerCase().trim());
    let completed_at = null;
    const manualClosed = $('f-completed-at')?.value?.trim();
    if (manualClosed) {
      completed_at = manualClosed.includes('T') ? manualClosed : `${manualClosed.slice(0, 10)}T18:00:00.000Z`;
    } else if (isResolvedOutcome) {
      completed_at = (existingCase && existingCase.completed_at) ? existingCase.completed_at : new Date().toISOString();
    } else if (existingCase && existingCase.completed_at && (outcome || '').toLowerCase().trim() === 'pending') {
      completed_at = null;
    } else {
      completed_at = existingCase ? existingCase.completed_at : null;
    }
    const tds_deducted = Math.max(0, parseFloat($('f-tds')?.value) || 0);
    const company_hardcopy_status = $('f-companyhardcopy') ? $('f-companyhardcopy').value : 'Pending';
    const company_hardcopy_awb = $('f-companyawb') ? $('f-companyawb').value : '';
    let custom_data = null;
    if (typeof window.extractCustomFieldValuesFromForm === 'function') {
      custom_data = window.extractCustomFieldValuesFromForm();
    }
    const transferReason = $('f-transfer-reason')?.value?.trim() || '';
    if (editing && existingCase && (inv1 !== existingCase.inv1 || (($('f-inv2')?.value || '') !== (existingCase.inv2 || '')))) {
      if (!transferReason) {
        toast('Please provide a reason for ownership transfer.', true);
        $('f-transfer-reason')?.focus();
        return;
      }
    }
    const rawInv2=$('f-inv2')?.value||'';
    const samePerson=Boolean(inv1&&inv1!=='NA'&&rawInv2&&inv1.trim().toLowerCase()===rawInv2.trim().toLowerCase());
    const finalInv2Status=samePerson?($('f-inv1status')?.value||''):($('f-inv2status')?.value||'');
    const finalHc2Status=samePerson?($('f-hardcopy1status')?.value||''):($('f-hardcopy2status')?.value||'');
    const fee1=parseFloat($('f-fee1')?.value)||0;
    const fee2=parseFloat($('f-fee2')?.value)||0;
    const ta1=parseFloat($('f-ta1')?.value)||0;
    const ta2=parseFloat($('f-ta2')?.value)||0;
    const received=parseFloat($('f-received')?.value)||0;
    const calc = typeof calculateCasePayableAndProfit === 'function' ? calculateCasePayableAndProfit({
      fee1, fee2, ta1, ta2, received, tds_deducted,
      inv1, inv2: rawInv2, date
    }) : { payable: fee1 + fee2 + ta1 + ta2, profit: (received + tds_deducted) - (fee1 + fee2 + ta1 + ta2) };

    const fields={company,date,case_type:$('f-casetype')?.value||'',claim_no:claim,policy_no:$('f-policy')?.value||'',insured_name:insured,hospital:$('f-hospital')?.value||'',location:$('f-location')?.value||'',inv1,inv2:rawInv2,fee1,fee2,ta1,ta2,received,tds_deducted,invoice_no:$('f-invoice')?.value||'',invoice_amount:parseFloat($('f-invoice-amount')?.value)||null,inv1_status:$('f-inv1status')?.value||'',inv2_status:finalInv2Status,hardcopy1_status:$('f-hardcopy1status')?.value||'',hardcopy2_status:finalHc2Status,company_hardcopy_status,company_hardcopy_awb,outcome,sla_hours,due_date,exception_type,exception_reason,exception_at,exception_by,risk_level,completed_at,total_payable:calc.payable,profit:calc.profit,remarks:$('f-remarks')?.value||'',custom_data};
    const btn=document.querySelector('#case-modal .modal-foot .btn-navy');if(btn){btn.disabled=true;btn.textContent='Saving…'}
    try{if(editing)await updateCaseDB(editing,fields);else{const doc=await genDocCodeDB(date);if(!doc)throw new Error('Document code generation returned empty.');await insertCaseDB({doc_code:doc,...fields});}await loadCasesFromDB();closeModal?.('case-modal');window.__dnaEditingDocCode=null;renderAll?.();checkOverdueAlerts?.();toast(editing?'Case updated.':'Case added.')}catch(err){toast(err?.code==='23505'?'Duplicate Claim No for this company already exists.':'Save failed: '+(err?.message||err),true)}finally{if(btn){btn.disabled=false;btn.textContent='Save Case'}}
  };

  window.handleImport=function(e){
    const file=e?.target?.files?.[0];if(!file)return;const name=String(file.name||'').toLowerCase();const fail=m=>{toast(m,true);if(e?.target)e.target.value=''};
    if(/\.csv$/.test(name)){const r=new FileReader();r.onload=async ev=>{try{if(typeof window.showSmartImportPreview==='function'){await window.showSmartImportPreview(ev.target.result,`File: ${file.name}`)}else{showImportPreview(parseCsvRows(ev.target.result),`File: ${file.name}`)}}catch(err){fail('Import failed: '+err.message)}};r.readAsText(file);e.target.value='';return}
    if(!/\.(xlsx|xls)$/.test(name)){fail('Please select an Excel (.xlsx/.xls) or CSV file.');return}if(!window.XLSX){fail('Excel import library is not loaded. Reload the page and try again.');return}
    const r=new FileReader();r.onload=async ev=>{try{const wb=XLSX.read(ev.target.result,{type:'array',cellDates:false});if(!wb.SheetNames.length)throw new Error('Workbook contains no sheets.');const csv=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]],{blankrows:false});if(typeof window.showSmartImportPreview==='function'){await window.showSmartImportPreview(csv,`Excel: ${file.name} · ${wb.SheetNames[0]}`)}else{showImportPreview(parseCsvRows(csv),`Excel: ${file.name} · ${wb.SheetNames[0]}`)}}catch(err){fail('Excel import failed: '+err.message)}};r.readAsArrayBuffer(file);e.target.value='';
  };
  if(typeof window.showImportPreview==='function'){const originalPreview=window.showImportPreview;window.showImportPreview=function(rows,sourceLabel){const existingKeys=new Set((window.cases||[]).map(c=>norm(c.company)+'|'+norm(c.claim_no)));const seen=new Set();(rows||[]).forEach(r=>{if(!r||r.error||!r.claim_no)return;const key=norm(r.company)+'|'+norm(r.claim_no);r.isDuplicate=existingKeys.has(key)||seen.has(key);r.duplicateReason=existingKeys.has(key)?'existing':(seen.has(key)?'batch':null);seen.add(key)});return originalPreview(rows,sourceLabel)}}

  window.applyBulkEdit=async function(){
    const field=document.getElementById('bulkedit-field')?.value||'';if(!field){toast('Select a field to edit.',true);return}const selectWrap=document.getElementById('bulkedit-select-wrap');const newVal=selectWrap?.style.display==='block'?(document.getElementById('bulkedit-select')?.value||''):(document.getElementById('bulkedit-value')?.value||'');if(newVal===''){toast('Enter a value to apply.',true);return}const numeric=['fee1','fee2','ta1','ta2','received','invoice_amount'];const value=numeric.includes(field)?parseFloat(newVal):newVal;if(numeric.includes(field)&&Number.isNaN(value)){toast('Invalid number value.',true);return}const docCodes=Array.from(selectedDocCodes||[]);if(!docCodes.length){toast('Select at least one case first.',true);return}if(!confirm(`Apply "${field}" = "${newVal}" to ${docCodes.length} selected case(s)?`))return;
    const btn = document.querySelector('#bulkedit-modal .modal-foot .btn-navy');
    if (btn) { btn.disabled = true; btn.textContent = 'Applying…'; }
    if(typeof window.recordBatchSnapshot==='function'){
      window.recordBatchSnapshot({
        action:`Bulk Edit: set '${field}' = "${newVal}"`,
        type:'update',
        docCodes,
        newState:{[field]:value},
        metadata:{updatedFields:[field],value:value}
      });
    }
    try{
      const CHUNK_SIZE = 25;
      const isFinancial = ['fee1','fee2','ta1','ta2','received','tds_deducted'].includes(field);
      for (let i = 0; i < docCodes.length; i += CHUNK_SIZE) {
        const chunk = docCodes.slice(i, i + CHUNK_SIZE);
        if (isFinancial) {
          for (const dCode of chunk) {
            const ex = (window.cases || []).find(x => x.doc_code === dCode) || {};
            const simulated = { ...ex, [field]: value };
            const calc = typeof calculateCasePayableAndProfit === 'function'
              ? calculateCasePayableAndProfit(simulated)
              : null;
            const patch = { [field]: value };
            if (calc) {
              patch.total_payable = calc.payable;
              patch.profit = calc.profit;
            }
            const { error } = await supabaseClient.from('cases').update(patch).eq('doc_code', dCode);
            if (error) throw error;
          }
        } else if (field === 'outcome') {
          const isResolved = ['genuine', 'repudiated', 'fraud', 'settled', 'closed'].includes(String(value).toLowerCase().trim());
          const patch = { outcome: value };
          if (isResolved) patch.completed_at = new Date().toISOString();
          const { error } = await supabaseClient.from('cases').update(patch).in('doc_code', chunk);
          if (error) throw error;
        } else {
          const {error}=await supabaseClient.from('cases').update({[field]:value}).in('doc_code',chunk);
          if(error)throw error;
        }
        if (btn) btn.textContent = `Applying (${Math.min(i + CHUNK_SIZE, docCodes.length)}/${docCodes.length})…`;
      }
      closeModal('bulkedit-modal');
      await loadCasesFromDB();
      renderAll();
      toast(`Updated ${docCodes.length} case(s). (Undo available in Rollback Log)`);
    }catch(err){
      toast('Bulk edit failed: '+err.message,true);
    }finally{
      if (btn) { btn.disabled = false; btn.textContent = 'Apply to Selected'; }
    }
  };

  window.runReconciliation=async function(){
    const input=document.getElementById('recon-file');if(!input?.files?.[0]){toast('Please upload a CSV file first.',true);return}const dateFmt=document.getElementById('recon-datefmt')?.value||'dd-mm-yyyy';const rows=parseCSV(await input.files[0].text());if(rows.length<2){toast('CSV looks empty or malformed.',true);return}const h=rows[0].map(x=>String(x).trim()),ai=detectAmountCol(h),di=detectDateCol(h),xi=detectDescCol(h),candidates=cases.filter(c=>amount(c.received)<amount(c.total_payable)),used=new Set(),auto=[],unmatched=[];
    for(const r of rows.slice(1)){const raw=parseFloat(String(r[ai]||'').replace(/[^0-9.-]/g,''));if(Number.isNaN(raw))continue;const amt=Math.abs(raw),dt=parseReconDate(r[di],dateFmt),desc=norm(r[xi]||'');let scored=[];for(const c of candidates){if(used.has(c.doc_code))continue;const remaining=Math.max(0,amount(c.total_payable)-amount(c.received));if(Math.abs(remaining-amt)>Math.max(5,amt*0.005))continue;let score=2;if(c.date&&dt){const days=Math.abs((new Date(c.date)-dt)/86400000);if(days>10)continue;score+=Math.max(0,2-days/5)}else score+=1;const tokens=[c.company,c.claim_no,c.doc_code,c.invoice_no,c.policy_no].filter(Boolean).map(norm);if(tokens.some(t=>desc.includes(t)||t.includes(desc)))score+=4;scored.push({c,score})}scored.sort((a,b)=>b.score-a.score);const best=scored[0],tie=best&&scored[1]&&best.score===scored[1].score;if(best&&!tie){used.add(best.c.doc_code);auto.push({docCode:best.c.doc_code,case:best.c,txn:{amt,date:dt?dt.toISOString().slice(0,10):'',desc:r[xi]||''}})}else unmatched.push({amt,date:dt?dt.toISOString().slice(0,10):'',desc:r[xi]||''})}
    window.reconState={auto,unmatched};renderReconResults();
  };
  window.applyReconciliation=async function(){
    const auto=window.reconState?.auto||[],chosen=auto.filter((_,i)=>document.querySelector(`[data-recon-i="${i}"]`)?.checked);
    if(!chosen.length){toast('No matches selected.',true);return}
    const docCodes = chosen.map(m => m.docCode);
    if(typeof window.recordBatchSnapshot==='function'){
      window.recordBatchSnapshot({
        action:`Bank Reconciliation: matched ${chosen.length} cases`,
        type:'update',
        docCodes
      });
    }
    let ok=0;for(const m of chosen){try{const next=Math.min(amount(m.case.total_payable),amount(m.case.received)+amount(m.txn.amt));const {error}=await supabaseClient.from('cases').update({received:next,received_date:m.txn.date||new Date().toISOString().slice(0,10)}).eq('doc_code',m.docCode);if(error)throw error;ok++}catch(e){console.error('[DNA] reconciliation',e)}}await loadCasesFromDB();renderAll();closeModal('recon-modal');toast(`Updated received amounts for ${ok} case(s). (Undo available in Rollback Log)`,ok<chosen.length);
  };

  window.computeScorecard=function(monthStr){const prefix=(monthStr||'')+'-',rows=[];for(const inv of investigatorRows){const name=String(inv.name||''),myCases=cases.filter(c=>norm(c.inv1)===norm(name)||norm(c.inv2)===norm(name)).filter(c=>String(c.date||'').startsWith(prefix));if(!myCases.length)continue;const completed=myCases.filter(c=>{const slots=assignedSlots(c);return slots.length>0&&slots.every(s=>s.status==='Paid')}).length,payable=myCases.reduce((s,c)=>s+amount(c.total_payable),0),received=myCases.reduce((s,c)=>s+amount(c.received),0),receivedPct=payable?Math.round(received/payable*100):0,hcOnTime=myCases.filter(c=>{const slots=assignedSlots(c);return slots.length>0&&slots.every(s=>s.hardcopy==='Received')}).length,hcPct=myCases.length?Math.round(hcOnTime/myCases.length*100):0,paidDates=myCases.filter(c=>c.received_date&&amount(c.received)),avgDays=paidDates.length?paidDates.reduce((s,c)=>s+Math.max(0,(new Date(c.received_date)-new Date(c.date))/86400000),0)/paidDates.length:0,completionPct=Math.round(completed/myCases.length*100),speedScore=avgDays===0?100:Math.max(0,100-avgDays*3),volumeScore=Math.min(100,myCases.length*8),score=Math.round(completionPct*.25+speedScore*.25+hcPct*.15+receivedPct*.20+volumeScore*.15);rows.push({name,cases:myCases.length,completed,completionPct,avgDays:Math.round(avgDays),hcPct,totalPayable:payable,totalReceived:received,receivedPct,score})}rows.sort((a,b)=>b.score-a.score);return rows};

  window.matchResults = [];
  window.currentMatchFilter = 'all';

  window.syncMatchRowCalc = function(el) {
    const tr = el.closest('tr');
    if (!tr) return;
    const feeInp = tr.querySelector('.match-fee-input');
    const expInp = tr.querySelector('.match-exp-input');
    const invAmtInp = tr.querySelector('.match-invamt-input');
    const amtInp = tr.querySelector('.match-amt-input');
    const hintEl = tr.querySelector('.match-row-hint');

    const fee = parseFloat(feeInp?.value) || 0;
    const exp = parseFloat(expInp?.value) || 0;
    
    // Auto recalculate total invoice if user edits fee or TAT
    if (el === feeInp || el === expInp) {
      if (fee > 0 || exp > 0) {
        const taxable = fee + exp;
        const total = Math.round(taxable * 1.18);
        if (invAmtInp) invAmtInp.value = total;
      }
    }

    const invAmt = parseFloat(invAmtInp?.value) || 0;
    const recv = parseFloat(amtInp?.value) || 0;

    if (hintEl) {
      if (invAmt > 0 && recv > 0 && recv < invAmt) {
        const diff = Math.round((invAmt - recv) * 100) / 100;
        const base10 = Math.round((invAmt / 1.18) * 0.10);
        const gross10 = Math.round(invAmt * 0.10);
        if (Math.abs(diff - base10) <= 2 || Math.abs(diff - gross10) <= 2) {
          hintEl.innerHTML = `<span style="color:#059669; font-weight:700;">⚡ 10% TDS Detected: ₹${diff} will be credited to TDS ledger</span>`;
        } else {
          hintEl.innerHTML = `<span style="color:#d97706; font-weight:600;">Short Settlement: ₹${diff} balance pending</span>`;
        }
      } else if (invAmt > 0 && recv >= invAmt) {
        hintEl.innerHTML = `<span style="color:#059669; font-weight:700;">✓ Full payment matched</span>`;
      } else {
        hintEl.innerHTML = '';
      }
    }
  };

  window.filterMatchRows = function(filter, btnEl) {
    window.currentMatchFilter = filter;
    const pills = document.querySelectorAll('#match-filter-pills button');
    pills.forEach(b => {
      b.className = 'btn btn-ghost btn-sm';
    });
    if (btnEl) btnEl.className = 'btn btn-navy btn-sm';
    renderMatchResults(window.matchResults || [], filter);
  };

  window.runMatch = function() {
    const raw = document.getElementById('match-input')?.value.trim();
    if (!raw) return;
    const lines = raw.split('\n').map(x => x.trim()).filter(Boolean);
    if (lines.length < 2) {
      toast('Please paste data with a Header row and at least one data row.', true);
      return;
    }
    const parseRow = (line) => line.split(/\t|,/).map(x => x.trim());
    const headers = parseRow(lines[0]).map(norm);

    const claimIdx = headers.findIndex(h => h.includes('CLAIM'));
    const compIdx = headers.findIndex(h => h.includes('COMPANY') || h.includes('CLIENT'));
    const typeIdx = headers.findIndex(h => h.includes('TYPE'));
    const insuredIdx = headers.findIndex(h => h.includes('INSURED') || h.includes('NAME') || h.includes('PATIENT'));
    const invIdx = headers.findIndex(h => h.includes('INVOICE NO') || h.includes('INV NO') || h.includes('INVOICE #') || h === 'INVOICE' || h === 'INV');
    const dateIdx = headers.findIndex(h => h.includes('INVOICE DATE') || h.includes('INV DATE') || h.includes('BILL DATE'));
    const feeIdx = headers.findIndex(h => h.includes('PROFESSIONAL') || h.includes('PROF FEE') || h.includes('FEE') || h === 'BASE FEE');
    const expIdx = headers.findIndex(h => h.includes('TAT') || h.includes('CONVEYANCE') || h.includes('EXPENSE') || h.includes('OTHER EXP') || h.includes('TA'));
    const invAmtIdx = headers.findIndex(h => h.includes('INVOICE AMOUNT') || h.includes('INVOICE AMT') || h.includes('BILLED') || h.includes('TOTAL AMOUNT') || h.includes('TOTAL BILL'));
    const amtIdx = headers.findIndex(h => h.includes('AMOUNT PAID') || h.includes('RECEIVED') || h.includes('PAID') || (h.includes('AMOUNT') && !h.includes('INVOICE') && !h.includes('FEE')));

    if (claimIdx === -1) {
      toast('Could not find a Claim column. Please ensure headers are included.', true);
      return;
    }

    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const p = parseRow(lines[i]);
      const claim = p[claimIdx] || '';
      if (!claim) continue;
      const company = compIdx !== -1 ? (p[compIdx] || '') : '';
      const type = typeIdx !== -1 ? (p[typeIdx] || '') : '';
      const insured = insuredIdx !== -1 ? (p[insuredIdx] || '') : '';
      const invoiceNo = invIdx !== -1 ? (p[invIdx] || '') : '';
      const invoiceDate = dateIdx !== -1 ? (p[dateIdx] || '') : '';
      let fee = feeIdx !== -1 ? (p[feeIdx] || '') : '';
      let expense = expIdx !== -1 ? (p[expIdx] || '') : '';
      let invoiceAmt = invAmtIdx !== -1 ? (p[invAmtIdx] || '') : '';
      const amountReceived = amtIdx !== -1 ? (p[amtIdx] || '') : '';

      let matches = cases.filter(c => norm(c.claim_no) === norm(claim));
      if (company) {
        const compMatches = matches.filter(c => norm(c.company) === norm(company));
        if (compMatches.length > 0) matches = compMatches;
      }

      if (matches.length === 0) {
        results.push({ claim, company, insured, invoiceNo, invoiceDate, fee, expense, invoiceAmt, amountReceived, status: 'new', note: 'Not found in system yet', existing: null });
        continue;
      }

      if (matches.length > 1) {
        results.push({ claim, company, insured, invoiceNo, invoiceDate, fee, expense, invoiceAmt, amountReceived, status: 'mismatch', note: `Multiple cases found (${matches.length})`, existing: matches[0] });
        continue;
      }

      const existing = matches[0];
      const mism = [];
      if (insured && norm(existing.insured_name) !== norm(insured) && !norm(existing.insured_name).includes(norm(insured)) && !norm(insured).includes(norm(existing.insured_name))) {
        mism.push('Insured name differs');
      }
      if (type && norm(existing.case_type) !== norm(type)) {
        mism.push('Case type differs');
      }

      // Auto calculate invoiceAmt if fee/expense provided
      const numFee = parseFloat(fee.replace(/[^0-9.-]/g, ''));
      const numExp = parseFloat(expense.replace(/[^0-9.-]/g, ''));
      if (!invoiceAmt && (!isNaN(numFee) || !isNaN(numExp))) {
        const taxable = (isNaN(numFee) ? 0 : numFee) + (isNaN(numExp) ? 0 : numExp);
        if (taxable > 0) invoiceAmt = String(Math.round(taxable * 1.18));
      }

      results.push({
        claim, company, insured, invoiceNo, invoiceDate, fee, expense, invoiceAmt, amountReceived,
        status: mism.length ? 'mismatch' : 'match',
        note: mism.length ? mism.join('; ') : `Doc code: ${existing.doc_code || '—'}`,
        docCode: existing.doc_code,
        existing
      });
    }

    window.matchResults = results;
    window.currentMatchFilter = 'all';
    renderMatchResults(results, 'all');
  };

  function renderMatchResults(results, filter = 'all') {
    const panel = document.getElementById('match-results-panel');
    if (panel) panel.style.display = 'block';

    // Count statistics
    const cntAll = results.length;
    const cntUnbilled = results.filter(r => r.existing && (!r.existing.invoice_amount || Number(r.existing.invoice_amount) === 0)).length;
    const cntBilled = results.filter(r => r.existing && Number(r.existing.invoice_amount) > 0).length;
    const cntPaid = results.filter(r => r.existing && Number(r.existing.received) >= Number(r.existing.invoice_amount) && Number(r.existing.invoice_amount) > 0).length;
    const cntNew = results.filter(r => r.status === 'new').length;

    const elAll = document.getElementById('mf-cnt-all'); if (elAll) elAll.textContent = cntAll;
    const elUnbilled = document.getElementById('mf-cnt-unbilled'); if (elUnbilled) elUnbilled.textContent = cntUnbilled;
    const elBilled = document.getElementById('mf-cnt-billed'); if (elBilled) elBilled.textContent = cntBilled;
    const elPaid = document.getElementById('mf-cnt-paid'); if (elPaid) elPaid.textContent = cntPaid;
    const elNew = document.getElementById('mf-cnt-new'); if (elNew) elNew.textContent = cntNew;

    // Filter results to display
    let visible = results;
    if (filter === 'unbilled') {
      visible = results.filter(r => r.existing && (!r.existing.invoice_amount || Number(r.existing.invoice_amount) === 0));
    } else if (filter === 'billed') {
      visible = results.filter(r => r.existing && Number(r.existing.invoice_amount) > 0);
    } else if (filter === 'paid') {
      visible = results.filter(r => r.existing && Number(r.existing.received) >= Number(r.existing.invoice_amount) && Number(r.existing.invoice_amount) > 0);
    } else if (filter === 'new') {
      visible = results.filter(r => r.status === 'new');
    }

    const tbody = document.getElementById('match-tbody');
    if (!tbody) return;
    tbody.textContent = '';

    if (visible.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--sub);">No rows match the selected filter.</td></tr>`;
      return;
    }

    visible.forEach(r => {
      const tr = document.createElement('tr');
      if (r.status === 'match') tr.setAttribute('data-doc-code', r.docCode);

      const isPaid = r.existing && Number(r.existing.received) >= Number(r.existing.invoice_amount) && Number(r.existing.invoice_amount) > 0;
      const isPartPaid = r.existing && Number(r.existing.received) > 0 && Number(r.existing.received) < Number(r.existing.invoice_amount);
      const isUnbilled = r.existing && (!r.existing.invoice_amount || Number(r.existing.invoice_amount) === 0);

      // Col 1: Claim No
      const tdClaim = document.createElement('td');
      tdClaim.className = 'mono';
      tdClaim.style.fontWeight = '700';
      tdClaim.textContent = r.claim;
      tr.appendChild(tdClaim);

      // Col 2: Company & Insured
      const tdComp = document.createElement('td');
      tdComp.innerHTML = `
        <div style="font-weight:700; color:var(--navy); font-size:12px;">${esc(r.company || r.existing?.company || '—')}</div>
        <div style="font-size:11px; color:var(--sub);">${esc(r.insured || r.existing?.insured_name || '—')}</div>
      `;
      tr.appendChild(tdComp);

      // Col 3: Existing in System (DB)
      const tdDb = document.createElement('td');
      if (r.existing) {
        tdDb.innerHTML = `
          <div style="font-size:11px; line-height:1.45; background:var(--paper); padding:6px 8px; border-radius:4px; border-left:3px solid var(--navy);">
            <div><span style="color:var(--sub);">Doc:</span> <b class="mono" style="color:var(--navy);">${esc(r.existing.doc_code || '—')}</b></div>
            <div><span style="color:var(--sub);">Inv No:</span> <b>${r.existing.invoice_no && r.existing.invoice_no !== '0' ? esc(r.existing.invoice_no) : '<span style="color:var(--sub);">None</span>'}</b></div>
            <div><span style="color:var(--sub);">Billed:</span> ${Number(r.existing.invoice_amount || 0) > 0 ? `<b style="color:var(--navy);">₹${Number(r.existing.invoice_amount).toLocaleString('en-IN')}</b>` : '<span style="color:var(--sub);">₹0</span>'}</div>
            <div><span style="color:var(--sub);">Recv:</span> ${Number(r.existing.received || 0) > 0 ? `<b style="color:var(--green);">₹${Number(r.existing.received).toLocaleString('en-IN')}</b>` : '<span style="color:var(--sub);">₹0</span>'}</div>
            ${isPaid ? '<span class="badge" style="background:#dcfce7; color:#166534; font-size:9.5px; font-weight:700; margin-top:3px; display:inline-block;">✓ Paid in Full</span>' : ''}
            ${isPartPaid ? '<span class="badge" style="background:#fef3c7; color:#92400e; font-size:9.5px; font-weight:700; margin-top:3px; display:inline-block;">⚡ Part Paid</span>' : ''}
            ${isUnbilled ? '<span class="badge" style="background:#f1f5f9; color:#475569; font-size:9.5px; font-weight:600; margin-top:3px; display:inline-block;">⚪ Unbilled</span>' : ''}
          </div>
        `;
      } else {
        tdDb.innerHTML = `<span style="color:var(--sub); font-size:11px;"><i>Not found in DB</i></span>`;
      }
      tr.appendChild(tdDb);

      // Col 4: Status Badge
      const tdSt = document.createElement('td');
      const stBadge = document.createElement('span');
      stBadge.className = 'badge ' + (r.status === 'match' ? 'paid' : r.status === 'mismatch' ? 'overdue' : 'pending');
      stBadge.textContent = r.status === 'match' ? 'Matched' : r.status === 'mismatch' ? 'Mismatch' : 'New Claim';
      tdSt.appendChild(stBadge);
      if (r.status !== 'match') {
        const noteDiv = document.createElement('div');
        noteDiv.style.fontSize = '10px';
        noteDiv.style.color = 'var(--sub)';
        noteDiv.style.marginTop = '4px';
        noteDiv.textContent = r.note;
        tdSt.appendChild(noteDiv);
      }
      tr.appendChild(tdSt);

      // Col 5: Updates (Form / Editable)
      const tdUp = document.createElement('td');
      if (r.status === 'match') {
        tdUp.innerHTML = `
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(115px, 1fr)); gap:6px; font-size:11px;">
            <div>
              <label style="display:block; font-size:10px; color:var(--sub); font-weight:600;">Inv No:</label>
              <input type="text" class="match-inv-input" placeholder="${esc(r.existing?.invoice_no && r.existing?.invoice_no !== '0' ? r.existing.invoice_no : 'Skip')}" value="${esc(r.invoiceNo)}" style="width:100%; padding:3px 6px; border:1px solid var(--line); border-radius:3px; font-size:11px; font-family:var(--mono);">
            </div>
            <div>
              <label style="display:block; font-size:10px; color:var(--sub); font-weight:600;">Inv Date:</label>
              <input type="date" class="match-invdate-input" value="${esc(r.invoiceDate || (r.existing?.invoice_date ? r.existing.invoice_date.slice(0, 10) : ''))}" style="width:100%; padding:3px 6px; border:1px solid var(--line); border-radius:3px; font-size:11px;">
            </div>
            <div>
              <label style="display:block; font-size:10px; color:var(--sub); font-weight:600;">Prof Fee (₹):</label>
              <input type="number" class="match-fee-input" placeholder="${esc(r.existing?.invoice_fee || '0')}" value="${esc(r.fee)}" oninput="syncMatchRowCalc(this)" style="width:100%; padding:3px 6px; border:1px solid var(--line); border-radius:3px; font-size:11px;">
            </div>
            <div>
              <label style="display:block; font-size:10px; color:var(--sub); font-weight:600;">TAT / Exp (₹):</label>
              <input type="number" class="match-exp-input" placeholder="${esc(r.existing?.invoice_expense || '0')}" value="${esc(r.expense)}" oninput="syncMatchRowCalc(this)" style="width:100%; padding:3px 6px; border:1px solid var(--line); border-radius:3px; font-size:11px;">
            </div>
            <div>
              <label style="display:block; font-size:10px; color:var(--navy); font-weight:700;">Total Inv (₹):</label>
              <input type="number" class="match-invamt-input" placeholder="${esc(r.existing?.invoice_amount || '0')}" value="${esc(r.invoiceAmt)}" oninput="syncMatchRowCalc(this)" style="width:100%; padding:3px 6px; border:1px solid var(--navy); border-radius:3px; font-size:11px; font-weight:700; color:var(--navy);">
            </div>
            <div>
              <label style="display:block; font-size:10px; color:var(--green); font-weight:700;">Received (₹):</label>
              <input type="number" class="match-amt-input" placeholder="${esc(r.existing?.received || '0')}" value="${esc(r.amountReceived)}" oninput="syncMatchRowCalc(this)" style="width:100%; padding:3px 6px; border:1px solid var(--green); border-radius:3px; font-size:11px; font-weight:700; color:var(--green);">
            </div>
          </div>
          <div class="match-row-hint" style="font-size:10.5px; margin-top:4px;"></div>
        `;
        setTimeout(() => {
          const anyInp = tdUp.querySelector('.match-amt-input') || tdUp.querySelector('.match-invamt-input');
          if (anyInp) window.syncMatchRowCalc(anyInp);
        }, 0);
      } else {
        tdUp.innerHTML = `<span style="color:var(--sub); font-size:11px;">${esc(r.note)}</span>`;
      }
      tr.appendChild(tdUp);

      // Col 6: Action
      const tdAct = document.createElement('td');
      tdAct.style.textAlign = 'center';
      if (r.status === 'match') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-navy btn-sm';
        btn.style.padding = '4px 10px';
        btn.style.fontSize = '11px';
        btn.textContent = 'Update';
        btn.onclick = () => window.applyMatchUpdate(tr, r.docCode);
        tdAct.appendChild(btn);
      }
      tr.appendChild(tdAct);

      tbody.appendChild(tr);
    });
  }

  window.applyMatchUpdate = async function(trEl, docCode) {
    const invInput = trEl.querySelector('.match-inv-input');
    const invDateInput = trEl.querySelector('.match-invdate-input');
    const feeInput = trEl.querySelector('.match-fee-input');
    const expInput = trEl.querySelector('.match-exp-input');
    const invAmtInput = trEl.querySelector('.match-invamt-input');
    const amtInput = trEl.querySelector('.match-amt-input');

    const updates = {};
    if (invInput && invInput.value.trim() !== '') updates.invoice_no = invInput.value.trim();
    if (invDateInput && invDateInput.value.trim() !== '') updates.invoice_date = invDateInput.value.trim();

    if (feeInput && feeInput.value.trim() !== '') {
      const f = parseFloat(feeInput.value.trim().replace(/[^0-9.-]/g, ''));
      if (!isNaN(f)) updates.invoice_fee = f;
    }
    if (expInput && expInput.value.trim() !== '') {
      const e = parseFloat(expInput.value.trim().replace(/[^0-9.-]/g, ''));
      if (!isNaN(e)) updates.invoice_expense = e;
    }
    if (invAmtInput && invAmtInput.value.trim() !== '') {
      const amt = parseFloat(invAmtInput.value.trim().replace(/[^0-9.-]/g, ''));
      if (!isNaN(amt)) updates.invoice_amount = amt;
    }

    const exCase = cases.find(c => c.doc_code === docCode);

    if (amtInput && amtInput.value.trim() !== '') {
      const amt = parseFloat(amtInput.value.trim().replace(/[^0-9.-]/g, ''));
      if (!isNaN(amt)) {
        const capAmt = updates.invoice_amount || exCase?.invoice_amount || exCase?.total_payable || 0;
        updates.received = (amt > capAmt && capAmt > 0) ? capAmt : amt;
        updates.received_date = new Date().toISOString().slice(0, 10);
      }
    }

    const finalInvAmt = updates.invoice_amount !== undefined ? updates.invoice_amount : Number(exCase?.invoice_amount || 0);
    const finalRecAmt = updates.received !== undefined ? updates.received : Number(exCase?.received || 0);

    // Auto TDS detection (10% TDS)
    if (finalInvAmt > 0 && finalRecAmt > 0 && finalRecAmt < finalInvAmt && (!exCase?.tds_deducted || Number(exCase.tds_deducted) === 0)) {
      const diff = Math.round((finalInvAmt - finalRecAmt) * 100) / 100;
      const base10 = Math.round((finalInvAmt / 1.18) * 0.10);
      const gross10 = Math.round(finalInvAmt * 0.10);
      if (Math.abs(diff - base10) <= 2 || Math.abs(diff - gross10) <= 2) {
        updates.tds_deducted = diff;
      }
    }

    if (Object.keys(updates).length === 0) {
      toast('No valid updates to apply', true);
      return false;
    }

    try {
      const { error } = await supabaseClient.from('cases').update(updates).eq('doc_code', docCode);
      if (error) throw error;
      toast(`Updated case ${docCode}${updates.tds_deducted ? ' (TDS ₹' + updates.tds_deducted + ' auto-filled)' : ''}`);
      trEl.style.backgroundColor = 'var(--green-bg)';
      const btn = trEl.querySelector('button');
      if (btn) {
        btn.textContent = 'Updated ✓';
        btn.className = 'btn btn-gold btn-sm';
        btn.disabled = true;
      }
      await loadCasesFromDB();
      renderAll();
      return true;
    } catch (e) {
      console.error('Match update error', e);
      toast('Failed to update case', true);
      return false;
    }
  };

  window.applyBulkMatchUpdates = async function() {
    const rows = document.querySelectorAll('#match-tbody tr[data-doc-code]');
    if (rows.length === 0) {
      toast('No matches to update.', true);
      return;
    }
    const docCodes = Array.from(rows).map(tr => tr.getAttribute('data-doc-code')).filter(Boolean);
    if (typeof window.recordBatchSnapshot === 'function' && docCodes.length > 0) {
      window.recordBatchSnapshot({
        action: `Form Match: updated ${docCodes.length} matched cases`,
        type: 'update',
        docCodes
      });
    }
    let ok = 0;
    for (const tr of rows) {
      const btn = tr.querySelector('button');
      if (btn && btn.disabled) continue;
      const success = await window.applyMatchUpdate(tr, tr.getAttribute('data-doc-code'));
      if (success) ok++;
    }
    if (ok > 0) toast(`Bulk update complete for ${ok} cases. (Undo available in Rollback Log)`);
    else toast('No new updates to apply.');
  };

  if(typeof window.sendSlipWhatsApp==='function')window.sendSlipWhatsApp=function(){
    const name=document.getElementById('slip-inv')?.value||'',code=document.getElementById('slip-month')?.value||'',mo=MONTHS.find(m=>m.code===code);
    if(!name||!mo){toast('Select an investigator and month first.',true);return}
    const p=phone(INVESTIGATOR_PHONES?.[name]);
    if(!p){toast('No valid WhatsApp number saved for this investigator.',true);return}
    const monthCases=cases.filter(c=>{if(!c.date)return false;const d=new Date(c.date);return d.getMonth()+1===mo.m&&d.getFullYear()===mo.y&&(c.inv1===name||c.inv2===name)});
    const s=computeInvStats(name,monthCases);
    const tax=typeof window.getSlipTaxConfig==='function'?window.getSlipTaxConfig():{rate:0};
    let taxLines='';
    let netLine=`*Net Payable Now: Rs ${fmt(s.pendingAmt)}*`;
    if(tax&&tax.rate>0){
      const taxableBase=tax.base==='fees_only'?(s.pendingFees||s.totalFees):s.pendingAmt;
      const tdsAmt=Math.round((taxableBase*tax.rate)/100);
      const netDisbursable=Math.max(0,s.pendingAmt-tdsAmt);
      taxLines=`\nGross Balance: Rs ${fmt(s.pendingAmt)}\nLess TDS (${tax.label}): -Rs ${fmt(tdsAmt)}`;
      netLine=`*Net Disbursable Now: Rs ${fmt(netDisbursable)}*`;
    }
    const msg=`Hello ${name},\n\nYour payment slip for *${mo.label}* from ${settings?.agencyName||'DNA Payments'}:\n\nTotal Cases: ${s.totalCases}\nTotal Payable: Rs ${fmt(s.totalPayable)}\nAlready Paid: Rs ${fmt(s.paidAmt)}${taxLines}\n${netLine}\n\nThank you.`;
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`,'_blank','noopener');
    const h=document.getElementById('slip-wp-hint');
    if(h){h.textContent=`Opened WhatsApp for ${name}. Attach the PDF manually before sending.`;h.style.color='var(--green)'}
  };
  if(typeof window.openCurrentQueueChat==='function')window.openCurrentQueueChat=function(){const i=slipQueue?.[slipQueueIdx];if(!i)return;const p=phone(INVESTIGATOR_PHONES?.[i.name]);if(!p){toast(`No valid WhatsApp number saved for ${i.name}.`,true);advanceSlipQueue?.();return}const s=computeInvStats(i.name,i.monthCases),msg=`Hello ${i.name},\n\nYour payment slip for *${i.mo.label}* from ${settings?.agencyName||'DNA Payments'}:\n\nTotal Cases: ${s.totalCases}\nTotal Payable: Rs ${fmt(s.totalPayable)}\nAlready Paid: Rs ${fmt(s.paidAmt)}\n*Net Payable Now: Rs ${fmt(s.pendingAmt)}*\n\nThank you.`;window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`,'_blank','noopener');advanceSlipQueue?.()};

  window.checkBackupReminder=function(){};window.checkWeeklyBackupReminder=function(){};
  if(window.supabaseClient&&!window.__dnaReferenceSync){window.__dnaReferenceSync=true;window.supabaseClient.channel('dna-reference-changes').on('postgres_changes',{event:'*',schema:'public',table:'investigators'},async()=>{await loadInvestigatorsFromDB();refreshInvestigatorDropdowns();filterInvestigators();renderAll();ensureInvestigator360()}).on('postgres_changes',{event:'*',schema:'public',table:'agency_settings'},async()=>{await loadSettingsFromDB();applySettingsToForm();renderAll()}).subscribe()}
  if(typeof window.injectStaffEdit==='function'){const original=window.injectStaffEdit;window.injectStaffEdit=function(){if(role()==='senior'||role()==='junior')return original.apply(this,arguments)}}
});
})();
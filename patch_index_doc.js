const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Add Bulk Doc Manager Button
html = html.replace(
  /<button class="btn btn-navy btn-sm" id="bulk-pay-btn" onclick="openBulkPayment\(\)">💰 Bulk Payment<\/button>/,
  `<button class="btn btn-navy btn-sm" id="bulk-pay-btn" onclick="openBulkPayment()">💰 Bulk Payment</button>
          <button class="btn btn-gold btn-sm" onclick="openBulkDocManager()">📦 Bulk Docs & Dispatch</button>`
);

// 2. Add Company Hard Copy fields to case modal
html = html.replace(
  /<div class="fg">\s*<label>INV2 Hard Copy.*?<\/select>\s*<\/div>\s*<\/div>/s,
  `$&
        <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px; border-top: 1px dashed var(--line); padding-top: 12px;">
          <div class="fg"><label>Company Dispatch Status</label><select id="f-companyhardcopy"><option value="Pending">Pending</option><option value="Dispatched">Dispatched</option><option value="Delivered">Delivered</option></select></div>
          <div class="fg"><label>Dispatch AWB / Tracking No</label><input type="text" id="f-companyawb" placeholder="e.g. DTDC-8273645"></div>
        </div>`
);

// 3. Add Bulk Doc Modal
const bulkDocModal = `
<!-- BULK DOC MANAGER MODAL -->
<div class="overlay" id="bulkdoc-modal">
  <div class="modal" style="max-width:900px; width:95%;">
    <div class="modal-head">
      <h3>📦 Bulk Document & Dispatch Manager</h3>
      <button class="modal-x" onclick="closeModal('bulkdoc-modal')">✕</button>
    </div>
    <div class="modal-body" style="padding:0; display:flex; flex-direction:column; max-height:80vh;">
      
      <div style="display:flex; border-bottom:1px solid var(--line); background:var(--bg);">
        <button class="tab active" style="flex:1; text-align:center; font-size:13px;" id="doc-tab-receive" onclick="switchDocTab('receive')">📥 Receive from Investigator</button>
        <button class="tab" style="flex:1; text-align:center; font-size:13px;" id="doc-tab-dispatch" onclick="switchDocTab('dispatch')">📤 Dispatch to Company</button>
      </div>

      <!-- RECEIVE TAB -->
      <div id="doc-view-receive" style="padding:20px; overflow-y:auto; flex:1;">
        <div class="fg" style="margin-bottom:16px;">
          <label>Select Investigator</label>
          <select id="bulkdoc-receive-inv" onchange="renderBulkDocReceive()">
            <option value="">-- Choose Investigator --</option>
          </select>
        </div>
        <div class="notice" style="margin-bottom:12px;">Showing cases where Hard Copy is currently <b>Not Received</b>.</div>
        <table class="data-table" id="bulkdoc-receive-table" style="width:100%;">
          <thead>
            <tr>
              <th style="width:40px;"><input type="checkbox" onchange="toggleAllDocCheckboxes(this, 'receive')"></th>
              <th>Doc Code</th>
              <th>Date</th>
              <th>Claim No</th>
              <th>Insured</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <!-- DISPATCH TAB -->
      <div id="doc-view-dispatch" style="display:none; padding:20px; overflow-y:auto; flex:1;">
        <div style="display:flex; gap:16px; margin-bottom:16px;">
          <div class="fg" style="flex:1;">
            <label>Select Company</label>
            <select id="bulkdoc-dispatch-co" onchange="renderBulkDocDispatch()">
              <option value="">-- Choose Company --</option>
            </select>
          </div>
          <div class="fg" style="flex:1;">
            <label>Apply Tracking AWB No. (Optional)</label>
            <input type="text" id="bulkdoc-dispatch-awb" placeholder="e.g. DTDC-123456" style="border-color:var(--gold);">
          </div>
        </div>
        <div class="notice" style="margin-bottom:12px;">Showing cases where Dispatch is currently <b>Pending</b>. Check the boxes to mark them as Dispatched.</div>
        <table class="data-table" id="bulkdoc-dispatch-table" style="width:100%;">
          <thead>
            <tr>
              <th style="width:40px;"><input type="checkbox" onchange="toggleAllDocCheckboxes(this, 'dispatch')"></th>
              <th>Doc Code</th>
              <th>Date</th>
              <th>Claim No</th>
              <th>Insured</th>
              <th>Investigator</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal('bulkdoc-modal')">Cancel</button>
      <button class="btn btn-gold" id="bulkdoc-process-btn" onclick="processBulkDocs()">Apply Changes</button>
    </div>
  </div>
</div>
`;

html = html.replace(/<!-- EXCEPTION MODAL -->/, bulkDocModal + '\n<!-- EXCEPTION MODAL -->');

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Patched index.html for Bulk Docs');

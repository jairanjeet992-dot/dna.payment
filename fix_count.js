const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// Fix bulkpay footer
html = html.replace(
  '<div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal(\'bulkpay-modal\')">Cancel</button><button class="btn btn-navy" onclick="saveBulkPayment()">Save All Payments</button></div>',
  `<div class="modal-foot" style="justify-content: space-between; align-items: center;">
      <div style="font-size: 12.5px; font-weight: 600; color: var(--gold); display: flex; align-items: center; gap: 6px;">
        <span style="display:inline-block; width:8px; height:8px; background:var(--gold); border-radius:50%;"></span>
        <span id="bulkpay-count-text">0 Cases Selected</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-ghost" onclick="closeModal('bulkpay-modal')">Cancel</button>
        <button class="btn btn-navy" onclick="saveBulkPayment()">Save All Payments</button>
      </div>
    </div>`
);

// Fix bulkedit footer
html = html.replace(
  '<div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal(\'bulkedit-modal\')">Cancel</button><button class="btn btn-navy" onclick="applyBulkEdit()">Apply to All Selected</button></div>',
  `<div class="modal-foot" style="justify-content: space-between; align-items: center;">
      <div style="font-size: 12.5px; font-weight: 600; color: var(--gold); display: flex; align-items: center; gap: 6px;">
        <span style="display:inline-block; width:8px; height:8px; background:var(--gold); border-radius:50%;"></span>
        <span id="bulkedit-count-text">0 Cases Selected</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-ghost" onclick="closeModal('bulkedit-modal')">Cancel</button>
        <button class="btn btn-navy" onclick="applyBulkEdit()">Apply to All Selected</button>
      </div>
    </div>`
);

fs.writeFileSync('public/index.html', html);
console.log("HTML footers patched.");

let appJs = fs.readFileSync('public/app.js', 'utf8');

// Update logic for Bulk Payment
appJs = appJs.replace(
  "function renderBulkPaymentList() {",
  "function updateBulkPayCount() {\n  const rowEls = document.querySelectorAll('#bp-list tr[data-doccode]');\n  let count = 0;\n  rowEls.forEach(tr => {\n    if (tr.dataset.salary === 'true' || tr.querySelector('.bp-paid').checked || parseFloat(tr.querySelector('.bp-fee').value) > 0 || parseFloat(tr.querySelector('.bp-ta').value) > 0) count++;\n  });\n  const el = document.getElementById('bulkpay-count-text');\n  if (el) el.textContent = `${count} of ${rowEls.length} Cases Pending Update`;\n}\n\nfunction renderBulkPaymentList() {"
);

// Call updateBulkPayCount when list is rendered
appJs = appJs.replace(
  "document.getElementById('bp-list').innerHTML = html;\n}",
  "document.getElementById('bp-list').innerHTML = html;\n  updateBulkPayCount();\n}"
);
appJs = appJs.replace(
  "listEl.innerHTML = '<div class=\"empty-state\">No matching cases for this investigator.</div>';",
  "listEl.innerHTML = '<div class=\"empty-state\">No matching cases for this investigator.</div>';\n    updateBulkPayCount();"
);

// Attach event listener dynamically since innerHTML creates the inputs
appJs = appJs.replace(
  "document.getElementById('bp-list').innerHTML = html;\n  updateBulkPayCount();\n}",
  `document.getElementById('bp-list').innerHTML = html;
  document.querySelectorAll('#bp-list input').forEach(inp => inp.addEventListener('input', updateBulkPayCount));
  document.querySelectorAll('#bp-list input[type="checkbox"]').forEach(inp => inp.addEventListener('change', updateBulkPayCount));
  updateBulkPayCount();
}`
);


// Also update Bulk Edit logic
appJs = appJs.replace(
  "document.getElementById('bulkedit-modal').classList.add('open');",
  "document.getElementById('bulkedit-count-text').textContent = `${selectedDocCodes.size} Cases Selected`;\n  document.getElementById('bulkedit-modal').classList.add('open');"
);

fs.writeFileSync('public/app.js', appJs);
console.log("JS patched.");

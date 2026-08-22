const fs = require('fs');
let appJs = fs.readFileSync('public/app.js', 'utf8');

// 1. Add updateBulkDocSelectionCount function before switchDocTab
appJs = appJs.replace(
  "function switchDocTab(tab) {",
  "function updateBulkDocSelectionCount() {\n  const tableId = currentDocTab === 'receive' ? 'bulkdoc-receive-table' : 'bulkdoc-dispatch-table';\n  const checkboxes = document.querySelectorAll(`#${tableId} tbody input[type=\"checkbox\"]:checked`);\n  const countEl = document.getElementById('bulkdoc-count-text');\n  if (countEl) countEl.textContent = `${checkboxes.length} Cases Selected`;\n}\n\nfunction switchDocTab(tab) {"
);

// 2. Call it in switchDocTab
appJs = appJs.replace(
  "document.getElementById('doc-view-dispatch').style.display = (tab === 'dispatch') ? 'block' : 'none';\n}",
  "document.getElementById('doc-view-dispatch').style.display = (tab === 'dispatch') ? 'block' : 'none';\n  updateBulkDocSelectionCount();\n}"
);

// 3. Call it in toggleAllDocCheckboxes
appJs = appJs.replace(
  "checkboxes.forEach(cb => cb.checked = sourceEl.checked);\n}",
  "checkboxes.forEach(cb => cb.checked = sourceEl.checked);\n  updateBulkDocSelectionCount();\n}"
);

// 4. Call it in autoSelectDocs (at the end)
appJs = appJs.replace(
  "showToast(`${matchCount} of ${rows.length} cases matched and selected!`);\n}",
  "showToast(`${matchCount} of ${rows.length} cases matched and selected!`);\n  updateBulkDocSelectionCount();\n}"
);

// 5. Add onchange and call it in renderBulkDocReceive
appJs = appJs.replace(
  /<td><input type="checkbox" checked><\/td>/g,
  '<td><input type="checkbox" checked onchange="updateBulkDocSelectionCount()"></td>'
);

appJs = appJs.replace(
  /return;\n  }\n  \n  tbody\.innerHTML = pendingCases\.map\(c => {/g,
  "updateBulkDocSelectionCount(); return;\n  }\n  \n  tbody.innerHTML = pendingCases.map(c => {"
);

appJs = appJs.replace(
  "}).join('');\n}\n\nfunction renderBulkDocDispatch() {",
  "}).join('');\n  updateBulkDocSelectionCount();\n}\n\nfunction renderBulkDocDispatch() {"
);

// 6. Call it in renderBulkDocDispatch (already added onchange since we used /g)
appJs = appJs.replace(
  "}).join('');\n}\n\nasync function processBulkDocs() {",
  "}).join('');\n  updateBulkDocSelectionCount();\n}\n\nasync function processBulkDocs() {"
);

fs.writeFileSync('public/app.js', appJs);
console.log("Patched app.js");

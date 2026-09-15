const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Fix 1: Case Sensitivity in renderBulkDocDispatch
code = code.replace(
  "return (c.company_hardcopy_status !== 'Dispatched' && c.company_hardcopy_status !== 'Delivered');",
  "const s = (c.company_hardcopy_status || '').toLowerCase();\n    return (s !== 'dispatched' && s !== 'delivered');"
);

// Fix 4: Auto-Select Wipeout - Re-trigger autoSelect on dropdown change
// At the end of renderBulkDocReceive
code = code.replace(
  "updateBulkDocSelectionCount();\n}",
  "updateBulkDocSelectionCount();\n  if (document.getElementById('bulkdoc-receive-paste').value.trim()) autoSelectDocs('receive');\n}"
);
// At the end of renderBulkDocDispatch (note there's two updateBulkDocSelectionCount lines in each, one in early return, one at end)
// Better approach: regex replace the very end of the functions.

const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const oldProcessBulkDocs = `  if (typeof recordBatchSnapshot === 'function' && updates.length) {
    recordBatchSnapshot({
      action: currentDocTab === 'receive' ? \`Hardcopy Inward: received docs for \${updates.length} cases\` : \`Hardcopy Dispatch: dispatched \${updates.length} cases\`,
      type: 'update',
      docCodes: updates.map(u => u.docCode)
    });
  }
  
  // Apply optimistic updates locally immediately for instantaneous UI feedback
  const targetList = window.cases || cases || [];
  updates.forEach(u => {
    const found = targetList.find(c => c && c.doc_code === u.docCode);
    if (found) {
      Object.assign(found, u.toUpdate);
    }
  });
  window.cases = targetList;
  cases = targetList;
  renderAll();

  // Process in parallel chunks to save to database
  try {
    let successCount = 0;
    let failedCount = 0;
    const chunkSize = 10;
    
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      const promises = chunk.map(u => 
        safeUpdateCaseInDB(u.docCode, u.toUpdate)
          .then(() => { successCount++; })
          .catch(err => {
            console.error('Failed to update DB for', u.docCode, err);
            failedCount++;
          })
      );
      await Promise.all(promises);
    }
    
    if (successCount > 0) {
      showToast(\`✓ Successfully updated & saved \${successCount} cases to database!\`);
    }
    if (failedCount > 0) {
      showToast(\`⚠️ \${failedCount} cases failed to update on database\`, true);
    }
    
    // Refresh authoritative data from DB and re-render
    await loadCasesFromDB();
    renderAll();
    closeModal('bulkdoc-modal');
  } catch (err) {
    console.error('Bulk Doc Error', err);
    showToast('An error occurred during update: ' + err.message, true);
  }`;

const newProcessBulkDocs = `  try {
    if (typeof executeAtomicBatchUpdate === 'function') {
      const formattedUpdates = updates.map(u => ({
        doc_code: u.docCode,
        fields: u.toUpdate
      }));
      const actionTitle = currentDocTab === 'receive' ? \`Hardcopy Inward: received docs for \${updates.length} cases\` : \`Hardcopy Dispatch: dispatched \${updates.length} cases\`;
      
      const res = await executeAtomicBatchUpdate(formattedUpdates, {
        actionTitle: actionTitle
      });
      
      if (res.success) {
        showToast(\`✓ Successfully updated & saved \${res.count} cases to database!\`);
      } else {
        showToast(\`⚠️ Some updates may have failed. Please refresh and check.\`, true);
      }
      
      if (typeof loadCasesFromDB === 'function') await loadCasesFromDB();
      if (typeof renderAll === 'function') renderAll();
      closeModal('bulkdoc-modal');
    } else {
      // Fallback if atomic engine missing
      if (typeof recordBatchSnapshot === 'function' && updates.length) {
        recordBatchSnapshot({
          action: currentDocTab === 'receive' ? \`Hardcopy Inward: received docs for \${updates.length} cases\` : \`Hardcopy Dispatch: dispatched \${updates.length} cases\`,
          type: 'update',
          docCodes: updates.map(u => u.docCode)
        });
      }
      for (const u of updates) {
         await safeUpdateCaseInDB(u.docCode, u.toUpdate);
      }
      if (typeof loadCasesFromDB === 'function') await loadCasesFromDB();
      if (typeof renderAll === 'function') renderAll();
      closeModal('bulkdoc-modal');
      showToast(\`✓ Successfully updated cases\`);
    }
  } catch (err) {
    console.error('Bulk Doc Error', err);
    showToast('An error occurred during update: ' + err.message, true);
  }`;

if (code.includes(oldProcessBulkDocs)) {
  code = code.replace(oldProcessBulkDocs, newProcessBulkDocs);
  fs.writeFileSync('app.js', code);
  console.log('Successfully patched processBulkDocs');
} else {
  console.log('Failed to find old code in processBulkDocs');
}

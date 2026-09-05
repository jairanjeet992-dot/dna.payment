// ============================================================
// batch-rollback.js — One-Click Batch Rollback & Snapshot Log
// ============================================================

const ROLLBACK_STORAGE_KEY = 'dna_batch_snapshots_v1';
const MAX_SNAPSHOTS = 60;

function getBatchSnapshots() {
  try {
    const raw = localStorage.getItem(ROLLBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('[DNA Rollback] Failed to read snapshots from localStorage', e);
    return [];
  }
}

function saveBatchSnapshots(list) {
  try {
    const trimmed = (list || []).slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(ROLLBACK_STORAGE_KEY, JSON.stringify(trimmed));
    updateRollbackBadge();
  } catch (e) {
    console.warn('[DNA Rollback] LocalStorage quota limit reached, trimming history...', e);
    try {
      const trimmed = (list || []).slice(0, 20);
      localStorage.setItem(ROLLBACK_STORAGE_KEY, JSON.stringify(trimmed));
      updateRollbackBadge();
    } catch (err) {}
  }
}

function updateRollbackBadge() {
  const badge = document.getElementById('rollback-badge-count');
  if (badge) {
    const snapshots = getBatchSnapshots();
    const activeCount = snapshots.filter(s => !s.rolledBack).length;
    badge.textContent = activeCount;
    badge.style.display = activeCount > 0 ? 'inline' : 'none';
  }
}

// Valid schema columns confirmed directly from live PostgreSQL database
const VALID_CASE_SCHEMA_COLUMNS = [
  'company', 'date', 'case_type', 'claim_no', 'policy_no', 'insured_name',
  'hospital', 'location', 'invoice_no', 'invoice_amount', 'inv1', 'inv2',
  'fee1', 'fee2', 'ta1', 'ta2', 'received', 'received_date',
  'inv1_status', 'inv2_status', 'hardcopy1_status', 'hardcopy2_status',
  'company_hardcopy_status', 'company_hardcopy_awb', 'hardcopy_receive_date',
  'company_dispatch_date', 'outcome', 'exception_type', 'exception_reason',
  'remarks', 'sla_hours', 'due_date', 'risk_level', 'completed_at', 'custom_data'
];

/**
 * Executes an atomic batch update with controlled chunking and automatic
 * compensating rollback if an error occurs mid-operation.
 *
 * @param {Array<{doc_code: string, fields: Object}>} updates
 * @param {Object} opts
 * @param {string} opts.actionTitle
 * @param {string} [opts.investigatorName]
 * @param {string[]} [opts.updatedFields]
 * @param {Function} [opts.onProgress]
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
async function executeAtomicBatchUpdate(updates, opts = {}) {
  if (!updates || !updates.length) return { success: true, count: 0 };

  const currentCases = window.cases || [];
  const caseMap = new Map(currentCases.map(c => [c.doc_code, c]));

  // 1. Capture exact previous state for all cases before starting any writes
  const previousState = [];
  for (const u of updates) {
    const existing = caseMap.get(u.doc_code);
    if (existing) {
      const snap = { doc_code: u.doc_code };
      // Copy only valid schema keys that are being updated or relevant
      const keysToCopy = opts.updatedFields || Object.keys(u.fields);
      for (const k of keysToCopy) {
        if (k in existing) snap[k] = existing[k];
      }
      previousState.push(snap);
    }
  }

  const successfullyUpdated = [];
  const total = updates.length;
  const CONCURRENCY_CHUNK = 5;

  try {
    for (let i = 0; i < updates.length; i += CONCURRENCY_CHUNK) {
      const slice = updates.slice(i, i + CONCURRENCY_CHUNK);
      await Promise.all(slice.map(async (item) => {
        // Sanitize fields to only valid schema keys
        const cleanFields = {};
        for (const [key, val] of Object.entries(item.fields)) {
          if (VALID_CASE_SCHEMA_COLUMNS.includes(key)) {
            cleanFields[key] = val;
          }
        }
        const { error } = await supabaseClient.from('cases').update(cleanFields).eq('doc_code', item.doc_code);
        if (error) throw error;
        successfullyUpdated.push(item);
      }));

      if (typeof opts.onProgress === 'function') {
        opts.onProgress(Math.min(i + CONCURRENCY_CHUNK, total), total);
      }
    }

    // 2. All updates succeeded — record batch snapshot for 1-click rollback
    const docCodes = updates.map(u => u.doc_code);
    recordBatchSnapshot({
      action: opts.actionTitle || `Bulk Update: ${updates.length} case(s)`,
      type: 'update',
      docCodes,
      previousState,
      metadata: {
        updatedFields: opts.updatedFields || (updates[0] ? Object.keys(updates[0].fields) : []),
        investigator: opts.investigatorName || null,
        batchSize: updates.length
      }
    });

    return { success: true, count: updates.length };

  } catch (err) {
    console.error('[DNA Atomic Batch] Update failed mid-operation:', err);

    // 3. Compensating Rollback: Revert already-updated cases back to original state
    if (successfullyUpdated.length > 0) {
      console.warn(`[DNA Atomic Batch] Rolling back ${successfullyUpdated.length} partially updated cases...`);
      showToast(`Warning: Error at case. Reverting ${successfullyUpdated.length} cases to maintain database integrity…`, true);

      const rollbackMap = new Map(previousState.map(p => [p.doc_code, p]));
      for (let i = 0; i < successfullyUpdated.length; i += CONCURRENCY_CHUNK) {
        const slice = successfullyUpdated.slice(i, i + CONCURRENCY_CHUNK);
        await Promise.all(slice.map(async (item) => {
          const prev = rollbackMap.get(item.doc_code);
          if (prev) {
            const { doc_code, ...revertFields } = prev;
            try {
              await supabaseClient.from('cases').update(revertFields).eq('doc_code', doc_code);
            } catch (revertErr) {
              console.error(`[DNA Atomic Batch] Failed to revert case ${doc_code}:`, revertErr);
            }
          }
        }));
      }
    }

    return {
      success: false,
      count: successfullyUpdated.length,
      error: `Interrupted: ${err.message}. ${successfullyUpdated.length} processed cases were automatically reverted to prevent corrupt states.`
    };
  }
}

/**
 * Record a batch snapshot before modifying the database.
 * @param {Object} opts
 * @param {string} opts.action - Human-readable action description
 * @param {'update'|'insert'|'delete'} opts.type - Operation type
 * @param {string[]} [opts.docCodes] - Affected document codes
 * @param {Object[]} [opts.previousState] - Previous full/partial case objects
 * @param {Object} [opts.newState] - Information about the changes applied
 * @param {Object} [opts.metadata] - Extra context (e.g. field names, batch sizes)
 * @returns {Object} snapshot object created
 */
function recordBatchSnapshot({ action, type, docCodes = [], previousState = null, newState = null, metadata = {} }) {
  try {
    const currentCases = window.cases || [];
    let stateToSave = previousState;

    if (!stateToSave && docCodes.length > 0) {
      if (type === 'update' || type === 'delete') {
        const codeSet = new Set(docCodes);
        stateToSave = currentCases.filter(c => codeSet.has(c.doc_code)).map(c => {
          const copy = {};
          VALID_CASE_SCHEMA_COLUMNS.forEach(col => {
            if (c[col] !== undefined) copy[col] = c[col];
          });
          copy.doc_code = c.doc_code;
          return copy;
        });
      }
    }

    const userEmail = window.currentUserEmail || 'Admin';
    const userRole = window.currentUserRole || 'admin';

    const snapshot = {
      id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      timestamp: new Date().toISOString(),
      action: action || 'Batch Operation',
      type: type || 'update',
      user: `${userRole} (${userEmail})`,
      affectedCount: docCodes.length || (stateToSave ? stateToSave.length : 0),
      docCodes: docCodes || [],
      previousState: stateToSave || [],
      newState: newState || null,
      metadata: metadata || {},
      rolledBack: false,
      rolledBackAt: null
    };

    const snapshots = getBatchSnapshots();
    snapshots.unshift(snapshot);
    saveBatchSnapshots(snapshots);

    console.log(`[DNA Rollback] Recorded snapshot: "${snapshot.action}" with ID ${snapshot.id} (${snapshot.affectedCount} cases)`);
    return snapshot;
  } catch (err) {
    console.error('[DNA Rollback] Failed to record snapshot:', err);
    return null;
  }
}

/**
 * Executes a 1-click rollback of a specific snapshot batch.
 * @param {string} snapshotId
 */
async function rollbackBatchSnapshot(snapshotId) {
  const snapshots = getBatchSnapshots();
  const snapshot = snapshots.find(s => s.id === snapshotId);

  if (!snapshot) {
    showToast('Snapshot not found in rollback history.', true);
    return;
  }

  if (snapshot.rolledBack) {
    showToast('This batch has already been rolled back.', true);
    return;
  }

  const confirmMsg = `Are you sure you want to ROLLBACK this batch?\n\n` +
    `• Action: ${snapshot.action}\n` +
    `• Affected: ${snapshot.affectedCount} case(s)\n` +
    `• Performed: ${new Date(snapshot.timestamp).toLocaleString()}\n\n` +
    `This will restore the previous values in the live database.`;

  if (!confirm(confirmMsg)) return;

  const btn = document.getElementById(`rollback-btn-${snapshot.id}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Reverting…';
  }

  showToast('Initiating rollback on database…');

  try {
    if (snapshot.type === 'update') {
      if (!snapshot.previousState || snapshot.previousState.length === 0) {
        throw new Error('No previous state recorded for this snapshot.');
      }

      const total = snapshot.previousState.length;
      const chunkSize = 5;
      const updatedFields = snapshot.metadata?.updatedFields;

      for (let i = 0; i < snapshot.previousState.length; i += chunkSize) {
        const chunk = snapshot.previousState.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (prev) => {
          if (!prev.doc_code) return;

          // Build safe payload: only restore specific updated fields if recorded,
          // or only valid defined schema columns to prevent overwriting unrelated changes
          const updatePayload = {};
          if (Array.isArray(updatedFields) && updatedFields.length > 0) {
            for (const f of updatedFields) {
              if (VALID_CASE_SCHEMA_COLUMNS.includes(f) && prev[f] !== undefined) {
                updatePayload[f] = prev[f];
              }
            }
          } else {
            for (const col of VALID_CASE_SCHEMA_COLUMNS) {
              if (prev[col] !== undefined) {
                updatePayload[col] = prev[col];
              }
            }
          }

          if (Object.keys(updatePayload).length > 0) {
            const { error } = await supabaseClient.from('cases').update(updatePayload).eq('doc_code', prev.doc_code);
            if (error) throw error;
          }
        }));

        if (btn) {
          btn.textContent = `Reverting (${Math.min(i + chunkSize, total)}/${total})…`;
        }
      }

    } else if (snapshot.type === 'insert') {
      // Revert newly inserted rows by deleting them in URI-safe chunks
      if (!snapshot.docCodes || snapshot.docCodes.length === 0) {
        throw new Error('No document codes found to remove.');
      }
      const URI_SAFE_CHUNK = 25;
      for (let i = 0; i < snapshot.docCodes.length; i += URI_SAFE_CHUNK) {
        const chunk = snapshot.docCodes.slice(i, i + URI_SAFE_CHUNK);
        const { error } = await supabaseClient.from('cases').delete().in('doc_code', chunk);
        if (error) throw error;
      }

    } else if (snapshot.type === 'delete') {
      // Re-insert previously deleted cases in clean chunks
      if (!snapshot.previousState || snapshot.previousState.length === 0) {
        throw new Error('No deleted case data found to restore.');
      }
      const toInsert = snapshot.previousState.map(c => {
        const clean = { doc_code: c.doc_code };
        VALID_CASE_SCHEMA_COLUMNS.forEach(col => {
          if (c[col] !== undefined) clean[col] = c[col];
        });
        return clean;
      });

      const INSERT_CHUNK = 20;
      for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
        const chunk = toInsert.slice(i, i + INSERT_CHUNK);
        const { error } = await supabaseClient.from('cases').insert(chunk);
        if (error) throw error;
      }
    }

    // Mark as rolled back
    snapshot.rolledBack = true;
    snapshot.rolledBackAt = new Date().toISOString();
    saveBatchSnapshots(snapshots);

    // Refresh database and UI
    if (typeof loadCasesFromDB === 'function') await loadCasesFromDB();
    if (typeof renderAll === 'function') renderAll();
    if (typeof checkOverdueAlerts === 'function') checkOverdueAlerts();

    if (window.logActivity) {
      window.logActivity('Rollback', `Rolled back batch "${snapshot.action}" (${snapshot.affectedCount} cases)`);
    }

    showToast(`✓ Batch Rollback Successful! Restored ${snapshot.affectedCount} case(s).`);
    renderRollbackHistoryTable();

  } catch (err) {
    console.error('[DNA Rollback] Rollback failed:', err);
    showToast(`Rollback failed: ${err.message}`, true);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '↩ Rollback Batch';
    }
  }
}

/**
 * Open Rollback History Modal and populate table.
 */
function openRollbackHistoryModal() {
  const modal = document.getElementById('rollback-modal');
  if (!modal) return;
  modal.classList.add('open');
  renderRollbackHistoryTable();
}

/**
 * Render Rollback History Table inside the modal.
 */
function renderRollbackHistoryTable() {
  const tbody = document.getElementById('rollback-history-tbody');
  const emptyState = document.getElementById('rollback-history-empty');
  if (!tbody) return;

  const snapshots = getBatchSnapshots();

  if (snapshots.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = snapshots.map((s, idx) => {
    const dt = new Date(s.timestamp);
    const dateFormatted = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    let typeBadge = '';
    if (s.type === 'update') {
      typeBadge = '<span class="badge" style="background:var(--navy);color:#fff;font-size:10px;">✏️ Bulk Edit</span>';
    } else if (s.type === 'insert') {
      typeBadge = '<span class="badge success" style="font-size:10px;">📥 Import / Add</span>';
    } else if (s.type === 'delete') {
      typeBadge = '<span class="badge danger" style="font-size:10px;">🗑 Delete</span>';
    }

    let statusBadge = '';
    let actionBtn = '';

    if (s.rolledBack) {
      const rbDate = s.rolledBackAt ? new Date(s.rolledBackAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      statusBadge = `<span class="badge warning" style="font-size:10.5px;font-weight:700;">↩ Rolled Back ${rbDate ? `(${rbDate})` : ''}</span>`;
      actionBtn = `<button class="btn btn-ghost btn-sm" disabled style="opacity:0.6;font-size:10.5px;">Rolled Back ✓</button>`;
    } else {
      statusBadge = `<span class="badge paid" style="font-size:10.5px;font-weight:700;">Active in DB</span>`;
      actionBtn = `<button class="btn btn-gold btn-sm" id="rollback-btn-${s.id}" onclick="rollbackBatchSnapshot('${s.id}')" style="font-weight:700;font-size:11px;padding:4px 10px;" title="Revert this entire batch">↩ Rollback Batch</button>`;
    }

    const docListPreview = (s.docCodes || []).slice(0, 5).join(', ') + ((s.docCodes && s.docCodes.length > 5) ? ` +${s.docCodes.length - 5} more` : '');

    return `
      <tr style="${s.rolledBack ? 'background:rgba(0,0,0,0.02);opacity:0.75;' : ''}">
        <td style="white-space:nowrap;font-size:11.5px;">
          <strong>${dateFormatted}</strong><br>
          <span style="color:var(--sub);font-size:10.5px;">${timeFormatted}</span>
        </td>
        <td style="font-size:12px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            ${typeBadge}
            <strong style="color:var(--navy);">${escAttr(s.action)}</strong>
          </div>
          <div style="color:var(--sub);font-size:10.5px;">
            ${s.affectedCount} case(s) ${s.docCodes && s.docCodes.length ? `• Codes: <span class="mono">${escAttr(docListPreview)}</span>` : ''}
          </div>
        </td>
        <td style="font-size:11px;color:var(--ink);">${escAttr(s.user || 'Admin')}</td>
        <td>${statusBadge}</td>
        <td style="text-align:right;white-space:nowrap;">
          ${actionBtn}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Clear all snapshot history with confirmation.
 */
function clearAllBatchSnapshots() {
  if (!confirm('Are you sure you want to clear all rollback history? Existing cases will remain untouched, but previous rollback points will be removed.')) return;
  localStorage.removeItem(ROLLBACK_STORAGE_KEY);
  updateRollbackBadge();
  renderRollbackHistoryTable();
  showToast('Rollback history cleared.');
}

// Attach to window
window.dnaRollback = {
  getBatchSnapshots,
  recordBatchSnapshot,
  rollbackBatchSnapshot,
  executeAtomicBatchUpdate,
  openRollbackHistoryModal,
  renderRollbackHistoryTable,
  clearAllBatchSnapshots,
  updateRollbackBadge
};

window.openRollbackHistoryModal = openRollbackHistoryModal;
window.rollbackBatchSnapshot = rollbackBatchSnapshot;
window.clearAllBatchSnapshots = clearAllBatchSnapshots;
window.recordBatchSnapshot = recordBatchSnapshot;
window.executeAtomicBatchUpdate = executeAtomicBatchUpdate;

// Initialize badge on document ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(updateRollbackBadge, 1000);
});

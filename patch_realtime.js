const fs = require('fs');

// Patch app.js
let appJs = fs.readFileSync('app.js', 'utf8');

const exposeFunctions = `
window.renderAll = renderAll;
window.handleRealtimePayload = (payload) => {
  if (typeof cases === 'undefined') return;
  const processRow = (row) => ({
    ...row, 
    total_payable: Number(row.total_payable || 0), 
    profit: Number(row.profit || 0),
    fee1: Number(row.fee1 || 0), 
    fee2: Number(row.fee2 || 0), 
    ta1: Number(row.ta1 || 0), 
    ta2: Number(row.ta2 || 0), 
    received: Number(row.received || 0)
  });

  if (payload.eventType === 'INSERT') {
    const exists = cases.some(c => c.id === payload.new.id);
    if (!exists) cases.unshift(processRow(payload.new));
  } else if (payload.eventType === 'UPDATE') {
    const idx = cases.findIndex(c => c.id === payload.new.id);
    if (idx !== -1) cases[idx] = processRow(payload.new);
  } else if (payload.eventType === 'DELETE') {
    const idx = cases.findIndex(c => c.id === payload.old.id);
    if (idx !== -1) cases.splice(idx, 1);
  }
  window.cases = cases;
  renderAll();
};
`;

if (!appJs.includes('window.handleRealtimePayload =')) {
  appJs = appJs + '\n' + exposeFunctions;
  fs.writeFileSync('app.js', appJs);
  console.log('Patched app.js with handleRealtimePayload.');
}

// Patch realtime-sync.js
let rtJs = fs.readFileSync('realtime-sync.js', 'utf8');
const oldSyncLogic = `if (!window.cases) return;
        const processRow = (row) => ({
          ...row, 
          total_payable: Number(row.total_payable || 0), 
          profit: Number(row.profit || 0),
          fee1: Number(row.fee1 || 0), 
          fee2: Number(row.fee2 || 0), 
          ta1: Number(row.ta1 || 0), 
          ta2: Number(row.ta2 || 0), 
          received: Number(row.received || 0)
        });

        if (payload.eventType === 'INSERT') {
          const exists = window.cases.some(c => c.id === payload.new.id);
          if (!exists) {
            window.cases.unshift(processRow(payload.new));
          }
        } 
        else if (payload.eventType === 'UPDATE') {
          const idx = window.cases.findIndex(c => c.id === payload.new.id);
          if (idx !== -1) {
            window.cases[idx] = processRow(payload.new);
          }
        } 
        else if (payload.eventType === 'DELETE') {
          window.cases = window.cases.filter(c => c.id !== payload.old.id);
        }
        
        // Re-render UI efficiently
        if (typeof window.renderAll === 'function') {
          window.renderAll();
        }`;

const newSyncLogic = `if (typeof window.handleRealtimePayload === 'function') {
          window.handleRealtimePayload(payload);
        }`;

if (rtJs.includes('if (!window.cases) return;')) {
  rtJs = rtJs.replace(oldSyncLogic, newSyncLogic);
  fs.writeFileSync('realtime-sync.js', rtJs);
  console.log('Patched realtime-sync.js to use window.handleRealtimePayload.');
} else {
  console.log('Failed to find old sync logic in realtime-sync.js');
}

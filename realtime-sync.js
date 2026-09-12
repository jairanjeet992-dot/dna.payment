// realtime-sync.js
// Handles Supabase Realtime functionality for live multi-user sync

if (window.supabaseClient) {
  console.log('[REALTIME] Connecting to Supabase Realtime...');
  
  const casesChannel = window.supabaseClient.channel('public:cases')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cases' },
      (payload) => {
        console.log('[REALTIME] Payload received!', payload);
        
        const targetCases = window.cases || (typeof cases !== 'undefined' ? cases : null);
        if (!targetCases) return;

        const processRow = (row) => {
          if (typeof window.parseCaseRow === 'function') {
            return window.parseCaseRow(row);
          }
          const f1 = Number(row.fee1 || 0);
          const f2 = Number(row.fee2 || 0);
          const t1 = Number(row.ta1 || 0);
          const t2 = Number(row.ta2 || 0);
          const rec = Number(row.received || 0);
          const tds = Number(row.tds_deducted || 0);
          let payable = Number(row.total_payable || 0);
          let profit = Number(row.profit || 0);
          if (typeof window.calculateCasePayableAndProfit === 'function') {
            const calc = window.calculateCasePayableAndProfit(row);
            payable = calc.payable;
            profit = calc.profit;
          } else if (!payable && (f1 + f2 + t1 + t2 > 0)) {
            payable = f1 + f2 + t1 + t2;
            profit = (rec + tds) - payable;
          }
          return {
            ...row,
            fee1: f1, fee2: f2, ta1: t1, ta2: t2, received: rec, tds_deducted: tds,
            total_payable: payable,
            profit: profit
          };
        };

        if (payload.eventType === 'INSERT' && payload.new) {
          const exists = targetCases.some(c => 
            (payload.new.id && String(c.id) === String(payload.new.id)) ||
            (payload.new.doc_code && c.doc_code === payload.new.doc_code)
          );
          if (!exists) {
            targetCases.unshift(processRow(payload.new));
          }
        } 
        else if (payload.eventType === 'UPDATE' && payload.new) {
          const idx = targetCases.findIndex(c => 
            (payload.new.id && String(c.id) === String(payload.new.id)) ||
            (payload.new.doc_code && c.doc_code === payload.new.doc_code)
          );
          if (idx !== -1) {
            targetCases[idx] = { ...targetCases[idx], ...processRow(payload.new) };
          }
        } 
        else if (payload.eventType === 'DELETE' && payload.old) {
          const deleteIdx = targetCases.findIndex(c => 
            (payload.old.id && String(c.id) === String(payload.old.id)) ||
            (payload.old.doc_code && c.doc_code === payload.old.doc_code)
          );
          if (deleteIdx !== -1) {
            targetCases.splice(deleteIdx, 1);
          }
        }
        
        window.cases = targetCases;
        if (typeof cases !== 'undefined') cases = targetCases;
        window.__dnaRealtimeSyncActive = true;
        
        // Debounced UI render: prevents browser freezing on rapid bulk updates
        if (typeof window.__realtimeRenderDebounceTimer !== 'undefined') {
          clearTimeout(window.__realtimeRenderDebounceTimer);
        }
        window.__realtimeRenderDebounceTimer = setTimeout(() => {
          const activeModal = document.querySelector('.modal.open');
          const isTyping = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA');
          if (activeModal || isTyping) {
            window.__pendingRealtimeRender = true;
            return;
          }
          if (typeof window.renderAll === 'function') {
            window.renderAll();
          }
        }, 300);
      }
    )
    .subscribe((status) => {
      console.log('[REALTIME] Subscription status:', status);
    });
}


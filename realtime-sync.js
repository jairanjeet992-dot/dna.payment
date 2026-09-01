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
        
        // Re-render UI immediately
        if (typeof window.renderAll === 'function') {
          window.renderAll();
        }
      }
    )
    .subscribe((status) => {
      console.log('[REALTIME] Subscription status:', status);
    });
}


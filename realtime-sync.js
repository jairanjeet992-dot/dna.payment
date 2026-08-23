// realtime-sync.js
// Handles Supabase Realtime functionality for live multiplayer sync

if (window.supabaseClient) {
  console.log('[REALTIME] Connecting to Supabase Realtime...');
  
  const casesChannel = window.supabaseClient.channel('public:cases')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cases' },
      (payload) => {
        console.log('[REALTIME] Payload received!', payload);
        
        if (!window.cases) return;

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
        }
      }
    )
    .subscribe((status) => {
      console.log('[REALTIME] Subscription status:', status);
    });
}

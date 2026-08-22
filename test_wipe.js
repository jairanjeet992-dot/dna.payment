const { createClient } = require('@supabase/supabase-js');
const url = 'https://aacvwozpfjuhcvihnaen.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3Z3b3pwZmp1aGN2aWhuYWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzc2MjUsImV4cCI6MjEwMjM1MzYyNX0.nPHpd2YeC-VgF-xKCKO7kLzr_5TncD84b8IOzoiKAIk';
const client = createClient(url, key);

async function wipe() {
  console.log("Wiping...");
  let res;
  res = await client.from('activity_log').delete().neq('module', '__never_matches__');
  if(res.error) console.log("Err activity_log", res.error);
  
  res = await client.from('investigator_audit_log').delete().neq('action', '__never_matches__');
  if(res.error) console.log("Err audit_log", res.error);

  res = await client.from('investigator_documents').delete().neq('document_name', '__never_matches__');
  if(res.error) console.log("Err docs", res.error);
  
  res = await client.from('case_ownership_transfers').delete().not('created_at', 'is', null);
  if(res.error) console.log("Err transfers", res.error);
  
  res = await client.from('cases').delete().neq('doc_code', '__never_matches__');
  if(res.error) console.log("Err cases", res.error);
  
  res = await client.from('investigators').delete().neq('name', '__never_matches__');
  if(res.error) console.log("Err inv", res.error);
  
  console.log("Done");
}
wipe();

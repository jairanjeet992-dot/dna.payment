const { createClient } = require('@supabase/supabase-js');
const url = 'https://aacvwozpfjuhcvihnaen.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3Z3b3pwZmp1aGN2aWhuYWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzc2MjUsImV4cCI6MjEwMjM1MzYyNX0.nPHpd2YeC-VgF-xKCKO7kLzr_5TncD84b8IOzoiKAIk';
const client = createClient(url, key);

async function run() {
  const { error } = await client.from('activity_log').delete().neq('module', '__never_matches__');
  console.log("Activity log delete error:", error);

  const { error: cErr } = await client.from('cases').delete().neq('doc_code', '__never_matches__');
  console.log("Cases delete error:", cErr);

  const { error: iErr } = await client.from('investigators').delete().neq('name', '__never_matches__');
  console.log("Investigators delete error:", iErr);
}
run();

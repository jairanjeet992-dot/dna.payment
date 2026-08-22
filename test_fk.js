const { createClient } = require('@supabase/supabase-js');
const url = 'https://aacvwozpfjuhcvihnaen.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3Z3b3pwZmp1aGN2aWhuYWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzc2MjUsImV4cCI6MjEwMjM1MzYyNX0.nPHpd2YeC-VgF-xKCKO7kLzr_5TncD84b8IOzoiKAIk';
const client = createClient(url, key);

async function run() {
  const { error } = await client.from('investigator_documents').delete().neq('document_name', '__never_matches__');
  console.log("Investigator Documents delete error:", error);
}
run();

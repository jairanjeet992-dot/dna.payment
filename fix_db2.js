const { createClient } = require('@supabase/supabase-js');
const url = 'https://aacvwozpfjuhcvihnaen.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3Z3b3pwZmp1aGN2aWhuYWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzc2MjUsImV4cCI6MjEwMjM1MzYyNX0.nPHpd2YeC-VgF-xKCKO7kLzr_5TncD84b8IOzoiKAIk';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: 'ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS details text;'
  });
  console.log(error || 'Success');
}
run();

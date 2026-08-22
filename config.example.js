// ============================================================
// SUPABASE CONFIGURATION (EXAMPLE)
// ============================================================
// IMPORTANT: Copy this file to config.js and fill in your actual
// Supabase project credentials. Never commit config.js to git.
//
// To get these values:
// 1. Go to https://supabase.com and create a new project
// 2. In Project Settings → API, copy the URL and Anon Key
// 3. Paste them here and save as config.js
// ============================================================

window.APP_CONFIG = {
  supabase: {
    url: 'https://aacvwozpfjuhcvihnaen.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3Z3b3pwZmp1aGN2aWhuYWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3Nzc2MjUsImV4cCI6MjEwMjM1MzYyNX0.nPHpd2YeC-VgF-xKCKO7kLzr_5TncD84b8IOzoiKAIk'
  },
  googleDrive: {
    clientId: 1051883487866-db1eelsu3ue0f2ue4b29aqa0qt2ca4qv.apps.googleusercontent.com
  }
};

// Validation: Check that config is complete
(function() {
  const config = window.APP_CONFIG?.supabase;
  if (!config || !config.url || !config.anonKey) {
    console.warn(
      '[APP_CONFIG] Missing Supabase configuration. ' +
      'Please copy config.example.js to config.js and fill in your credentials.'
    );
  }
})();

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
    url: 'https://YOUR_PROJECT_ID.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_KEY'
  },
  googleDrive: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
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

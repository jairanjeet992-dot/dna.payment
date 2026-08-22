module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Promise: "readonly",
        supabaseClient: "readonly",
        Math: "readonly",
        Date: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        alert: "readonly",
        prompt: "readonly",
        confirm: "readonly"
      }
    },
    rules: {
      "no-undef": "error"
    }
  }
];

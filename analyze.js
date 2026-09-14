const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

function checkRegex(pattern, name) {
  const matches = [...appJs.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`\n--- Found potential issues in: ${name} (${matches.length} matches) ---`);
    matches.slice(0, 5).forEach(m => console.log(`Lines around match: \n${appJs.substring(Math.max(0, m.index - 100), Math.min(appJs.length, m.index + 100))}\n`));
  } else {
    console.log(`\n--- No obvious issues found for: ${name} ---`);
  }
}

// 1. Missing await on supabase calls
checkRegex(/supabase\.[^\n]+\.[^\n]+(?!await|\.then)/g, "Unawaited Supabase Calls (Rough Check)");

// 2. parseFloat/parseInt without NaN check
checkRegex(/parseFloat\([^)]+\)(?!\s*\|\|\s*0)/g, "parseFloat without fallback (NaN risk)");

// 3. Catch blocks that swallow errors silently
checkRegex(/catch\s*\(\w+\)\s*{\s*(?:console\.(?:log|error)\([^)]+\);?)?\s*}/g, "Silent Catch Blocks");


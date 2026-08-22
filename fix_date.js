const fs = require('fs');
let appJs = fs.readFileSync('public/app.js', 'utf8');

// Add a function to restrict date inputs to today
const restrictDatesCode = `
// Restrict all date inputs to not allow future dates
function restrictFutureDates() {
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el => {
    el.setAttribute('max', today);
  });
  document.querySelectorAll('input[type="month"]').forEach(el => {
    el.setAttribute('max', today.substring(0, 7));
  });
}
`;

// Insert the code around DOMContentLoaded or at the end of the file
if (!appJs.includes('restrictFutureDates()')) {
  appJs += '\n' + restrictDatesCode + '\n';
  // Call it when the app initializes
  appJs = appJs.replace(
    "async function init() {",
    "async function init() {\n  restrictFutureDates();"
  );
  fs.writeFileSync('public/app.js', appJs);
  console.log("Date fix applied.");
} else {
  console.log("Date fix already present.");
}

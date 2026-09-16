const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const oldFuncStart = "async function refreshBackupStatus() {";
const oldFuncRegex = /async function refreshBackupStatus\(\) \{[\s\S]*?\}\n/m;

const newFunc = `async function refreshBackupStatus() {
  const detailsEl = document.getElementById('auto-backup-details');
  if (!detailsEl) return;
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/backup/status', { headers: authHeaders });
    const data = await res.json();
    if (data.success && data.latest) {
      const dt = new Date(data.latest.timestamp);
      let formattedDate = '', formattedTime = '';
      try {
        formattedDate = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        formattedTime = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        formattedDate = dt.toISOString().slice(0, 10);
        formattedTime = dt.toISOString().slice(11, 19);
      }
      const caseCount = data.latest.stats ? (data.latest.stats.totalCases ?? 0) : 0;
      const sizeKb = (data.latest.size / 1024).toFixed(1);
      detailsEl.innerHTML = \`
        <strong>Latest Snapshot:</strong> \${formattedDate} at \${formattedTime}<br>
        <span style="font-family:var(--mono); color:var(--ink);">\${data.latest.filename}</span> (\${sizeKb} KB • \${caseCount} cases backed up)
      \`;
    } else {
      detailsEl.innerHTML = \`No server snapshots yet. Click <strong>"Take Snapshot Now"</strong> to create the first one.\`;
    }
  } catch (err) {
    // Graceful degrade
    detailsEl.textContent = 'Status check failed: Server unreachable or initializing.';
  }
}
`;

if (code.match(oldFuncRegex)) {
  code = code.replace(oldFuncRegex, newFunc);
  fs.writeFileSync('app.js', code);
  console.log('Fixed refreshBackupStatus');
} else {
  console.log('Regex did not match');
}

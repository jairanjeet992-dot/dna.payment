import re

with open("public/app.js", "r") as f:
    js = f.read()

# Add checkHospitalRisk if it doesn't exist
if "function checkHospitalRisk" not in js:
    code_to_add = """
// ============================================================
// HOSPITAL RISK CALCULATION
// ============================================================
function checkHospitalRisk(hosp) {
  const warningEl = document.getElementById('hospital-risk-warning');
  const pctEl = document.getElementById('hospital-risk-pct');
  if (!warningEl || !pctEl) return;
  if (!hosp || !hosp.trim()) {
    warningEl.style.display = 'none';
    return;
  }
  
  const hName = hosp.trim().toLowerCase();
  const hospCases = cases.filter(c => (c.hospital||'').trim().toLowerCase() === hName);
  if (hospCases.length < 3) {
    warningEl.style.display = 'none';
    return;
  }
  
  const rejected = hospCases.filter(c => c.outcome === 'Rejected' || c.exception_type === 'Rejected').length;
  const fraudRate = Math.round((rejected / hospCases.length) * 100);
  
  if (fraudRate >= 30) {
    pctEl.textContent = fraudRate;
    warningEl.style.display = 'flex';
  } else {
    warningEl.style.display = 'none';
  }
}
"""
    js += "\n" + code_to_add

with open("public/app.js", "w") as f:
    f.write(js)

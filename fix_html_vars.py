import re

with open("public/app.js", "r") as f:
    js = f.read()

# Fix __html in renderMonthlySalaries (around line 2240)
js = js.replace(
    "  const tbody = document.getElementById('monthly-tbody');\n  tbody.innerHTML = '';\n  list.forEach(name => {",
    "  const tbody = document.getElementById('monthly-tbody');\n  let __html = [];\n  list.forEach(name => {"
)

# Also check toggleSelectAll (around line 1395)
#   if (el.checked) {
#    let __html = [];
#    pageRows.forEach(c => selectedDocCodes.add(c.doc_code));
js = js.replace(
    "  if (el.checked) {\n    let __html = [];\npageRows.forEach(c => selectedDocCodes.add(c.doc_code));",
    "  if (el.checked) {\n    pageRows.forEach(c => selectedDocCodes.add(c.doc_code));"
)

with open("public/app.js", "w") as f:
    f.write(js)

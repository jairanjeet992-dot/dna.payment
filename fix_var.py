import re

with open("public/app.js", "r") as f:
    js = f.read()

# Fix the variable declaration. We need `let __yrCoHtml = [];` inside renderYearlyAnalytics
# Currently `let __yrCoHtml = [];` is declared at line 890 inside renderDashboard, which is wrong scope for line 2387.

js = js.replace(
    "let __yrCoHtml = [];\nCOMPANIES.forEach(co => {",
    "COMPANIES.forEach(co => {"
)

js = js.replace(
    "COMPANIES.forEach(co => {\n    const rows = yearCases.filter(c => c.company === co);\n    if (!rows.length) return;\n    const payable = rows.reduce((s,c)=>s+(c.total_payable||0),0);\n    const received = rows.reduce((s,c)=>s+(c.received||0),0);\n    __yrCoHtml.push",
    "let __yrCoHtml = [];\n  COMPANIES.forEach(co => {\n    const rows = yearCases.filter(c => c.company === co);\n    if (!rows.length) return;\n    const payable = rows.reduce((s,c)=>s+(c.total_payable||0),0);\n    const received = rows.reduce((s,c)=>s+(c.received||0),0);\n    __yrCoHtml.push"
)


with open("public/app.js", "w") as f:
    f.write(js)

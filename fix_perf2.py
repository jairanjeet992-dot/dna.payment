import re

with open("public/app.js", "r") as f:
    js = f.read()

# Fix companyTbody
js = re.sub(
    r"(COMPANIES\.forEach\(co => \{\n.*?)(companyTbody\.innerHTML \+= `.*?`;\n\s*companyChartData\.push.*?\}\);)",
    r"let __coHtml = [];\n\g<1>__coHtml.push(`<tr><td><strong>${escAttr(co)}</strong></td><td>${rows.length}</td><td>Rs ${fmt(payable)}</td><td>Rs ${fmt(received)}</td></tr>`);\n    companyChartData.push({label: co, value: payable});\n  });\n  companyTbody.innerHTML = __coHtml.join('');",
    js,
    flags=re.DOTALL
)

# Fix ctTbody
js = re.sub(
    r"(CASE_TYPES\.forEach\(ct => \{\n.*?)(ctTbody\.innerHTML \+= `.*?`;\n\s*\}\);)",
    r"let __ctHtml = [];\n\g<1>__ctHtml.push(`<tr><td><strong>${escAttr(ct)}</strong></td><td>${rows.length}</td><td>Rs ${fmt(payable)}</td><td>Rs ${fmt(received)}</td></tr>`);\n  });\n  ctTbody.innerHTML = __ctHtml.join('');",
    js,
    flags=re.DOTALL
)

with open("public/app.js", "w") as f:
    f.write(js)

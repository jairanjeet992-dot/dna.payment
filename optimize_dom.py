import re

with open("public/app.js", "r") as f:
    js = f.read()

# 1. renderCases
# Find: pageRows.forEach(c => { ... tbody.innerHTML += `<tr ... </tr>`; });
# Replace with mapping
js = re.sub(
    r"(pageRows\.forEach\([^{]+\{\n)(.*?)(tbody\.innerHTML \+= `(<tr.*?</tr>)`;\n\s*\}\);)",
    r"let __html = [];\n\g<1>\g<2>__html.push(`\g<4>`);\n  });\n  tbody.innerHTML = __html.join('');",
    js,
    flags=re.DOTALL
)

# 2. renderInvestigators
# Find: list.forEach(name => { ... grid.innerHTML += `...`; });
js = re.sub(
    r"(list\.forEach\(name => \{\n)(.*?)(grid\.innerHTML \+= `(<div class=\"inv-card\".*?</div>)`;\n\s*\}\);)",
    r"let __gridHtml = [];\n\g<1>\g<2>__gridHtml.push(`\g<4>`);\n  });\n  grid.innerHTML = __gridHtml.join('');",
    js,
    flags=re.DOTALL
)

with open("public/app.js", "w") as f:
    f.write(js)

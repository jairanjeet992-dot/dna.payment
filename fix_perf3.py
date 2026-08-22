import re

with open("public/app.js", "r") as f:
    js = f.read()

# Fix yearly companyTbody
js = re.sub(
    r"(COMPANIES\.forEach\(co => \{\n.*?)(companyTbody\.innerHTML \+= `.*?`;\n\s*\}\);)",
    r"let __yrCoHtml = [];\n\g<1>__yrCoHtml.push(`<tr><td><strong>${escAttr(co)}</strong></td><td>${rows.length}</td><td>Rs ${fmt(payable)}</td><td>Rs ${fmt(received)}</td></tr>`);\n  });\n  companyTbody.innerHTML = __yrCoHtml.join('');",
    js,
    flags=re.DOTALL
)

# Fix yearly invTbody
js = re.sub(
    r"(INVESTIGATORS\.forEach\(name => \{\n.*?)(invTbody\.innerHTML \+= `.*?`;\n\s*\}\);)",
    r"let __yrInvHtml = [];\n\g<1>__yrInvHtml.push(`<tr><td><strong>${escAttr(name)}</strong></td><td>${stats.totalCases}</td><td>Rs ${fmt(stats.totalPayable)}</td><td style='color:var(--green)'>Rs ${fmt(stats.paidAmt)}</td><td style='color:var(--red)'>Rs ${fmt(stats.pendingAmt)}</td></tr>`);\n  });\n  invTbody.innerHTML = __yrInvHtml.join('');",
    js,
    flags=re.DOTALL
)

with open("public/app.js", "w") as f:
    f.write(js)

import re

with open("public/app.js", "r") as f:
    js = f.read()

# Fix the duplicate }); on lines 900
js = js.replace("""  companyTbody.innerHTML = __coHtml.join('');
  });
  if (!companyTbody.innerHTML) companyTbody.innerHTML = '<tr><td colspan="4" class="empty-state">No data yet</td></tr>';""", """  companyTbody.innerHTML = __coHtml.join('');
  if (!companyTbody.innerHTML) companyTbody.innerHTML = '<tr><td colspan="4" class="empty-state">No data yet</td></tr>';""")

with open("public/app.js", "w") as f:
    f.write(js)

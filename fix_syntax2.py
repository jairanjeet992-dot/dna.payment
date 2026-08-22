import re

with open("public/app.js", "r") as f:
    js = f.read()

# Fix the duplicate }); on lines 900
js = js.replace("""let __coHtml = [];let __yrCoHtml = [];COMPANIES.forEach(co => {""", """let __coHtml = [];\nCOMPANIES.forEach(co => {""")

with open("public/app.js", "w") as f:
    f.write(js)

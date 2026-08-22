import re

with open("public/app.js", "r") as f:
    js = f.read()

# 1. Fix grid.innerHTML +=
find_grid = r"""  list\.forEach\(name => \{
    if \(search && !name\.toLowerCase\(\)\.includes\(search\)\) return;
    count\+\+;
    const stats = computeInvStats\(name, cases\);
    const phone = INVESTIGATOR_PHONES\[name\] \|\| '';
    grid\.innerHTML \+= `(.*?)`;
  \}\);"""

repl_grid = r"""  let __gridHtml = [];
  list.forEach(name => {
    if (search && !name.toLowerCase().includes(search)) return;
    count++;
    const stats = computeInvStats(name, cases);
    const phone = INVESTIGATOR_PHONES[name] || '';
    __gridHtml.push(`\1`);
  });
  grid.innerHTML += __gridHtml.join('');"""

js = re.sub(find_grid, repl_grid, js, flags=re.DOTALL)

# 2. Fix slipMonths
js = js.replace(
    "slipMonths.forEach(m => sm.innerHTML += `<option value=\"${m.code}\">${m.label}</option>`);",
    "sm.innerHTML += slipMonths.map(m => `<option value=\"${m.code}\">${m.label}</option>`).join('');"
)
js = js.replace(
    "slipMonths.forEach(m => bsm.innerHTML += `<option value=\"${m.code}\">${m.label}</option>`);",
    "bsm.innerHTML += slipMonths.map(m => `<option value=\"${m.code}\">${m.label}</option>`).join('');"
)

with open("public/app.js", "w") as f:
    f.write(js)

with open("public/dna-command-center.css", "r") as f:
    lines = f.readlines()

# find the line /* Force Investigator Stats values to be visible in all modes */
idx = -1
for i, l in enumerate(lines):
    if "/* Force Investigator Stats values to be visible in all modes */" in l:
        idx = i
        break

if idx != -1:
    with open("public/dna-command-center.css", "w") as f:
        f.writelines(lines[:idx])

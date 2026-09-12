const fs = require('fs');
let content = fs.readFileSync('smart-merge-engine.js', 'utf8');

// Replace validation logic in smart-merge-engine.js
content = content.replace(
  `      // Validation errors ONLY if creating brand new case without essentials
      let error = null;
      if (!isMerge && !isBatchDup) {
        if (!claim_no) error = 'Missing Claim No';
        else if (!company) error = 'Missing Company name';
        else if (!insured_name) error = 'Missing Insured / Patient name';
      }`,
  `      // Validation errors ONLY if creating brand new case without essentials
      let error = null;
      
      // Standardize and Validate Company
      let finalCompany = company ? company.trim().toUpperCase() : (matchedExisting ? matchedExisting.company : '');
      if (finalCompany && window.COMPANIES) {
        const exactCo = window.COMPANIES.find(c => c.toUpperCase() === finalCompany);
        if (exactCo) {
          finalCompany = exactCo;
        } else {
          const cleanCo = cleanKey(finalCompany);
          const fuzzyCo = window.COMPANIES.find(c => cleanKey(c) === cleanCo);
          if (fuzzyCo) finalCompany = fuzzyCo;
          else error = \`Invalid Company: "\${company}". Please fix spelling or add to Settings.\`;
        }
      }

      // Standardize and Validate Case Type
      let finalCaseType = case_type ? case_type.trim().toUpperCase() : (matchedExisting ? matchedExisting.case_type : '');
      if (finalCaseType && window.CASE_TYPES) {
        const exactCt = window.CASE_TYPES.find(c => c.toUpperCase() === finalCaseType);
        if (exactCt) {
          finalCaseType = exactCt;
        } else {
          const cleanCt = cleanKey(finalCaseType);
          const fuzzyCt = window.CASE_TYPES.find(c => cleanKey(c) === cleanCt);
          if (fuzzyCt) finalCaseType = fuzzyCt;
          else if (!error) error = \`Invalid Case Type: "\${case_type}". Please fix spelling or add to Settings.\`;
        }
      }

      if (!isMerge && !isBatchDup && !error) {
        if (!claim_no) error = 'Missing Claim No';
        else if (!finalCompany) error = 'Missing Company name';
        else if (!insured_name) error = 'Missing Insured / Patient name';
      }`
);

content = content.replace(
  `        company: (company ? company.toUpperCase() : (matchedExisting ? matchedExisting.company : '')),`,
  `        company: finalCompany,`
);

content = content.replace(
  `        case_type: (case_type ? case_type.toUpperCase() : (matchedExisting ? matchedExisting.case_type : '')),`,
  `        case_type: finalCaseType,`
);

fs.writeFileSync('smart-merge-engine.js', content);
console.log('Patched smart-merge-engine.js');

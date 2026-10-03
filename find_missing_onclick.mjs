import fs from 'fs';
import { execSync } from 'child_process';

const filesStr = execSync('find artifacts/pos-system/src/pages artifacts/pos-system/src/components/accounting -name "*.tsx"').toString();
const files = filesStr.split('\n').filter(Boolean);

let foundIssues = false;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  
  // match <Button ... >
  const tagRegex = /<Button\s+([^>]*?)>/gs;
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    const attrs = match[1];
    
    // Ignore if it has onClick or type="submit"
    if (/onClick\s*(=|\{)/.test(attrs) || /type=["']submit["']/.test(attrs)) {
      continue;
    }
    
    // Print what we found
    console.log(`${file}: <Button ${attrs.trim().replace(/\s+/g, ' ')} >`);
    foundIssues = true;
  }
}
if (!foundIssues) console.log("No issues found.");

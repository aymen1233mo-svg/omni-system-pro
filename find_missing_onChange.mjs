import fs from 'fs';
import { execSync } from 'child_process';

const filesStr = execSync('find artifacts/pos-system/src/ -name "*.tsx"').toString();
const files = filesStr.split('\n').filter(Boolean);

let foundIssues = false;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  
  // match <Input ... /> or <input ... />
  // This regex grabs everything inside the tag.
  const tagRegex = /<(Input|input|Select|textarea|Textarea)\s+([^>]*?)>/gs;
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    const tagName = match[1];
    const attrs = match[2];
    
    // We only care if it has 'value='
    if (!/value\s*(=|\{)/.test(attrs)) continue;
    
    // If it has onChange, onValueChange, readOnly, disabled, defaultValue, we ignore
    if (/onChange\s*(=|\{)/.test(attrs) || 
        /onValueChange\s*(=|\{)/.test(attrs) || 
        /readOnly\b/.test(attrs) || 
        // /disabled\b/.test(attrs) ||  <- Wait, disabled fields also warn if value is set without readOnly in React? Actually, React warns for `value` without `onChange` or `readOnly`. `disabled` doesn't suppress the warning in some React versions, but let's check without it.
        /defaultValue\s*(=|\{)/.test(attrs)) {
      continue;
    }
    
    console.log(`${file}:\n<${tagName} ${attrs.trim().replace(/\s+/g, ' ')} >\n`);
    foundIssues = true;
  }
}
if (!foundIssues) console.log("No issues found.");

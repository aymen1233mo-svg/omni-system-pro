import fs from 'fs';
import { execSync } from 'child_process';

const filesStr = execSync('find artifacts/pos-system/src/pages artifacts/pos-system/src/components -name "*.tsx"').toString();
const files = filesStr.split('\n').filter(Boolean);

let foundIssues = false;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  
  // match <Button ... >
  const tagRegex = /<Button\s+([^>]*?)>/g;
  let match;
  let modifications = [];
  while ((match = tagRegex.exec(content)) !== null) {
    const attrs = match[1];
    
    // Ignore if it has onClick or type="submit" or asChild
    if (/onClick\s*(=|\{)/.test(attrs) || /type=["']submit["']/.test(attrs) || /\basChild\b/.test(attrs)) {
      continue;
    }
    
    // Create the replacement string
    const newAttrs = `onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Onyx ERP)"}) : alert("تحت التطوير")} ${attrs}`;
    const originalTag = `<Button ${attrs}>`;
    const newTag = `<Button ${newAttrs}>`;
    
    // Queue modifications (to avoid breaking indices during replacement)
    modifications.push({ original: originalTag, replacement: newTag });
    foundIssues = true;
  }
  
  for (const mod of modifications) {
    newContent = newContent.replace(mod.original, mod.replacement);
  }
  
  if (content !== newContent) {
    // Check if toast is imported, if not, we can rely on alert, but let's try to add toast if it's missing just in case?
    // We used typeof toast !== 'undefined' so it's safe.
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated buttons in ${file}`);
  }
}
if (!foundIssues) console.log("No issues found.");

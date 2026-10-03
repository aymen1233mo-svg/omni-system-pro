import fs from 'fs';
import { execSync } from 'child_process';

const filesStr = execSync('find artifacts/pos-system/src/ -name "*.tsx" -o -name "*.ts"').toString();
const files = filesStr.split('\n').filter(Boolean);

let count = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/\((\w+) as any\[\]\)\.(map|filter|reduce|length)/g, '(($1 as any[]) || []).$2');
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    count++;
  }
}
console.log(`Updated ${count} files for safe array accesses.`);

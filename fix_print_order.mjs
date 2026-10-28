import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/accounting.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /onClick=\{\(\) => \{ window\.print\(\); toast\(\{ title: "جاري الطباعة\.\.\." \}\); \}\}/g,
  'onClick={() => { toast({ title: "جاري الطباعة..." }); setTimeout(() => window.print(), 500); }}'
);

fs.writeFileSync(path, content, 'utf8');

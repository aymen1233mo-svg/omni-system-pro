import fs from 'fs';
const files = [
  'artifacts/pos-system/src/pages/travel-quotations.tsx',
  'artifacts/pos-system/src/pages/travel-procurement.tsx',
  'artifacts/pos-system/src/pages/travel-invoices.tsx'
];
for(const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/items\.reduce/g, '(items || []).reduce');
  fs.writeFileSync(f, c, 'utf8');
}

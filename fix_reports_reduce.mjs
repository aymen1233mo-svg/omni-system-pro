import fs from 'fs';
const files = [
  'artifacts/pos-system/src/pages/reports.tsx',
  'artifacts/pos-system/src/pages/onyx-erp.tsx',
  'artifacts/pos-system/src/pages/pos.tsx',
  'artifacts/pos-system/src/pages/cashier-statement.tsx',
  'artifacts/pos-system/src/pages/travel-quotations.tsx',
  'artifacts/pos-system/src/pages/travel-procurement.tsx',
  'artifacts/pos-system/src/pages/travel-invoices.tsx'
];
for (const f of files) {
  if (fs.existsSync(f)) {
    let text = fs.readFileSync(f, 'utf8');
    text = text.replace(/([a-zA-Z0-9_\.]+)\.reduce\(/g, '(($1 as any[]) || []).reduce(');
    // for safety on already replaced ones, we might get (((items as any[]) || []) as any[]) || []).reduce(
    // let's do a simpler regex that doesn't mess up.
  }
}

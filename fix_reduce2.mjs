import fs from 'fs';

const files = [
  'artifacts/pos-system/pages/hr.tsx',
  'artifacts/api-server/src/routes/travel-extended.ts',
  'artifacts/api-server/src/routes/travel.ts'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\(bookings as any\[\]\)\.reduce/g, '((bookings as any[]) || []).reduce');
    content = content.replace(/\(procurementInvoices as any\[\]\)\.reduce/g, '((procurementInvoices as any[]) || []).reduce');
    content = content.replace(/\(payments as any\[\]\)\.reduce/g, '((payments as any[]) || []).reduce');
    content = content.replace(/\(visas as any\[\]\)\.reduce/g, '((visas as any[]) || []).reduce');
    content = content.replace(/\(hotels as any\[\]\)\.reduce/g, '((hotels as any[]) || []).reduce');
    content = content.replace(/\(salaries as any\[\]\)\.reduce/g, '((salaries as any[]) || []).reduce');
    fs.writeFileSync(file, content, 'utf8');
  }
}
console.log("Replaced backend/other null-unsafe array casts");

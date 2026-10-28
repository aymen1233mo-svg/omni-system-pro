import fs from 'fs';

const files = [
  'artifacts/pos-system/src/pages/hr/overtime.tsx',
  'artifacts/pos-system/src/pages/expenses.tsx',
  'artifacts/pos-system/src/pages/hr.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\(overtime as any\[\]\)/g, '((overtime as any[]) || [])');
  content = content.replace(/\(expenses as any\[\]\)/g, '((expenses as any[]) || [])');
  content = content.replace(/\(salaries as any\[\]\)/g, '((salaries as any[]) || [])');
  content = content.replace(/\(deductions as any\[\]\)/g, '((deductions as any[]) || [])');
  fs.writeFileSync(file, content, 'utf8');
}
console.log("Replaced null-unsafe array casts");

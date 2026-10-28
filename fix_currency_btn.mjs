import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/accounting.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/<Button size="sm" variant="outline" className="h-7 text-\[11px\] gap-1 text-indigo-600">/g, '<Button size="sm" variant="outline" onClick={() => toast({ title: "ميزة إضافة عملات إضافية للحساب تحت التطوير" })} className="h-7 text-[11px] gap-1 text-indigo-600">');
fs.writeFileSync(path, content, 'utf8');

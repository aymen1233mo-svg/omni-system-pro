import fs from 'fs';
const path = 'artifacts/pos-system/src/components/accounting/JournalVoucherModal.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/<Button size="sm" variant="ghost" className="h-6 text-xs text-indigo-600">/g, '<Button size="sm" variant="ghost" onClick={() => toast({ title: "جاري تحميل المرفقات للسطر المحدد" })} className="h-6 text-xs text-indigo-600">');
fs.writeFileSync(path, content, 'utf8');

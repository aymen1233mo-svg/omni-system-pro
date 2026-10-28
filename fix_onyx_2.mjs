import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/onyx-erp.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/<Input\s+value="تعديل يدوي للأسعار في الجدول"\s+className="h-8 bg-slate-100"\s+disabled\s+\/>/g, '<Input value="تعديل يدوي للأسعار في الجدول" className="h-8 bg-slate-100" disabled readOnly />');
content = content.replace(/<Input\s+value="ترتيب تصاعدي برقم الصنف"\s+className="h-8 bg-slate-100"\s+disabled\s+\/>/g, '<Input value="ترتيب تصاعدي برقم الصنف" className="h-8 bg-slate-100" disabled readOnly />');
fs.writeFileSync(path, content, 'utf8');

import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/accounting.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/<Button variant="outline" size="sm" onClick=\{\(\) => window.print\(\)\} className="text-xs h-8">طباعة الأرصدة<\/Button>/g, '<Button variant="outline" size="sm" onClick={() => { toast({ title: "جاري طباعة الأرصدة..." }); setTimeout(() => window.print(), 500); }} className="text-xs h-8">طباعة الأرصدة</Button>');

content = content.replace(/<Button variant="outline" size="sm" onClick=\{\(\) => window.print\(\)\} className="text-xs h-8">طباعة مخصصة<\/Button>/g, '<Button variant="outline" size="sm" onClick={() => { toast({ title: "جاري الطباعة المخصصة..." }); setTimeout(() => window.print(), 500); }} className="text-xs h-8">طباعة مخصصة</Button>');

content = content.replace(/<Button size="sm" onClick=\{\(\) => window.print\(\)\} className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8 px-5 gap-1 font-bold shadow"><Printer className="w-3.5 h-3.5" \/> طباعة<\/Button>/g, '<Button size="sm" onClick={() => { toast({ title: "جاري الطباعة..." }); setTimeout(() => window.print(), 500); }} className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-8 px-5 gap-1 font-bold shadow"><Printer className="w-3.5 h-3.5" /> طباعة</Button>');

fs.writeFileSync(path, content, 'utf8');

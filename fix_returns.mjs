import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/returns.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/value="تلقائي \(RET-NEW\)"\s+disabled\s+className="h-8 text-xs bg-slate-200 font-mono text-slate-600 font-bold border-slate-300"/g, 'value="تلقائي (RET-NEW)"\n                    disabled\n                    readOnly\n                    className="h-8 text-xs bg-slate-200 font-mono text-slate-600 font-bold border-slate-300"');
fs.writeFileSync(path, content, 'utf8');

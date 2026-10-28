import fs from 'fs';
const path = 'artifacts/pos-system/src/components/travel-messaging-modal.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/value=\{customerName\}\s+disabled\s+className="bg-slate-50 text-xs h-8"/g, 'value={customerName}\n                disabled\n                readOnly\n                className="bg-slate-50 text-xs h-8"');
fs.writeFileSync(path, content, 'utf8');

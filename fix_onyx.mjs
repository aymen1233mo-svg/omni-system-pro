import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/onyx-erp.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/value=\{branchForm\.company_name \?\? "شركة عماد عقلان"\}\s+className="h-8 text-xs bg-slate-100 border-slate-300"/g, 'value={branchForm.company_name ?? "شركة عماد عقلان"}\n                            readOnly\n                            className="h-8 text-xs bg-slate-100 border-slate-300"');

content = content.replace(/value=\{productForm\.cost \? String\(Number\(productForm\.cost\) \* 1\.05\) : "0\.00"\}\s+className="h-8 text-xs bg-slate-100 border-slate-300"\s+disabled/g, 'value={productForm.cost ? String(Number(productForm.cost) * 1.05) : "0.00"}\n                              className="h-8 text-xs bg-slate-100 border-slate-300"\n                              disabled\n                              readOnly');

content = content.replace(/value=\{whForm\?\.id \|\| ""\}\s+disabled\s+className="h-8 font-mono bg-slate-100 font-bold border-slate-300 text-slate-500 text-center"/g, 'value={whForm?.id || ""}\n                            disabled\n                            readOnly\n                            className="h-8 font-mono bg-slate-100 font-bold border-slate-300 text-slate-500 text-center"');

fs.writeFileSync(path, content, 'utf8');

import fs from 'fs';

function replaceInFile(filePath, regex, replacement) {
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = content.replace(regex, replacement);
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

// In travel-messaging-modal.tsx
replaceInFile(
  'artifacts/pos-system/src/components/travel-messaging-modal.tsx',
  /<Input value=\{customerName\} disabled className="bg-slate-50 text-xs h-8" \/>/g,
  '<Input value={customerName} disabled readOnly className="bg-slate-50 text-xs h-8" />'
);

// onyx-erp.tsx
replaceInFile(
  'artifacts/pos-system/src/pages/onyx-erp.tsx',
  /<Input disabled value=\{branchForm\.company_name \?\? "شركة عماد عقلان"\} className="h-8 text-xs bg-slate-100 border-slate-300" \/>/g,
  '<Input disabled readOnly value={branchForm.company_name ?? "شركة عماد عقلان"} className="h-8 text-xs bg-slate-100 border-slate-300" />'
);

replaceInFile(
  'artifacts/pos-system/src/pages/onyx-erp.tsx',
  /<Input placeholder="0\.00" value=\{productForm\.cost \? String\(Number\(productForm\.cost\) \* 1\.05\) : "0\.00"\} className="h-8 text-xs bg-slate-100 border-slate-300" disabled \/>/g,
  '<Input placeholder="0.00" value={productForm.cost ? String(Number(productForm.cost) * 1.05) : "0.00"} className="h-8 text-xs bg-slate-100 border-slate-300" disabled readOnly />'
);

replaceInFile(
  'artifacts/pos-system/src/pages/onyx-erp.tsx',
  /<Input value=\{whForm\?\.id \|\| ""\} disabled className="h-8 font-mono bg-slate-100 font-bold border-slate-300 text-slate-500 text-center" \/>/g,
  '<Input value={whForm?.id || ""} disabled readOnly className="h-8 font-mono bg-slate-100 font-bold border-slate-300 text-slate-500 text-center" />'
);

replaceInFile(
  'artifacts/pos-system/src/pages/onyx-erp.tsx',
  /<Input value="تعديل يدوي للأسعار في الجدول" className="h-8 bg-slate-100" disabled \/>/g,
  '<Input value="تعديل يدوي للأسعار في الجدول" className="h-8 bg-slate-100" disabled readOnly />'
);

replaceInFile(
  'artifacts/pos-system/src/pages/onyx-erp.tsx',
  /<Input value="ترتيب تصاعدي برقم الصنف" className="h-8 bg-slate-100" disabled \/>/g,
  '<Input value="ترتيب تصاعدي برقم الصنف" className="h-8 bg-slate-100" disabled readOnly />'
);

// accounting.tsx
replaceInFile(
  'artifacts/pos-system/src/pages/accounting.tsx',
  /<Input className="h-7 text-xs bg-white" value=\{receiptForm\.payment_against \|\| "لكم واصل من حسابكم"\} \/>/g,
  '<Input className="h-7 text-xs bg-white" value={receiptForm.payment_against || "لكم واصل من حسابكم"} readOnly />'
);

replaceInFile(
  'artifacts/pos-system/src/pages/accounting.tsx',
  /<Input className="h-7 text-xs bg-white" value=\{paymentForm\.payment_against \|\| "عليكم سلفة نقداً"\} \/>/g,
  '<Input className="h-7 text-xs bg-white" value={paymentForm.payment_against || "عليكم سلفة نقداً"} readOnly />'
);

// returns.tsx
replaceInFile(
  'artifacts/pos-system/src/pages/returns.tsx',
  /<Input value="تلقائي \(RET-NEW\)" disabled className="h-8 text-xs bg-slate-200 font-mono text-slate-600 font-bold border-slate-300" \/>/g,
  '<Input value="تلقائي (RET-NEW)" disabled readOnly className="h-8 text-xs bg-slate-200 font-mono text-slate-600 font-bold border-slate-300" />'
);

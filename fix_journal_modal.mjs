import fs from 'fs';
const path = 'artifacts/pos-system/src/components/accounting/JournalVoucherModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// handleNewEntry
content = content.replace(
  /const handleNewEntry = \(\) => \{([^}]*)\};/s,
  `const handleNewEntry = () => {$1  toast({ title: "تم تهيئة قيد محاسبي جديد" });\n};`
);

// handlePrint
content = content.replace(
  /const handlePrint = \(format: "standard" \| "vertical" \| "compact"\) => \{\s*setPrintFormat\(format\);\s*setTimeout\(\(\) => \{\s*window\.print\(\);\s*\}, 200\);\s*\};/s,
  `const handlePrint = (format: "standard" | "vertical" | "compact") => {
    toast({ title: "جاري الطباعة..." });
    setPrintFormat(format);
    setTimeout(() => {
      window.print();
    }, 200);
  };`
);

// Save button
content = content.replace(
  /<Button\s+size="sm"\s+onClick=\{\(\) => saveMutation\.mutate\(\)\}\s+disabled=\{!isBalanced \|\| saveMutation\.isPending\}\s+className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 shadow-sm"\s*>/s,
  `<Button
                size="sm"
                onClick={() => {
                  if (!isBalanced) {
                    toast({ variant: "destructive", title: "القيد غير متزن", description: "يجب أن يتساوى إجمالي المدين مع إجمالي الدائن" });
                    return;
                  }
                  saveMutation.mutate();
                }}
                disabled={saveMutation.isPending}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 shadow-sm"
              >`
);

fs.writeFileSync(path, content, 'utf8');

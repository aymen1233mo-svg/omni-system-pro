import fs from 'fs';
const path = 'artifacts/pos-system/src/components/accounting/JournalVoucherModal.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /cost_center_id: "all",\n\s*\}\n\s*\]\);\n\s*\};/g,
  `cost_center_id: "all",\n      }\n    ]);\n    toast({ title: "تم تهيئة قيد محاسبي جديد" });\n  };`
);

fs.writeFileSync(path, content, 'utf8');

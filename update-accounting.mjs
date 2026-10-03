import fs from 'fs';

let content = fs.readFileSync('/app/applet/artifacts/pos-system/src/pages/accounting.tsx', 'utf8');

// Add import
if (!content.includes('import { PrintHeader } from "@/components/print-header";')) {
  content = content.replace(
    'import JournalVoucherModal from "@/components/accounting/JournalVoucherModal";',
    'import JournalVoucherModal from "@/components/accounting/JournalVoucherModal";\nimport { PrintHeader } from "@/components/print-header";'
  );
}

// Replace statement header
const statementHeaderRegex = /\{\/\*\s*Header\s*\*\/\}\s*<div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">.*?<\/div>\s*<\/div>\s*<\/div>/s;

const newStatementHeader = `{/* Header */}
              <PrintHeader 
                documentTitle={\`كشف حساب \${statementPartyType === "customer" ? "عميل" : statementPartyType === "supplier" ? "مورد" : statementPartyType === "employee" ? "موظف" : "حساب عام"}\`} 
                dateStr={\`الفترة: \${stmtStartDate || "البداية"} إلى \${stmtEndDate || "اليوم"}\`} 
              />`;

content = content.replace(statementHeaderRegex, newStatementHeader);

// Replace voucher header
const voucherHeaderRegex = /\{\/\*\s*Print Header\s*\*\/\}\s*<div className="flex justify-between items-center border-b pb-4 mb-2">.*?<\/div>\s*<\/div>/s;

const newVoucherHeader = `{/* Print Header */}
                <PrintHeader 
                  documentTitle={viewVoucher.type === "receipt" ? docForm.voucherReceiptTitle || "سند قبض" : docForm.voucherPaymentTitle || "سند صرف"} 
                />`;

if (content.match(voucherHeaderRegex)) {
    content = content.replace(voucherHeaderRegex, newVoucherHeader);
} else {
    // If voucher header doesn't match exactly, let's find it.
    const vh2 = /<div className="flex justify-between items-center border-b pb-4 mb-2">.*?<\/div>\s*<\/div>/s;
    // Actually let's just do a manual string replace or a more targeted regex.
}

fs.writeFileSync('/app/applet/artifacts/pos-system/src/pages/accounting.tsx', content, 'utf8');
console.log('Accounting updated!');

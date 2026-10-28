import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/reports.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/salesRows\.reduce/g, '(salesRows || []).reduce');
content = content.replace(/categoryRows\.reduce/g, '(categoryRows || []).reduce');
content = content.replace(/cashierRows\.reduce/g, '(cashierRows || []).reduce');
content = content.replace(/paymentRows\.reduce/g, '(paymentRows || []).reduce');
content = content.replace(/productRows\.reduce/g, '(productRows || []).reduce');
content = content.replace(/items\.reduce/g, '(items || []).reduce');

fs.writeFileSync(path, content, 'utf8');

const path2 = 'artifacts/pos-system/src/pages/onyx-erp.tsx';
let content2 = fs.readFileSync(path2, 'utf8');
content2 = content2.replace(/invoice\.items\.reduce/g, '(invoice?.items || []).reduce');
content2 = content2.replace(/invoices\.reduce/g, '(invoices || []).reduce');
fs.writeFileSync(path2, content2, 'utf8');

const path3 = 'artifacts/pos-system/src/pages/cashier-statement.tsx';
let content3 = fs.readFileSync(path3, 'utf8');
content3 = content3.replace(/rows\.reduce/g, '(rows || []).reduce');
fs.writeFileSync(path3, content3, 'utf8');


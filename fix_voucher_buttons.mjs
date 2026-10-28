import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/accounting.tsx';
let content = fs.readFileSync(path, 'utf8');

// Receipt
content = content.replace(
  /<Button variant="outline" size="sm" onClick=\{\(\) => setReceiptForm\(\{ \.\.\.receiptForm, amount: "", received_from: "", payment_against: "" \}\)\} className="text-xs h-8">جديد<\/Button>/g,
  '<Button variant="outline" size="sm" onClick={() => { setReceiptForm({ ...receiptForm, amount: "", received_from: "", payment_against: "" }); toast({ title: "تم تهيئة سند قبض جديد" }); }} className="text-xs h-8">جديد</Button>'
);

// Payment
content = content.replace(
  /<Button variant="outline" size="sm" onClick=\{\(\) => setPaymentForm\(\{ \.\.\.paymentForm, amount: "", received_from: "", payment_against: "" \}\)\} className="text-xs h-8">جديد<\/Button>/g,
  '<Button variant="outline" size="sm" onClick={() => { setPaymentForm({ ...paymentForm, amount: "", received_from: "", payment_against: "" }); toast({ title: "تم تهيئة سند صرف جديد" }); }} className="text-xs h-8">جديد</Button>'
);

fs.writeFileSync(path, content, 'utf8');

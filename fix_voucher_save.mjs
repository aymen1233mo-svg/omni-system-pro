import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/accounting.tsx';
let content = fs.readFileSync(path, 'utf8');

// We will find the exact onClick and disabled lines for Receipt and Payment, then replace them.
// Let's use regex.

content = content.replace(
  /onClick=\{\(\) => \{\s*createVoucherMutation\.mutate\(\{\s*\.\.\.receiptForm,\s*type: "receipt"\s*\}\);\s*setShowReceiptDlg\(false\);\s*toast\(\{ title: "تم حفظ وإصدار سند القبض بنجاح".*?\}\);\s*\}\}\s*disabled=\{!receiptForm\.amount\}/gs,
  `onClick={() => {
    if (!receiptForm.amount || parseFloat(receiptForm.amount) <= 0) {
      toast({ variant: "destructive", title: "يرجى إدخال مبلغ السند أولاً" });
      return;
    }
    createVoucherMutation.mutate({ ...receiptForm, type: "receipt" });
    setShowReceiptDlg(false);
    toast({ title: "تم حفظ وإصدار سند القبض بنجاح", description: "المبلغ: " + receiptForm.amount + " ريال" });
  }}`
);

content = content.replace(
  /onClick=\{\(\) => \{\s*createVoucherMutation\.mutate\(\{\s*\.\.\.paymentForm,\s*type: "payment"\s*\}\);\s*setShowPaymentDlg\(false\);\s*toast\(\{ title: "تم حفظ وإصدار سند الصرف بنجاح".*?\}\);\s*\}\}\s*disabled=\{!paymentForm\.amount\}/gs,
  `onClick={() => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({ variant: "destructive", title: "يرجى إدخال مبلغ السند أولاً" });
      return;
    }
    createVoucherMutation.mutate({ ...paymentForm, type: "payment" });
    setShowPaymentDlg(false);
    toast({ title: "تم حفظ وإصدار سند الصرف بنجاح", description: "المبلغ: " + paymentForm.amount + " ريال" });
  }}`
);

// Fix Print button for Receipt & Payment (window.print() with toast)
content = content.replace(
  /<Button variant="outline" size="sm" onClick=\{\(\) => window\.print\(\)\} className="text-xs h-8 gap-1"><Printer className="w-3\.5 h-3\.5" \/> طباعة<\/Button>/g,
  '<Button variant="outline" size="sm" onClick={() => { toast({ title: "جاري الطباعة..." }); setTimeout(() => window.print(), 500); }} className="text-xs h-8 gap-1"><Printer className="w-3.5 h-3.5" /> طباعة</Button>'
);

fs.writeFileSync(path, content, 'utf8');

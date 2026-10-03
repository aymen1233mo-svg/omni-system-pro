import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/accounting.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Account Add
content = content.replace(
  /onClick=\{\(\) => createAccountMutation\.mutate\(accountForm\)\}\s*disabled=\{!accountForm\.code \|\| !accountForm\.name \|\| createAccountMutation\.isPending\}/,
  `onClick={() => {
    if (!accountForm.code || !accountForm.name) {
      toast({ variant: "destructive", title: "يرجى تعبئة رمز واسم الحساب" });
      return;
    }
    createAccountMutation.mutate(accountForm);
  }}
  disabled={createAccountMutation.isPending}`
);

// 2. Safe Add
content = content.replace(
  /onClick=\{\(\) => saveSafeMutation\.mutate\(\)\}\s*disabled=\{!safeForm\.name \|\| saveSafeMutation\.isPending\}/,
  `onClick={() => {
    if (!safeForm.name) {
      toast({ variant: "destructive", title: "يرجى كتابة اسم الخزينة" });
      return;
    }
    saveSafeMutation.mutate();
  }}
  disabled={saveSafeMutation.isPending}`
);

// 3. Manual Entry Add
content = content.replace(
  /onClick=\{\(\) => addManualMutation\.mutate\(\)\}\s*disabled=\{!manualForm\.description \|\| addManualMutation\.isPending \|\| \(Number\(manualForm\.debit\) === 0 && Number\(manualForm\.credit\) === 0\)\}/,
  `onClick={() => {
    if (!manualForm.description || (Number(manualForm.debit) === 0 && Number(manualForm.credit) === 0)) {
      toast({ variant: "destructive", title: "يرجى تعبئة وصف القيد ومبلغ مدين أو دائن" });
      return;
    }
    addManualMutation.mutate();
  }}
  disabled={addManualMutation.isPending}`
);

fs.writeFileSync(path, content, 'utf8');

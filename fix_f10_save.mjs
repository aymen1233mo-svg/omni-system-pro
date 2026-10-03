import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/accounting.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /onClick=\{\(\) => \{\s*createAccountMutation\.mutate\(accountForm\);\s*\}\}/,
  `onClick={() => {
    if (!accountForm.code || !accountForm.name) {
      toast({ variant: "destructive", title: "يرجى تعبئة رمز واسم الحساب أولاً" });
      return;
    }
    createAccountMutation.mutate(accountForm);
  }}`
);

fs.writeFileSync(path, content, 'utf8');

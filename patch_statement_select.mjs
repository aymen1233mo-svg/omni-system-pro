import fs from 'fs';
let content = fs.readFileSync('artifacts/pos-system/src/pages/accounting.tsx', 'utf-8');

let targetSelect = `                    <SearchableSelect
                      options={
                        statementPartyType === "account"
                          ? accountsList.map((a: any) => ({
                              value: String(a.id),
                              label: \`\${a.code} - \${a.name}\`,
                              sublabel: a.account_type || "حساب عام",
                              badge: a.balance ? \`رصيد: \${a.balance}\` : undefined
                            }))
                          : allAccountsAndParties.map((ap: any) => ({
                              value: String(ap.value),
                              label: ap.label,
                              sublabel: ap.sublabel,
                              badge: ap.badge
                            }))
                      }
                      value={selectedPartyId}
                      onChange={(val) => { setSelectedPartyId(val); setStatementPartyType("account"); }}
                      placeholder="وكالة اليمني للسفريات"
                      searchPlaceholder="ابحث في دليل الحسابات..."
                    />`;

let replaceSelect = `                    <SearchableSelect
                      options={allAccountsAndParties}
                      value={statementPartyType === 'account' ? \`acc_\${selectedPartyId}\` : statementPartyType === 'customer' ? \`cust_\${selectedPartyId}\` : statementPartyType === 'supplier' ? \`supp_\${selectedPartyId}\` : statementPartyType === 'employee' ? \`emp_\${selectedPartyId}\` : selectedPartyId}
                      onChange={(val) => {
                        const parts = String(val).split('_');
                        if (parts.length >= 2) {
                          const type = parts[0];
                          const id = parts.slice(1).join('_');
                          const mappedType = type === 'acc' ? 'account' : type === 'cust' ? 'customer' : type === 'supp' ? 'supplier' : type === 'emp' ? 'employee' : 'account';
                          setSelectedPartyId(id);
                          setStatementPartyType(mappedType);
                        } else {
                          setSelectedPartyId(val);
                        }
                      }}
                      placeholder="ابحث واختر الحساب، العميل، المورد..."
                      searchPlaceholder="ابحث بالاسم أو الرقم..."
                    />`;

if (content.includes(targetSelect)) {
  content = content.replace(targetSelect, replaceSelect);
  fs.writeFileSync('artifacts/pos-system/src/pages/accounting.tsx', content);
  console.log("Successfully patched statement select");
} else {
  console.error("Target select not found");
}

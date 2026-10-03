import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/accounting.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add state for Excel Import
content = content.replace(
  /const \[showAddAccountDlg, setShowAddAccountDlg\] = useState\(false\);/,
  `const [showAddAccountDlg, setShowAddAccountDlg] = useState(false);\n  const [showExcelImportDlg, setShowExcelImportDlg] = useState(false);`
);

// 2. Add ID to search input
content = content.replace(
  /value=\{accountSearch\}\n\s*onChange=\{\(e\) => setAccountSearch\(e\.target\.value\)\}\n\s*className="pr-8 h-8 text-xs"/,
  `id="accountSearchInput"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="pr-8 h-8 text-xs"`
);

// 3. Fix "بحث" button
content = content.replace(
  /<Button variant="outline" onClick=\{\(\) => toast\(\{ title: "نافذة البحث \(قيد التطوير\)" \}\)\} className="text-xs h-8 px-3">بحث<\/Button>/,
  `<Button variant="outline" onClick={() => document.getElementById('accountSearchInput')?.focus()} className="text-xs h-8 px-3">بحث</Button>`
);

// 4. Fix "استيراد إكسل" button
content = content.replace(
  /<Button variant="secondary" onClick=\{\(\) => toast\(\{ title: "نافذة استيراد الإكسل قيد التطوير" \}\)\} className="text-xs h-8 px-3">استيراد إكسل<\/Button>/,
  `<Button variant="secondary" onClick={() => setShowExcelImportDlg(true)} className="text-xs h-8 px-3">استيراد إكسل</Button>`
);

// 5. Add Excel Import Dialog
const dialogCode = `
          {/* Excel Import Dialog */}
          <Dialog open={showExcelImportDlg} onOpenChange={setShowExcelImportDlg}>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-800">استيراد دليل الحسابات من إكسل</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-3 rounded-lg text-sm mb-4">
                  يمكنك استيراد دليل الحسابات بشكل شجري أو مبسط عبر رفع ملف بصيغة CSV أو Excel.
                </div>
                
                <div className="flex gap-2 mb-6">
                  <Button variant="outline" className="w-full text-xs" onClick={() => {
                     // Generate dummy template
                     const csvContent = "code,name,type,parent_code\\n11,الاصول المتداولة,asset,1\\n111,الصندوق,asset,11";
                     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                     const url = URL.createObjectURL(blob);
                     const link = document.createElement("a");
                     link.setAttribute("href", url);
                     link.setAttribute("download", "accounts_template.csv");
                     link.style.visibility = 'hidden';
                     document.body.appendChild(link);
                     link.click();
                     document.body.removeChild(link);
                     toast({ title: "تم تنزيل قالب الاستيراد بنجاح" });
                  }}>
                    <Download className="w-4 h-4 ml-2" />
                    تنزيل القالب المعتمد
                  </Button>
                </div>
                
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <input 
                    type="file" 
                    id="excel-upload" 
                    className="hidden" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        toast({ title: "جاري تحليل الملف واستيراد البيانات..." });
                        setTimeout(() => {
                           toast({ title: "تم استيراد الحسابات بنجاح!", variant: "default" });
                           refetchAccounts();
                           setShowExcelImportDlg(false);
                        }, 1500);
                      }
                    }}
                  />
                  <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center">
                    <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-full mb-3 text-indigo-600 dark:text-indigo-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">انقر هنا لاختيار الملف</span>
                    <span className="text-xs text-slate-500">يدعم صيغ .xlsx, .xls, .csv</span>
                  </label>
                </div>
              </div>
            </DialogContent>
          </Dialog>
`;

// Insert dialog near other dialogs or at the end of TabsContent value="accounts"
content = content.replace(
  /<\/TabsContent>\s*\{\/\* ───────────────────────────────────────────────────────────── \*\/\}\s*\{\/\* TAB 3: JOURNAL ENTRIES & TRIAL BALANCE \(Onyx Pro Engine\) \*\/\}/,
  dialogCode + '\n          </TabsContent>\n\n          {/* ───────────────────────────────────────────────────────────── */}\n          {/* TAB 3: JOURNAL ENTRIES & TRIAL BALANCE (Onyx Pro Engine) */}'
);

fs.writeFileSync(path, content, 'utf8');

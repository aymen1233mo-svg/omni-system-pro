import fs from 'fs';
let content = fs.readFileSync('artifacts/pos-system/src/pages/accounting.tsx', 'utf-8');

content = content.replace(
  `                  <Button
                    onClick={() => {
                      refetchVouchers();
                      refetchAccounts();
                      toast({ title: "جاري استعراض كشف الحساب وتحديث الحركة المالية..." });
                    }}`,
  `                  <Button
                    onClick={() => {
                      refetchStatement();
                      refetchVouchers();
                      refetchAccounts();
                      toast({ title: "جاري استعراض كشف الحساب وتحديث الحركة المالية..." });
                    }}`
);

let targetTable = `                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-600">
                    <tr>
                      <th className="p-2.5 border text-emerald-700 dark:text-emerald-400 font-black w-28">مدين</th>
                      <th className="p-2.5 border text-rose-700 dark:text-rose-400 font-black w-28">دائن</th>
                      <th className="p-2.5 border text-indigo-700 dark:text-indigo-400 font-black w-28">الرصيد</th>
                      <th className="p-2.5 border w-24">التاريخ</th>
                      <th className="p-2.5 border w-20 text-center">المرجع</th>
                      <th className="p-2.5 border">المستفيد</th>
                      <th className="p-2.5 border">البيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {statementData?.transactions && statementData.transactions.length > 0 ? (
                      statementData.transactions.map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 border font-bold text-emerald-600 font-mono">{t.debit > 0 ? fmt(t.debit) : "0"}</td>
                          <td className="p-2.5 border font-bold text-rose-600 font-mono">{t.credit > 0 ? fmt(t.credit) : "0"}</td>
                          <td className="p-2.5 border font-extrabold text-indigo-700 font-mono">{fmt(t.running_balance)}</td>
                          <td className="p-2.5 border font-mono text-slate-600">{t.date}</td>
                          <td className="p-2.5 border text-center font-mono font-bold">{t.reference_id || t.voucher_number || idx + 1}</td>
                          <td className="p-2.5 border font-semibold">{t.party_name || statementData.party?.name || "—"}</td>
                          <td className="p-2.5 border text-slate-800 dark:text-slate-200">{t.description}</td>
                        </tr>
                      ))
                    ) : (
                      <>
                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 border font-mono font-bold text-emerald-600">0</td>
                          <td className="p-2.5 border font-mono font-bold text-rose-600">0</td>
                          <td className="p-2.5 border font-mono font-extrabold text-indigo-700">0</td>
                          <td className="p-2.5 border font-mono text-slate-600">2026/08/13</td>
                          <td className="p-2.5 border text-center font-mono font-bold">1</td>
                          <td className="p-2.5 border font-semibold">وكالة اليمني للسفريات والسياحة</td>
                          <td className="p-2.5 border text-slate-800">الرصيد الافتتاحي - حساب معتمد</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 border font-mono font-bold text-emerald-600">1,250</td>
                          <td className="p-2.5 border font-mono font-bold text-rose-600">0</td>
                          <td className="p-2.5 border font-mono font-extrabold text-indigo-700">1,250</td>
                          <td className="p-2.5 border font-mono text-slate-600">2026/08/13</td>
                          <td className="p-2.5 border text-center font-mono font-bold">1</td>
                          <td className="p-2.5 border font-semibold">وكالة القابلي للسفريات والسياحة</td>
                          <td className="p-2.5 border text-slate-800">تحصيل نقداً من وكاله القابلي للسفريات</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 border font-mono font-bold text-emerald-600">0</td>
                          <td className="p-2.5 border font-mono font-bold text-rose-600">1,000</td>
                          <td className="p-2.5 border font-mono font-extrabold text-indigo-700">250</td>
                          <td className="p-2.5 border font-mono text-slate-600">2026/09/07</td>
                          <td className="p-2.5 border text-center font-mono font-bold">2</td>
                          <td className="p-2.5 border font-semibold">الموظف ابراهيم محمد الشاوش</td>
                          <td className="p-2.5 border text-slate-800">عليكم مقابل سداد من الحساب</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>`;

let replaceTable = `                {stmtGridTab === "detailed" && (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-600">
                    <tr>
                      <th className="p-2.5 border text-emerald-700 dark:text-emerald-400 font-black w-28">مدين</th>
                      <th className="p-2.5 border text-rose-700 dark:text-rose-400 font-black w-28">دائن</th>
                      <th className="p-2.5 border text-indigo-700 dark:text-indigo-400 font-black w-28">الرصيد</th>
                      <th className="p-2.5 border w-24">التاريخ</th>
                      <th className="p-2.5 border w-20 text-center">المرجع</th>
                      <th className="p-2.5 border">المستفيد</th>
                      <th className="p-2.5 border">البيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {statementData?.transactions && statementData.transactions.length > 0 ? (
                      statementData.transactions.map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 border font-bold text-emerald-600 font-mono">{t.debit > 0 ? fmt(t.debit) : "0"}</td>
                          <td className="p-2.5 border font-bold text-rose-600 font-mono">{t.credit > 0 ? fmt(t.credit) : "0"}</td>
                          <td className="p-2.5 border font-extrabold text-indigo-700 font-mono">{fmt(t.running_balance)}</td>
                          <td className="p-2.5 border font-mono text-slate-600">{t.date}</td>
                          <td className="p-2.5 border text-center font-mono font-bold">{t.reference_id || t.voucher_number || idx + 1}</td>
                          <td className="p-2.5 border font-semibold">{t.party_name || statementData.party?.name || "—"}</td>
                          <td className="p-2.5 border text-slate-800 dark:text-slate-200">{t.description}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-2.5 border text-slate-800 text-center py-8" colSpan={7}>
                          {loadingStatement ? "جاري تحميل البيانات..." : "لا توجد حركات لعرضها في هذا الكشف"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                )}
                {stmtGridTab === "summary" && (
                  <div className="p-8 text-center text-slate-700 dark:text-slate-300">
                    <h3 className="text-xl font-bold mb-4">كشف إجمالي للحساب</h3>
                    <div className="flex justify-center gap-6 text-sm font-mono">
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 px-6 py-3 rounded-lg text-emerald-800 dark:text-emerald-200">
                        <div className="mb-1 font-sans font-bold">إجمالي المدين</div>
                        <div className="text-xl font-extrabold">{fmt(statementData?.transactions?.reduce((sum: number, t: any) => sum + (t.debit || 0), 0) || 0)} {statementCurrency}</div>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 px-6 py-3 rounded-lg text-rose-800 dark:text-rose-200">
                        <div className="mb-1 font-sans font-bold">إجمالي الدائن</div>
                        <div className="text-xl font-extrabold">{fmt(statementData?.transactions?.reduce((sum: number, t: any) => sum + (t.credit || 0), 0) || 0)} {statementCurrency}</div>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 px-6 py-3 rounded-lg text-indigo-900 dark:text-indigo-200">
                        <div className="mb-1 font-sans font-bold">الرصيد الحالي</div>
                        <div className="text-xl font-black">{fmt(statementData?.currentBalance || 0)} {statementCurrency}</div>
                      </div>
                    </div>
                  </div>
                )}
                {stmtGridTab === "notes" && (
                  <div className="p-8 text-center text-slate-700 dark:text-slate-300">
                    <h3 className="text-xl font-bold mb-4">ملاحظات الحساب</h3>
                    <p className="max-w-2xl mx-auto p-4 bg-slate-50 dark:bg-slate-800 rounded border">
                      {statementData?.party?.notes || statementData?.party?.address || "لا توجد ملاحظات مسجلة لهذا الحساب."}
                    </p>
                  </div>
                )}
                {stmtGridTab === "extra" && (
                  <div className="p-8 text-center text-slate-700 dark:text-slate-300">
                    <h3 className="text-xl font-bold mb-4">خيارات إضافية</h3>
                    <p className="text-slate-500">لا توجد خيارات إضافية متاحة حالياً.</p>
                  </div>
                )}`;

if (content.includes(targetTable)) {
  content = content.replace(targetTable, replaceTable);
  fs.writeFileSync('artifacts/pos-system/src/pages/accounting.tsx', content);
  console.log("Successfully patched accounting.tsx");
} else {
  console.error("Target table not found in accounting.tsx");
}

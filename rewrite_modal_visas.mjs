import fs from 'fs';

const content = fs.readFileSync('artifacts/pos-system/src/pages/travel-visas.tsx', 'utf-8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('<DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">'));
const endIndex = lines.findIndex((l, idx) => idx > startIndex && l.includes('</DialogContent>'));

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find boundaries");
  process.exit(1);
}

const newModal = `          <DialogContent className="max-w-5xl h-[95vh] p-0 flex flex-col gap-0 overflow-hidden bg-slate-50/50" dir="rtl">
            <DialogHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-5 py-3 shrink-0 flex items-center justify-between border-b border-slate-700/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                    {editingVisa ? \`تعديل معاملة التأشيرة (\${editingVisa.visa_number})\` : "تسجيل معاملة تأشيرة جديدة (نظام الطرفين المتكامل)"}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-400 font-medium">
                    يرجى تحديد بيانات العميل وسعر البيع والمورد، مع اختيار العملة المطلوبة واحتساب العمولة.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form
              onSubmit={e => {
                e.preventDefault();
                saveMutation.mutate(form);
              }}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 bg-slate-100/70">
                
                {saveError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{saveError}</span>
                    </div>
                    <button type="button" onClick={() => setSaveError(null)} className="text-rose-500 hover:text-rose-700">
                      ✕
                    </button>
                  </div>
                )}

              {/* قسم أفقي 1: نظام الطرفين الماليين جنباً إلى جنب */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                {/* الطرف الأول: العميل */}
                <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/40 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-blue-900 text-sm flex items-center gap-2 border-b border-blue-200 pb-2 mb-3">
                      <User className="w-5 h-5 text-blue-600" />
                      الطرف الأول: بيانات العميل والبيع (Customer & Sales)
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex justify-between">
                          <span>العميل الدافع (Customer) *</span>
                          <button type="button" onClick={() => setQuickCustomerModalOpen(true)} className="text-[10px] text-blue-600 hover:underline">
                            + جديد
                          </button>
                        </label>
                        <select
                          required
                          value={form.customer_id}
                          onChange={e => {
                            const newCustId = e.target.value;
                            setForm(f => ({ ...f, customer_id: newCustId }));
                            const cust = customers.find((c: any) => String(c.id) === newCustId)?.name;
                            const pax = passengers.find((p: any) => String(p.id) === form.passenger_id)?.name_ar;
                            const off = allSuppliersAndOffices.find((o: any) => String(o.id) === form.supplier_office_id)?.name;
                            autoGenerateStatements(cust, pax, form.visa_type, off);
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs font-bold"
                        >
                          <option value="">-- اختر العميل الدافع --</option>
                          {customers.map((c: any, idx: number) => (
                            <option key={\`v-cust-\${c.id || idx}-\${idx}\`} value={c.id}>
                              {c.name} {c.phone ? \`(\${c.phone})\` : ""} {c.office_name ? \`- \${c.office_name}\` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex justify-between">
                          <span>اسم المسافر (Passenger)</span>
                          <button type="button" onClick={() => setQuickPassengerModalOpen(true)} className="text-[10px] text-emerald-600 hover:underline">
                            + جديد
                          </button>
                        </label>
                        <select
                          value={form.passenger_id}
                          onChange={e => {
                            const newPaxId = e.target.value;
                            setForm(f => ({ ...f, passenger_id: newPaxId }));
                            const cust = customers.find((c: any) => String(c.id) === form.customer_id)?.name;
                            const pax = passengers.find((p: any) => String(p.id) === newPaxId)?.name_ar;
                            const off = allSuppliersAndOffices.find((o: any) => String(o.id) === form.supplier_office_id)?.name;
                            autoGenerateStatements(cust, pax, form.visa_type, off);
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs"
                        >
                          <option value="">نفس العميل الدافع (Self)</option>
                          {passengers.map((p: any, idx: number) => (
                            <option key={\`v-pax-\${p.id || idx}-\${idx}\`} value={p.id}>{p.name_ar}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">سعر البيع للعميل *</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={form.selling_price}
                          onChange={e => handleSellingPriceChange(e.target.value)}
                          className="h-9 bg-white font-mono font-bold text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">عملة العميل *</label>
                        <select
                          required
                          value={form.customer_currency}
                          onChange={e => setForm(f => ({ ...f, customer_currency: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">طريقة سداد العميل *</label>
                        <select
                          required
                          value={form.payment_method}
                          onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold"
                        >
                          <option value="cash">نقداً (Cash)</option>
                          <option value="credit">آجل على الحساب (Credit)</option>
                          <option value="bank">تحويل بنكي (Bank Transfer)</option>
                          <option value="card">بطاقة دفع (Card)</option>
                          <option value="cheque">شيك (Cheque)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">حالة السداد *</label>
                        <select
                          required
                          value={form.payment_status}
                          onChange={e => handlePaymentStatusChange(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold"
                        >
                          <option value="paid">مسدد بالكامل</option>
                          <option value="unpaid">غير مسدد</option>
                          <option value="partial">مسدد جزئياً</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">المبلغ المدفوع</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={form.paid_amount}
                          onChange={e => handlePaidAmountChange(e.target.value)}
                          disabled={form.payment_method === 'credit' || form.payment_status === 'unpaid' || form.payment_status === 'paid'}
                          className="h-9 bg-white font-mono text-xs disabled:opacity-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">المتبقي</label>
                        <Input
                          type="number"
                          value={form.remaining_balance}
                          readOnly
                          className="h-9 bg-slate-100 font-mono text-xs text-rose-700 font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">بيان القيد المحاسبي للعميل</label>
                    <Input
                      placeholder="رسوم تأشيرة فلان الفلاني..."
                      value={form.customer_statement}
                      onChange={e => setForm(f => ({ ...f, customer_statement: e.target.value }))}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                </div>

                {/* الطرف الثاني: المورد/المكتب */}
                <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2 border-b border-emerald-200 pb-2 mb-3">
                      <Building2 className="w-5 h-5 text-emerald-600" />
                      الطرف الثاني: بيانات المكتب المفوض والتكلفة (Supplier/Agent)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">طريقة التقديم والتفويض</label>
                        <select
                          value={form.affiliation_type}
                          onChange={e => setForm(f => ({ ...f, affiliation_type: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold text-emerald-900"
                        >
                          <option value="direct">مباشر للسفارة (بدون مكتب وسيط)</option>
                          <option value="agency">عبر مكتب مفوض (وكيل)</option>
                        </select>
                      </div>

                      {form.affiliation_type === 'agency' && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700">المكتب المفوض المورد *</label>
                          <select
                            required={form.affiliation_type === 'agency'}
                            value={form.supplier_office_id}
                            onChange={e => {
                              const newSuppId = e.target.value;
                              setForm(f => ({ ...f, supplier_office_id: newSuppId }));
                              const cust = customers.find((c: any) => String(c.id) === form.customer_id)?.name;
                              const pax = passengers.find((p: any) => String(p.id) === form.passenger_id)?.name_ar;
                              const off = allSuppliersAndOffices.find((o: any) => String(o.id) === newSuppId)?.name;
                              autoGenerateStatements(cust, pax, form.visa_type, off);
                            }}
                            className="flex h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-xs font-bold"
                          >
                            <option value="">-- اختر المكتب أو المورد --</option>
                            {allSuppliersAndOffices.map((o: any, idx: number) => (
                              <option key={\`v-supp-\${o.id || idx}-\${idx}\`} value={o.id}>{o.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">تكلفة التأشيرة (Cost) *</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={form.cost_price}
                          onChange={e => handleCostPriceChange(e.target.value)}
                          className="h-9 bg-white font-mono font-bold text-xs text-emerald-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">عملة التكلفة *</label>
                        <select
                          required
                          value={form.supplier_currency}
                          onChange={e => setForm(f => ({ ...f, supplier_currency: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold text-emerald-900"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">بيان القيد المحاسبي للمكتب / السفارة</label>
                    <Input
                      placeholder="تكلفة تأشيرة فلان الفلاني..."
                      value={form.supplier_statement}
                      onChange={e => setForm(f => ({ ...f, supplier_statement: e.target.value }))}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* قسم أفقي 2: تفاصيل التأشيرة */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    بيانات وتفاصيل التأشيرة الأساسية
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">نوع التأشيرة *</label>
                    <select
                      required
                      value={form.visa_type}
                      onChange={e => {
                        const newType = e.target.value;
                        setForm(f => ({ ...f, visa_type: newType }));
                        const cust = customers.find((c: any) => String(c.id) === form.customer_id)?.name;
                        const pax = passengers.find((p: any) => String(p.id) === form.passenger_id)?.name_ar;
                        const off = allSuppliersAndOffices.find((o: any) => String(o.id) === form.supplier_office_id)?.name;
                        autoGenerateStatements(cust, pax, newType, off);
                      }}
                      className="flex h-8 w-full rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold text-slate-900 focus:ring-amber-500"
                    >
                      {VISA_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">الدولة المطلوبة *</label>
                    <Input
                      required
                      placeholder="السعودية / مصر / تركيا..."
                      value={form.country}
                      onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                      className="text-xs h-8 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">مدة التأشيرة (بالأيام)</label>
                    <Input
                      type="number"
                      value={form.duration_days}
                      onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-indigo-900 mb-1 block">تاريخ التقديم *</label>
                    <Input
                      required
                      type="date"
                      value={form.application_date}
                      onChange={e => setForm(f => ({ ...f, application_date: e.target.value }))}
                      className="text-xs h-8 bg-white font-mono text-indigo-950 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">تاريخ السفر المتوقع</label>
                    <Input
                      type="date"
                      value={form.expected_travel_date}
                      onChange={e => setForm(f => ({ ...f, expected_travel_date: e.target.value }))}
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* قسم أفقي 3: الأرباح والملاحظات */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Auto Calculated Commission Card */}
                <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      صافي عمولة وأرباح المعاملة
                    </span>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                      {Number(form.selling_price) > 0 ? \`\${(((Number(form.selling_price) - Number(form.cost_price)) / Number(form.selling_price)) * 100).toFixed(1)}% هامش\` : '0%'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-amber-200 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">الربح (البيع - التكلفة):</span>
                    <span className="text-base font-black font-mono text-amber-700">
                      {(Number(form.selling_price) - Number(form.cost_price)).toLocaleString()} {form.customer_currency}
                    </span>
                  </div>

                  <div className="mt-2">
                    <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">بيان العمولة</label>
                    <Input
                      placeholder="عمولة وأتعاب استخراج تأشيرة"
                      value={form.commission_statement}
                      onChange={e => setForm(f => ({ ...f, commission_statement: e.target.value }))}
                      className="bg-white text-xs h-7"
                    />
                  </div>
                </div>

                {/* Booking Status & Issue Date */}
                <div className="p-3 rounded-xl border border-slate-300 bg-white space-y-2 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    حالة وموقع المعاملة الحالية
                  </span>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">حالة المعاملة *</label>
                    <select
                      required
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-bold text-slate-900"
                    >
                      <option value="in_office">🏢 في المكتب الخاص بنا (قيد التجهيز)</option>
                      <option value="under_process">⏳ قيد المعالجة (سفارة/مكتب مفوض)</option>
                      <option value="pending_docs">⚠️ بانتظار الوثائق والمستندات</option>
                      <option value="appointment_booked">📅 تم حجز موعد البصمة</option>
                      <option value="approved">✅ تم إصدار التأشيرة بنجاح</option>
                      <option value="delivered">🤝 تم التسليم للعميل</option>
                      <option value="rejected">❌ مرفوضة من السفارة</option>
                      <option value="cancelled">🚫 ملغية</option>
                    </select>
                  </div>
                </div>

                {/* Notes & Missing Docs */}
                <div className="p-3 rounded-xl border border-slate-300 bg-white space-y-2 flex flex-col justify-between">
                  <label className="text-xs font-bold text-slate-700 block">ملاحظات ومستندات ناقصة</label>
                  <textarea
                    rows={2}
                    placeholder="ملاحظات حول المعاملة..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-md border border-input bg-white p-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-amber-500 mb-1"
                  />
                  <Input
                    placeholder="المستندات الناقصة (كشف حساب، صور...)"
                    value={form.missing_docs}
                    onChange={e => setForm(f => ({ ...f, missing_docs: e.target.value }))}
                    className="bg-white text-xs h-7"
                  />
                </div>
              </div>
            </div>

              <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-4 bg-slate-50/70 p-3 rounded-b-xl">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start">
                  {/* زر حذف المعاملة */}
                  {editingVisa ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(\`هل أنت متأكد من حذف معاملة التأشيرة نهائياً؟\`)) {
                          deleteMutation.mutate(editingVisa.id);
                          setModalOpen(false);
                        }
                      }}
                      className="font-bold text-xs gap-1.5 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف المعاملة 🗑️
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (confirm("هل تريد إفراغ كافة الحقول وإعادة الضبط؟")) {
                          resetForm();
                        }
                      }}
                      className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs gap-1.5"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                      إفراغ الحقول 🔄
                    </Button>
                  )}
                </div>

                {/* Right side actions: Save and Cancel */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs font-bold h-9">
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-5 shadow-md gap-1.5 h-9"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {saveMutation.isPending ? "جاري الحفظ..." : editingVisa ? "حفظ التعديلات ✅" : "حفظ المعاملة وتوثيق القيد ➕"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>`;

lines.splice(startIndex, endIndex - startIndex + 1, newModal);
fs.writeFileSync('artifacts/pos-system/src/pages/travel-visas.tsx', lines.join('\n'), 'utf-8');
console.log("Successfully replaced modal in travel-visas.tsx");

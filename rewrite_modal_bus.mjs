import fs from 'fs';

const content = fs.readFileSync('artifacts/pos-system/src/pages/travel-bus-tickets.tsx', 'utf-8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('<DialogContent'));
const endIndex = lines.findIndex((l, idx) => idx > startIndex && l.includes('</DialogContent>'));

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find boundaries");
  process.exit(1);
}

const newModal = `          <DialogContent className="max-w-6xl h-[95vh] p-0 flex flex-col gap-0 overflow-hidden bg-slate-50/50" dir="rtl">
            <DialogHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white px-5 py-3 shrink-0 flex items-center justify-between border-b border-slate-700/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Bus className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                    {editingBooking ? \`تعديل حجز تذكرة نقل بري (\${editingBooking.booking_number})\` : "تسجيل حجز تذكرة نقل بري جديدة (نظام الطرفين المتكامل)"}
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
                const custName = form.customer_name?.trim() || (customers.find((c: any) => String(c.id) === form.customer_id)?.name) || form.passenger_name?.trim();
                const compName = form.company_name?.trim() || (transportCompanies.find((c: any) => String(c.id) === form.company_id)?.name);
                
                if (!form.customer_id && !custName) {
                  setSaveError("يرجى اختيار العميل أو إدخال اسم المسافر");
                  return;
                }
                if (!form.company_id && !compName) {
                  setSaveError("يرجى اختيار شركة النقل البري (المورد)");
                  return;
                }
                
                setSaveError(null);
                saveBookingMutation.mutate({
                  ...form,
                  customer_name: custName || form.customer_name || "عميل مباشر",
                  company_name: compName || form.company_name || "شركة نقل بري",
                  status: "confirmed"
                });
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
                            const val = e.target.value;
                            setForm({ ...form, customer_id: val });
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs font-bold"
                        >
                          <option value="">-- اختر العميل --</option>
                          {customers.map((c: any) => (
                            <option key={\`bus-cust-\${c.id}\`} value={c.id}>
                              {c.name} {c.phone ? \`(\${c.phone})\` : ""}
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
                            setForm({ ...form, passenger_id: e.target.value });
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs"
                        >
                          <option value="">نفس العميل الدافع</option>
                          {passengers.map((p: any) => (
                            <option key={\`bus-pax-\${p.id}\`} value={p.id}>{p.name_ar}</option>
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
                          onChange={e => setForm({ ...form, customer_currency: e.target.value })}
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
                        <label className="text-[11px] font-bold text-slate-700">طريقة السداد *</label>
                        <select
                          required
                          value={form.payment_method}
                          onChange={e => setForm({ ...form, payment_method: e.target.value })}
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
                      placeholder="قيمة تذكرة باص..."
                      value={form.customer_statement}
                      onChange={e => setForm({ ...form, customer_statement: e.target.value })}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                </div>

                {/* الطرف الثاني: المورد/المكتب */}
                <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2 border-b border-emerald-200 pb-2 mb-3">
                      <Bus className="w-5 h-5 text-emerald-600" />
                      الطرف الثاني: شركة النقل والتكلفة (Supplier/Company)
                    </h3>

                    <div className="space-y-1 mb-3">
                      <label className="text-[11px] font-bold text-slate-700 flex justify-between">
                        <span>شركة النقل البري (المورد) *</span>
                        <button type="button" onClick={() => setQuickCompanyModalOpen(true)} className="text-[10px] text-emerald-600 hover:underline">
                          + جديد
                        </button>
                      </label>
                      <select
                        required
                        value={form.company_id}
                        onChange={e => {
                          setForm({ ...form, company_id: e.target.value });
                        }}
                        className="flex h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-xs font-bold"
                      >
                        <option value="">-- اختر شركة النقل --</option>
                        {transportCompanies.map((c: any) => (
                          <option key={\`bus-comp-\${c.id}\`} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">تكلفة التذكرة (Cost) *</label>
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
                          onChange={e => setForm({ ...form, supplier_currency: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold text-emerald-900"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">طريقة سداد المورد *</label>
                        <select
                          required
                          value={form.supplier_payment_method}
                          onChange={e => setForm({ ...form, supplier_payment_method: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold"
                        >
                          {SUPPLIER_PAYMENT_METHODS.map(pm => (
                            <option key={pm.id} value={pm.id}>{pm.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">حالة السداد *</label>
                        <select
                          required
                          value={form.supplier_payment_status}
                          onChange={e => handleSupplierPaymentStatusChange(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold"
                        >
                          <option value="paid">مسدد بالكامل</option>
                          <option value="unpaid">غير مسدد</option>
                          <option value="partial">مسدد جزئياً</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">بيان القيد المحاسبي لشركة النقل</label>
                    <Input
                      placeholder="تكلفة تذكرة باص..."
                      value={form.supplier_statement}
                      onChange={e => setForm({ ...form, supplier_statement: e.target.value })}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* قسم أفقي 2: تفاصيل التذكرة والرحلة */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5 mt-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    بيانات التذكرة ومسار الرحلة
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">رقم التذكرة (Ticket No.) *</label>
                    <Input
                      required
                      value={form.ticket_number}
                      onChange={e => setForm({ ...form, ticket_number: e.target.value })}
                      placeholder="TKT-XXXXXX"
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">رقم البوليصة (PNR)</label>
                    <Input
                      value={form.pnr_number}
                      onChange={e => setForm({ ...form, pnr_number: e.target.value })}
                      placeholder="PNRXXXX"
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">مدينة الانطلاق *</label>
                    <Input
                      required
                      value={form.origin_city}
                      onChange={e => setForm({ ...form, origin_city: e.target.value })}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">مدينة الوصول *</label>
                    <Input
                      required
                      value={form.destination_city}
                      onChange={e => setForm({ ...form, destination_city: e.target.value })}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-emerald-900 mb-1 block">تاريخ المغادرة *</label>
                    <Input
                      required
                      type="date"
                      value={form.departure_date}
                      onChange={e => setForm({ ...form, departure_date: e.target.value })}
                      className="text-xs h-8 bg-white font-mono text-emerald-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">وقت المغادرة *</label>
                    <Input
                      required
                      type="time"
                      value={form.departure_time}
                      onChange={e => setForm({ ...form, departure_time: e.target.value })}
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

              <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-4 bg-slate-50/70 p-3 rounded-b-xl">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start">
                  {editingBooking ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(\`هل أنت متأكد من حذف الحجز نهائياً؟\`)) {
                          deleteMutation.mutate(editingBooking.id);
                          setModalOpen(false);
                        }
                      }}
                      className="font-bold text-xs gap-1.5 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف الحجز 🗑️
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

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs font-bold h-9">
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveBookingMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 shadow-md gap-1.5 h-9"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {saveBookingMutation.isPending ? "جاري الحفظ..." : editingBooking ? "حفظ التعديلات ✅" : "حفظ الحجز وتوثيق القيد ➕"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>`;

lines.splice(startIndex, endIndex - startIndex + 1, newModal);
fs.writeFileSync('artifacts/pos-system/src/pages/travel-bus-tickets.tsx', lines.join('\n'), 'utf-8');
console.log("Successfully replaced modal in travel-bus-tickets.tsx");

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Flame, Ban, ShieldCheck, ArrowRightLeft, Plus, Trash2, ArrowLeftRight, CheckCircle } from "lucide-react";
import { fmt } from "./api";

// ─── 1. Receipts & Refunds for Orders ───
export function OrderVouchersTab() {
  const { toast } = useToast();
  const [vouchers, setVouchers] = useState([
    { id: "VOU-110", type: "تحصيل", order_id: "ORD-9921", customer: "بشار الزمر", amount: 18500, date_created: "2026-07-20", payment_method: "نقدي" },
    { id: "VOU-111", type: "إرجاع", order_id: "ORD-9801", customer: "جميل العبسي", amount: 4500, date_created: "2026-07-20", payment_method: "شبكة" },
  ]);

  const [showDlg, setShowDlg] = useState(false);
  const [form, setForm] = useState({ type: "تحصيل", order_id: "", customer: "", amount: "", payment_method: "نقدي" });

  const handleAdd = () => {
    setVouchers(prev => [{
      id: `VOU-${Date.now().toString().slice(-3)}`,
      type: form.type,
      order_id: form.order_id,
      customer: form.customer,
      amount: Number(form.amount),
      date_created: new Date().toISOString().slice(0, 10),
      payment_method: form.payment_method
    }, ...prev]);
    toast({ title: `تم تسجيل سند ${form.type} لقيمة الطلبية بنجاح` });
    setShowDlg(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Coins className="text-emerald-500" /> سندات تحصيل وإرجاع قيمة الطلبيات</h2>
          <p className="text-xs text-muted-foreground">صرف وتحصيل سندات القبض والمرتجع فواتير مبيعات الصالات والتوصيل للعملاء</p>
        </div>
        <Button onClick={() => { setForm({ type: "تحصيل", order_id: "", customer: "", amount: "", payment_method: "نقدي" }); setShowDlg(true); }} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" /> إنشاء سند مالي جديد
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right p-3 font-semibold">رقم السند</th>
              <th className="text-right p-3 font-semibold">نوع السند</th>
              <th className="text-right p-3 font-semibold">رقم الطلبية</th>
              <th className="text-right p-3 font-semibold">الزبون / العميل</th>
              <th className="text-right p-3 font-semibold">المبلغ الإجمالي (ر.س)</th>
              <th className="text-right p-3 font-semibold">طريقة الصرف والقبض</th>
              <th className="text-right p-3 font-semibold">تاريخ السند</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {vouchers.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{item.id}</td>
                <td className="p-3">
                  {item.type === "تحصيل" ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold">سند تحصيل قبض</Badge>
                  ) : (
                    <Badge className="bg-rose-100 text-rose-800 border-rose-200 font-bold">سند إرجاع صرف</Badge>
                  )}
                </td>
                <td className="p-3 font-mono text-muted-foreground">{item.order_id}</td>
                <td className="p-3 font-semibold">{item.customer}</td>
                <td className="p-3 font-mono font-bold text-primary">{fmt(item.amount)}</td>
                <td className="p-3 text-muted-foreground">{item.payment_method}</td>
                <td className="p-3 font-mono">{item.date_created}</td>
                <td className="p-3 text-center">
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => toast({ title: "تم إلغاء السند المالي" })}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>إنشاء سند قبض/صرف طلبية</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">نوع السند المالي *</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="تحصيل">سند تحصيل قيمة طلبية (قبض)</SelectItem>
                  <SelectItem value="إرجاع">سند إرجاع قيمة طلبية (صرف)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">رقم طلبية المبيعات *</label>
              <Input value={form.order_id} onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))} placeholder="ORD-xxxx" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">اسم العميل / المستلم *</label>
              <Input value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} placeholder="الاسم الكامل" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">مبلغ السند المطلوب (ر.س) *</label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">طريقة السداد والقبض</label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي (Cash)</SelectItem>
                  <SelectItem value="شبكة">بطاقة بنكية / شبكة</SelectItem>
                  <SelectItem value="تحويل">تحويل مصرفي فوري</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter dir="rtl" className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={!form.order_id || !form.customer || !form.amount}>حفظ السند واعتماده</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 2. Kitchen Quantities Entry & Expired Items ───
export function KitchenQuantitiesTab() {
  const { toast } = useToast();
  const [kitchenItems, setKitchenItems] = useState([
    { id: 1, name: "صدور دجاج طازجة", kitchen: "المطبخ الساخن", qty: 45, unit: "كجم", status: "كافية", is_expired: false },
    { id: 2, name: "لحم عجل مفروم بلدي", kitchen: "المطبخ الساخن", qty: 2, unit: "كجم", status: "حرج وقليل جداً", is_expired: false },
    { id: 3, name: "صلصة كاتشب مجهزة", kitchen: "مطبخ تحضير المقبلات", qty: 0, unit: "لتر", status: "منتهي / نفذ", is_expired: true },
  ]);

  const [showDlg, setShowDlg] = useState(false);
  const [form, setForm] = useState({ name: "", kitchen: "المطبخ الساخن", qty: "", unit: "كجم" });

  const handleAdd = () => {
    setKitchenItems(prev => [...prev, {
      id: Date.now(),
      name: form.name,
      kitchen: form.kitchen,
      qty: Number(form.qty),
      unit: form.unit,
      status: Number(form.qty) > 10 ? "كافية" : "قليلة",
      is_expired: Number(form.qty) === 0
    }]);
    toast({ title: "تم تسجيل وتحديث كميات المطابخ بنجاح" });
    setShowDlg(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Flame className="text-orange-500 animate-pulse" /> كميات ومخزون المطابخ الفرعية</h2>
          <p className="text-xs text-muted-foreground">مراقبة وإدخال كميات الطهي اليومية، والإنذار التلقائي للأصناف المنتهية والنافذة</p>
        </div>
        <Button onClick={() => { setForm({ name: "", kitchen: "المطبخ الساخن", qty: "", unit: "كجم" }); setShowDlg(true); }} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="w-4 h-4" /> إدخال كمية مطبخ جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active stock list */}
        <Card className="border shadow-sm">
          <CardHeader><CardTitle className="text-sm font-bold">جرد الكميات الحالي بالمطبخ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {kitchenItems.filter(item => !item.is_expired).map((item) => (
              <div key={item.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border">
                <div>
                  <span className="text-sm font-bold">{item.name}</span>
                  <p className="text-[10px] text-muted-foreground">{item.kitchen}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-primary">{item.qty} {item.unit}</span>
                  <Badge className={item.qty < 5 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}>{item.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Expired / Finished items Alert list */}
        <Card className="border border-red-200 bg-red-50/10 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-bold text-red-700 flex items-center gap-2"><Ban className="w-4 h-4 text-red-600" /> الأصناف والكميات المنتهية والنافذة بالمطبخ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {kitchenItems.filter(item => item.is_expired).map((item) => (
              <div key={item.id} className="flex justify-between items-center p-2 rounded-lg bg-red-100/50 border border-red-200">
                <div>
                  <span className="text-sm font-bold text-red-900">{item.name}</span>
                  <p className="text-[10px] text-red-700 font-semibold">{item.kitchen}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="font-bold">نفذت بالكامل / مغلق للطلب</Badge>
                  <Button size="sm" onClick={() => {
                    setKitchenItems(prev => prev.map(p => p.id === item.id ? { ...p, qty: 50, is_expired: false, status: "كافية" } : p));
                    toast({ title: "تم تموين المطبخ بالكمية المدخلة" });
                  }} className="text-xs h-7 bg-red-600 hover:bg-red-700 text-white">تموين الآن</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>تحديث وإدخال كميات المطابخ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">اسم المادة الخام / الصنف *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: صدور دجاج طازجة" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">المطبخ المستهدف</label>
              <Select value={form.kitchen} onValueChange={v => setForm(f => ({ ...f, kitchen: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="المطبخ الساخن">المطبخ الساخن</SelectItem>
                  <SelectItem value="مطبخ تحضير المقبلات">مطبخ تحضير المقبلات</SelectItem>
                  <SelectItem value="مطبخ الحلويات والعصائر">مطبخ الحلويات والعصائر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">الكمية المدخلة *</label>
                <Input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} placeholder="0" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold">وحدة القياس</label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="كجم">كيلو جرام (كجم)</SelectItem>
                    <SelectItem value="لتر">لتر (Litre)</SelectItem>
                    <SelectItem value="حبة">حبة / قطعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={!form.name || !form.qty}>إقرار وتسجيل الكمية</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 3. Sales Items Control & Tools Insurance ───
export function SalesControlTab() {
  const { toast } = useToast();
  const [salesRules, setSalesRules] = useState([
    { id: 1, name: "شاورما دجاج سوبر كبير", limit_per_customer: 5, active: true, status: "مراقب ومعتمد" },
    { id: 2, name: "برجر دبل لحم بلدي ممتاز", limit_per_customer: 3, active: true, status: "مراقب ومعتمد" },
  ]);

  const [insurances, setInsurances] = useState([
    { id: "INS-401", customer: "جميل العبسي", tool: "حافظات أطعمة حديدية بوفيه سفري", amount: 15000, date_created: "2026-07-19", returned: false },
    { id: "INS-402", customer: "بشار الزمر", tool: "مجموعة ملاعق وصحون بوفيه خارجي", amount: 10000, date_created: "2026-07-20", returned: true },
  ]);

  const [showDlgIns, setShowDlgIns] = useState(false);
  const [formIns, setFormIns] = useState({ customer: "", tool: "", amount: "" });

  const handleAddInsurance = () => {
    setInsurances(prev => [{
      id: `INS-${Date.now().toString().slice(-3)}`,
      customer: formIns.customer,
      tool: formIns.tool,
      amount: Number(formIns.amount),
      date_created: new Date().toISOString().slice(0, 10),
      returned: false
    }, ...prev]);
    toast({ title: "تم تسجيل سند تأمين أدوات المطبخ بنجاح" });
    setShowDlgIns(false);
  };

  const handleReturnInsurance = (id: string) => {
    setInsurances(prev => prev.map(p => p.id === id ? { ...p, returned: true } : p));
    toast({ title: "تم تسوية وإرجاع مبلغ تأمين الأدوات للعميل بنجاح" });
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="text-blue-500" /> رقابة أصناف المبيعات وتأمين الأدوات للعملاء</h2>
          <p className="text-xs text-muted-foreground">مراقبة كميات الشراء القصوى للعميل للأصناف الخاصة، وتسجيل سندات تأمين وإرجاع حافظات البوفيه الخارجية للمطعم</p>
        </div>
        <Button onClick={() => { setFormIns({ customer: "", tool: "", amount: "" }); setShowDlgIns(true); }} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4" /> تسجيل سند تأمين عهدة
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales control */}
        <Card className="border shadow-sm">
          <CardHeader><CardTitle className="text-sm font-bold">رقابة أصناف المبيعات القصوى</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {salesRules.map((rule) => (
              <div key={rule.id} className="flex justify-between items-center p-3 rounded-lg border bg-slate-50 dark:bg-slate-900">
                <div>
                  <span className="text-sm font-bold">{rule.name}</span>
                  <p className="text-[10px] text-muted-foreground">الحد الأقصى للطلب الواحد: {rule.limit_per_customer} قطع</p>
                </div>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold">{rule.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tools guarantee insurance */}
        <Card className="border shadow-sm">
          <CardHeader><CardTitle className="text-sm font-bold">سجلات ضمان وتأمين أدوات البوفيه</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {insurances.map((ins) => (
              <div key={ins.id} className="p-3 rounded-lg border flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <div>
                  <div className="flex gap-2 items-center">
                    <span className="font-mono text-xs font-bold">{ins.id}</span>
                    <span className="text-sm font-bold">{ins.customer}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">الأداة: {ins.tool}</p>
                  <p className="text-xs font-mono font-bold text-primary mt-1">مبلغ التأمين: {fmt(ins.amount)} ر.س</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">{ins.date_created}</span>
                  {ins.returned ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">تم الإرجاع وتصفية السند</Badge>
                  ) : (
                    <Button size="sm" onClick={() => handleReturnInsurance(ins.id)} className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white">إرجاع وتصفية</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDlgIns} onOpenChange={setShowDlgIns}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل سند تأمين أدوات</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">اسم العميل بالكامل *</label>
              <Input value={formIns.customer} onChange={e => setFormIns(f => ({ ...f, customer: e.target.value }))} placeholder="الزبون الملتزم بالتأمين" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">بيانات أدوات البوفيه الخارجية المستعارة *</label>
              <Input value={formIns.tool} onChange={e => setFormIns(f => ({ ...f, tool: e.target.value }))} placeholder="مثال: حافظة طعام حديدية عدد 3" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">قيمة مبلغ التأمين النقدي المقبوض (ر.س) *</label>
              <Input type="number" value={formIns.amount} onChange={e => setFormIns(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlgIns(false)}>إلغاء</Button>
            <Button onClick={handleAddInsurance} disabled={!formIns.customer || !formIns.tool || !formIns.amount}>طباعة وحفظ السند</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 4. Posting & Unposting Sales Invoices ───
export function PostSalesTab() {
  const { toast } = useToast();
  const [invoicesToPost, setInvoicesToPost] = useState([
    { invoice: "INV-992110", date: "2026-07-20", cashier: "الكاشير عمر", total: 45000, posted: false },
    { invoice: "INV-992111", date: "2026-07-20", cashier: "الكاشير عمر", total: 28000, posted: false },
    { invoice: "INV-992109", date: "2026-07-19", cashier: "الكاشير أحمد", total: 62000, posted: true },
  ]);

  const handlePostAll = () => {
    setInvoicesToPost(prev => prev.map(inv => ({ ...inv, posted: true })));
    toast({ title: "تم ترحيل جميع فواتير مبيعات اليوم للحسابات والقيود اليومية" });
  };

  const handleUnpost = (invoiceNum: string) => {
    setInvoicesToPost(prev => prev.map(inv => inv.invoice === invoiceNum ? { ...inv, posted: false } : inv));
    toast({ title: "تم فتح ترحيل الفاتورة بنجاح لإعادة المراجعة والتعديل" });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><ArrowRightLeft className="text-orange-500" /> ترحيل وإلغاء ترحيل فواتير المبيعات</h2>
          <p className="text-xs text-muted-foreground">ترحيل فواتير المبيعات اليومية للحسابات العامة، أو فتح فواتير معينة لإعادة مراجعتها (Unpost)</p>
        </div>
        <Button onClick={handlePostAll} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold">
          <CheckCircle className="w-4 h-4" /> ترحيل مبيعات اليوم بالكامل
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right p-3 font-semibold">رقم الفاتورة</th>
              <th className="text-right p-3 font-semibold">تاريخ الفاتورة</th>
              <th className="text-right p-3 font-semibold">الكاشير المسؤول</th>
              <th className="text-right p-3 font-semibold">المجموع الإجمالي (ر.س)</th>
              <th className="text-right p-3 font-semibold">حالة الترحيل المالي</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoicesToPost.map((inv) => (
              <tr key={inv.invoice} className="hover:bg-muted/30">
                <td className="p-3 font-mono font-bold">{inv.invoice}</td>
                <td className="p-3 font-mono">{inv.date}</td>
                <td className="p-3 font-semibold text-muted-foreground">{inv.cashier}</td>
                <td className="p-3 font-mono font-bold text-primary">{fmt(inv.total)}</td>
                <td className="p-3">
                  {inv.posted ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">مرحل ومقفل محاسبياً</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">مسودة جاهزة للترحيل</Badge>
                  )}
                </td>
                <td className="p-3 text-center">
                  {inv.posted ? (
                    <Button size="sm" variant="outline" onClick={() => handleUnpost(inv.invoice)} className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50 font-bold" title="فتح الترحيل للتعديل">إلغاء الترحيل (Unpost)</Button>
                  ) : (
                    <Button size="sm" onClick={() => {
                      setInvoicesToPost(prev => prev.map(p => p.invoice === inv.invoice ? { ...p, posted: true } : p));
                      toast({ title: "تم ترحيل الفاتورة للدفتر العام" });
                    }} className="text-xs h-8 bg-orange-600 hover:bg-orange-700 text-white">ترحيل الآن</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

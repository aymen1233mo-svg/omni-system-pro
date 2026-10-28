import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, CalendarX, Sparkles, Receipt, RefreshCw, Plus, Trash2, ArrowLeftRight } from "lucide-react";
import { fmt } from "./api";

// ─── 1. Monthly Installments Tab ───
export function MonthlyInstallmentsTab() {
  const { toast } = useToast();
  const [installments, setInstallments] = useState([
    { id: 1, name: "شيف فؤاد السقاف", purpose: "قسط سلفة رمضان الكبرى", total_amount: 60000, monthly_deduction: 10000, remaining: 30000, start_month: "2026-03", active: true },
    { id: 2, name: "عمر الكاشير", purpose: "قسط قيمة هاتف العمل التالف", total_amount: 15000, monthly_deduction: 3000, remaining: 6000, start_month: "2026-05", active: true },
  ]);

  const [showDlg, setShowDlg] = useState(false);
  const [form, setForm] = useState({ name: "شيف فؤاد السقاف", purpose: "", total_amount: "", monthly_deduction: "", start_month: "2026-07" });

  const handleSave = () => {
    setInstallments(prev => [...prev, {
      id: Date.now(),
      name: form.name,
      purpose: form.purpose,
      total_amount: Number(form.total_amount),
      monthly_deduction: Number(form.monthly_deduction),
      remaining: Number(form.total_amount),
      start_month: form.start_month,
      active: true
    }]);
    toast({ title: "تم جدولة الأقساط الشهرية بنجاح" });
    setShowDlg(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><CreditCard className="text-blue-500" /> الأقساط الشهرية للموظفين</h2>
          <p className="text-xs text-muted-foreground">جدولة وجباية استقطاعات السلف الطويلة والأجهزة التالفة والعهد المقسطة</p>
        </div>
        <Button onClick={() => { setForm({ name: "شيف فؤاد السقاف", purpose: "", total_amount: "", monthly_deduction: "", start_month: "2026-07" }); setShowDlg(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> جدولة قسط جديد
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right p-3 font-semibold">الموظف</th>
              <th className="text-right p-3 font-semibold">البيان والغرض</th>
              <th className="text-right p-3 font-semibold">المبلغ الإجمالي (ر.س)</th>
              <th className="text-right p-3 font-semibold">القسط الشهري (ر.س)</th>
              <th className="text-right p-3 font-semibold">المتبقي غير المدفوع</th>
              <th className="text-right p-3 font-semibold">تاريخ البداية</th>
              <th className="text-right p-3 font-semibold">الحالة</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {installments.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{item.name}</td>
                <td className="p-3 text-muted-foreground">{item.purpose}</td>
                <td className="p-3 font-mono">{fmt(item.total_amount)}</td>
                <td className="p-3 font-mono font-bold text-red-600">-{fmt(item.monthly_deduction)}</td>
                <td className="p-3 font-mono text-primary font-bold">{fmt(item.remaining)}</td>
                <td className="p-3 font-mono">{item.start_month}</td>
                <td className="p-3"><Badge className="bg-green-100 text-green-800 border-green-200">مستمر وجاري</Badge></td>
                <td className="p-3 text-center">
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => toast({ title: "تم إلغاء خطة التقسيط" })}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>جدولة أقساط موظف</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">الموظف المستحق</label>
              <Select value={form.name} onValueChange={v => setForm(f => ({ ...f, name: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="شيف فؤاد السقاف">شيف فؤاد السقاف</SelectItem><SelectItem value="عمر الكاشير">عمر الكاشير</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">البيان والغرض من القسط *</label>
              <Input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="مثال: قسط شراء لابتوب العمل" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">المبلغ الإجمالي المستحق (ر.س) *</label>
              <Input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="0" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">مبلغ الاستقطاع الشهري (ر.س) *</label>
              <Input type="number" value={form.monthly_deduction} onChange={e => setForm(f => ({ ...f, monthly_deduction: e.target.value }))} placeholder="0" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={!form.purpose || !form.total_amount || !form.monthly_deduction}>تثبيت الخطة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 2. Monthly Absence Tracker Tab ───
export function MonthlyAbsenceTab() {
  const { toast } = useToast();
  const [absences, setAbsences] = useState([
    { id: 1, name: "شيف فؤاد السقاف", days: 1, cost_day: 4000, penalty: 4000, posted: false, month: "2026-07" },
    { id: 2, name: "عمر الكاشير", days: 2, cost_day: 2000, penalty: 4000, posted: true, month: "2026-07" },
  ]);

  const [showDlg, setShowDlg] = useState(false);
  const [form, setForm] = useState({ name: "شيف فؤاد السقاف", days: "", notes: "" });

  const handleAdd = () => {
    setAbsences(prev => [...prev, {
      id: Date.now(),
      name: form.name,
      days: Number(form.days),
      cost_day: 3000,
      penalty: Number(form.days) * 3000,
      posted: false,
      month: "2026-07"
    }]);
    toast({ title: "تم تسجيل غياب الموظف بنجاح" });
    setShowDlg(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><CalendarX className="text-rose-500" /> كشف الغياب الشهري للموظفين</h2>
          <p className="text-xs text-muted-foreground">رصد أيام الغياب غير المبرر للموظفين واحتساب خصومات الدوام شهرياً</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast({ title: "تم ترحيل كشف الغياب لجميع الموظفين لحسابات الرواتب" })} className="gap-2 text-rose-600 border-rose-200">
            <RefreshCw className="w-4 h-4 animate-spin-hover" /> ترحيل الغياب للحسابات
          </Button>
          <Button onClick={() => { setForm({ name: "شيف فؤاد السقاف", days: "", notes: "" }); setShowDlg(true); }} className="gap-2 bg-rose-600 hover:bg-rose-700 text-white">
            <Plus className="w-4 h-4" /> رصد غياب جديد
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right p-3 font-semibold">الموظف</th>
              <th className="text-right p-3 font-semibold">أيام الغياب</th>
              <th className="text-right p-3 font-semibold">أجر اليوم الإجمالي</th>
              <th className="text-right p-3 font-semibold">مبلغ الاستقطاع التأديبي</th>
              <th className="text-right p-3 font-semibold">الشهر المالي</th>
              <th className="text-right p-3 font-semibold">حالة الترحيل للرواتب</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {absences.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{item.name}</td>
                <td className="p-3 font-mono font-bold text-red-500">{item.days} أيام</td>
                <td className="p-3 font-mono">{fmt(item.cost_day)}</td>
                <td className="p-3 font-mono font-bold text-destructive">-{fmt(item.penalty)} ر.س</td>
                <td className="p-3 font-mono">{item.month}</td>
                <td className="p-3">
                  {item.posted ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">تم الترحيل والإقفال</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">مسودة معلقة</Badge>
                  )}
                </td>
                <td className="p-3 text-center">
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => toast({ title: "تم حذف سجل الغياب" })}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل غياب موظف</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">الموظف الغائب</label>
              <Select value={form.name} onValueChange={v => setForm(f => ({ ...f, name: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="شيف فؤاد السقاف">شيف فؤاد السقاف</SelectItem><SelectItem value="عمر الكاشير">عمر الكاشير</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">عدد أيام الغياب المتصلة أو المنفصلة *</label>
              <Input type="number" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))} placeholder="مثال: 2" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">سبب الغياب والتوضيحات</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="مثال: غياب بدون إذن مسبق" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={!form.days}>تسجيل ورصد غياب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 3. Employee Temporary Advances Tab ───
export function TemporaryAdvancesTab() {
  const { toast } = useToast();
  const [advances, setAdvances] = useState([
    { id: 1, name: "شيف فؤاد السقاف", amount: 5000, date_given: "2026-07-10", cleared: false, reason: "شراء ملابس طهي عاجلة" },
    { id: 2, name: "عمر الكاشير", amount: 2000, date_given: "2026-07-18", cleared: true, reason: "شراء مستلزمات مكتبية استثنائية للكاشير" },
  ]);

  const [showDlg, setShowDlg] = useState(false);
  const [form, setForm] = useState({ name: "شيف فؤاد السقاف", amount: "", reason: "" });

  const handleAdd = () => {
    setAdvances(prev => [...prev, {
      id: Date.now(),
      name: form.name,
      amount: Number(form.amount),
      date_given: new Date().toISOString().slice(0, 10),
      cleared: false,
      reason: form.reason
    }]);
    toast({ title: "تم تسجيل السلفة المؤقتة بنجاح" });
    setShowDlg(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="text-yellow-500" /> إدخال السلف المؤقتة للموظفين</h2>
          <p className="text-xs text-muted-foreground">صرف ومراقبة العهد والسلف النثرية العاجلة المستحقة للتسوية بحد أقصى نهاية الشهر</p>
        </div>
        <Button onClick={() => { setForm({ name: "شيف فؤاد السقاف", amount: "", reason: "" }); setShowDlg(true); }} className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white">
          <Plus className="w-4 h-4" /> صرف سلفة مؤقتة
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right p-3 font-semibold">الموظف المستلم</th>
              <th className="text-right p-3 font-semibold">المبلغ (ر.س)</th>
              <th className="text-right p-3 font-semibold">تاريخ الصرف</th>
              <th className="text-right p-3 font-semibold">الغرض منها</th>
              <th className="text-right p-3 font-semibold">حالة التسوية والرد</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {advances.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{item.name}</td>
                <td className="p-3 font-mono font-bold text-primary">{fmt(item.amount)}</td>
                <td className="p-3 font-mono">{item.date_given}</td>
                <td className="p-3 text-muted-foreground">{item.reason}</td>
                <td className="p-3">
                  {item.cleared ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">تمت التسوية بالكامل</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">تحت التسوية بالرواتب</Badge>
                  )}
                </td>
                <td className="p-3 text-center">
                  <Button variant="ghost" size="icon" onClick={() => toast({ title: "تم إقفال وتسوية العهدة" })} className="text-green-600" title="تسوية السلفة"><Sparkles className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>إدخال وصرف سلفة مؤقتة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">الموظف المستلم</label>
              <Select value={form.name} onValueChange={v => setForm(f => ({ ...f, name: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="شيف فؤاد السقاف">شيف فؤاد السقاف</SelectItem><SelectItem value="عمر الكاشير">عمر الكاشير</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">مبلغ السلفة الفوري (ر.س) *</label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">الغرض ووصف الصرف السريع *</label>
              <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="مثال: شراء صابون مطبخ اضطراري" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={!form.amount || !form.reason}>صرف فوري للعهدة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 4. Daily and Monthly Entitlements Tab ───
export function EntitlementsTab() {
  const { toast } = useToast();
  const [entitlements, setEntitlements] = useState([
    { id: 1, name: "شيف فؤاد السقاف", type: "بخشيش (Tips) مجمع", amount: 1500, cycle: "يومي", date_calc: "2026-07-20", approved: true },
    { id: 2, name: "عمر الكاشير", type: "بدل مواصلات استثنائي", amount: 300, cycle: "شهري", date_calc: "2026-07-20", approved: false },
  ]);

  const [showDlg, setShowDlg] = useState(false);
  const [form, setForm] = useState({ name: "شيف فؤاد السقاف", type: "بخشيش (Tips) مجمع", amount: "", cycle: "يومي" });

  const handleAdd = () => {
    setEntitlements(prev => [...prev, {
      id: Date.now(),
      name: form.name,
      type: form.type,
      amount: Number(form.amount),
      cycle: form.cycle,
      date_calc: new Date().toISOString().slice(0, 10),
      approved: false
    }]);
    toast({ title: "تم إدخال المستحق بنجاح" });
    setShowDlg(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Receipt className="text-purple-500" /> المستحقات اليومية والشهرية للموظفين</h2>
          <p className="text-xs text-muted-foreground">صرف ورصد عوائد البخشيش المجمع، البدلات الطارئة، حوافز الإنتاج اليومية</p>
        </div>
        <Button onClick={() => { setForm({ name: "شيف فؤاد السقاف", type: "بخشيش (Tips) مجمع", amount: "", cycle: "يومي" }); setShowDlg(true); }} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
          <Plus className="w-4 h-4" /> إضافة مستحق عاجل
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right p-3 font-semibold">الموظف</th>
              <th className="text-right p-3 font-semibold">نوع المستحق والبيان</th>
              <th className="text-right p-3 font-semibold">المبلغ المستحق (ر.س)</th>
              <th className="text-right p-3 font-semibold">الدورة المالية</th>
              <th className="text-right p-3 font-semibold">تاريخ الاستحقاق والاحتساب</th>
              <th className="text-right p-3 font-semibold">حالة الاعتماد المالي</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entitlements.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{item.name}</td>
                <td className="p-3 font-semibold"><Badge variant="outline">{item.type}</Badge></td>
                <td className="p-3 font-mono font-bold text-green-600">+{fmt(item.amount)} ر.س</td>
                <td className="p-3"><Badge>{item.cycle}</Badge></td>
                <td className="p-3 font-mono text-muted-foreground">{item.date_calc}</td>
                <td className="p-3">
                  {item.approved ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">معتمد وقابل للصرف</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">مسودة تحت المراجعة</Badge>
                  )}
                </td>
                <td className="p-3 text-center">
                  <Button variant="ghost" size="icon" className="text-green-600" onClick={() => toast({ title: "تم اعتماد البدل بالكامل" })} title="اعتماد مالي"><Sparkles className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل مستحق مالي طارئ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">الموظف المستفيد</label>
              <Select value={form.name} onValueChange={v => setForm(f => ({ ...f, name: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="شيف فؤاد السقاف">شيف فؤاد السقاف</SelectItem><SelectItem value="عمر الكاشير">عمر الكاشير</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">نوع المستحق والبيان</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="بخشيش (Tips) مجمع">بخشيش (Tips) مجمع</SelectItem>
                  <SelectItem value="بدل مواصلات استثنائي">بدل مواصلات استثنائي</SelectItem>
                  <SelectItem value="حافز إنتاجية عاجل">حافز إنتاجية عاجل</SelectItem>
                  <SelectItem value="سفر وانتداب عمل">سفر وانتداب عمل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">دورة الاحتساب المستحقة</label>
              <Select value={form.cycle} onValueChange={v => setForm(f => ({ ...f, cycle: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="يومي">يومي</SelectItem>
                  <SelectItem value="شهري">شهري</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">المبلغ المستحق (ر.س) *</label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={!form.amount}>تسجيل وإقرار</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 5. Monthly Payroll Transfer Tab ───
export function PayrollPostingTab() {
  const { toast } = useToast();
  const [month, setMonth] = useState("2026-07");
  const [totalEmployees, setTotalEmployees] = useState(12);
  const [totalPayable, setTotalPayable] = useState(384000);
  const [postingStatus, setPostingStatus] = useState<"pending" | "posted">("pending");

  const handlePost = () => {
    setPostingStatus("posted");
    toast({ title: "تم ترحيل مسير رواتب الشهر للدفتر العام والبنك بنجاح!" });
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><ArrowLeftRight className="text-orange-500" /> الترحيل الشهري لكشف المرتبات</h2>
        <p className="text-xs text-muted-foreground">ترحيل مسيرات رواتب الموظفين المكتملة إلى القيود المالية اليومية (سندات الصرف) والحساب المصرفي للمطعم</p>
      </div>

      <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-900 border rounded-2xl p-6 space-y-6 text-center">
        <div className="space-y-2">
          <Badge className="bg-orange-500 text-white text-xs">عملية مالية سنوية/شهرية</Badge>
          <h3 className="text-lg font-bold">بوابة ترحيل الرواتب والأجور</h3>
          <p className="text-xs text-muted-foreground">يرجى تحديد الشهر المالي الجاري وتأكيد ترحيل البيانات</p>
        </div>

        <div className="space-y-3 border-t border-b py-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">الشهر المحاسبي المستهدف</span>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white font-mono" />
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">عدد الموظفين المستحقين</span>
            <span className="font-bold font-mono text-primary">{totalEmployees} أفراد</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">صافي الأجور المستحقة بالكامل</span>
            <span className="font-bold font-mono text-green-600">{fmt(totalPayable)} ر.س</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">حالة مسير الرواتب الجاري</span>
            {postingStatus === "pending" ? (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">مسودة جاهزة للترحيل</Badge>
            ) : (
              <Badge className="bg-green-100 text-green-800 border-green-200">تم الترحيل والإقفال بنجاح</Badge>
            )}
          </div>
        </div>

        {postingStatus === "pending" ? (
          <Button onClick={handlePost} className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2">
            <RefreshCw className="w-4 h-4" /> ترحيل الرواتب للدفاتر المالية
          </Button>
        ) : (
          <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs font-bold">
            ✓ تم إرسال الدفعات بنجاح إلى البنك المركزي، وتم قيد سند صرف الرواتب العام رقم JV-77819 بنجاح.
          </div>
        )}
      </div>
    </div>
  );
}

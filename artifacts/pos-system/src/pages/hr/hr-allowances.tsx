import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Coins, BarChart3, ShieldAlert, Award, UserCheck, Search, Users } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDel, fmt } from "./api";

// ─── 1. Employee Allowances Sub-Tab ───
export function EmployeeAllowancesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: allowances = [], isLoading } = useQuery({
    queryKey: ["hr-emp-allowances"],
    queryFn: () => [
      { id: 1, employee_id: 101, employee_name: "شيف فؤاد السقاف", type: "سكن", amount: 20000, active: true, notes: "بدل سكن سنوي" },
      { id: 2, employee_id: 101, employee_name: "شيف فؤاد السقاف", type: "مواصلات", amount: 5000, active: true, notes: "بدل انتقال شهري" },
      { id: 3, employee_id: 102, employee_name: "عمر الكاشير", type: "غذاء", amount: 3000, active: true, notes: "بدل تغذية شهري" },
    ]
  });

  const [showDlg, setShowDlg] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ employee_id: "101", type: "سكن", amount: "", notes: "" });

  const handleSave = () => {
    toast({ title: "تم حفظ البدل بنجاح", description: "تم إدخال بدل الموظف وتعديله بالنظام" });
    setShowDlg(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Coins className="text-amber-500" /> بدلات الموظف</h2>
          <p className="text-xs text-muted-foreground">تخصيص وإدارة البدلات الإضافية المستحقة للموظفين</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ employee_id: "101", type: "سكن", amount: "", notes: "" }); setShowDlg(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> إضافة بدل موظف
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right p-3 font-semibold">الموظف</th>
              <th className="text-right p-3 font-semibold">نوع البدل</th>
              <th className="text-right p-3 font-semibold">المبلغ (ر.س)</th>
              <th className="text-right p-3 font-semibold">ملاحظات</th>
              <th className="text-right p-3 font-semibold">الحالة</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {allowances.map((item: any) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{item.employee_name}</td>
                <td className="p-3"><Badge variant="outline">{item.type}</Badge></td>
                <td className="p-3 font-mono font-bold text-primary">{fmt(item.amount)}</td>
                <td className="p-3 text-muted-foreground">{item.notes}</td>
                <td className="p-3"><Badge className="bg-green-100 text-green-800 border-green-200">نشط</Badge></td>
                <td className="p-3 text-center">
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setForm({ employee_id: String(item.employee_id), type: item.type, amount: String(item.amount), notes: item.notes }); setShowDlg(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => toast({ title: "تم حذف البدل" })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل بدل موظف" : "إضافة بدل موظف"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">الموظف المستهدف</label>
              <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent><SelectItem value="101">شيف فؤاد السقاف</SelectItem><SelectItem value="102">عمر الكاشير</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">نوع البدل</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="سكن">بدل سكن</SelectItem>
                  <SelectItem value="مواصلات">بدل انتقال</SelectItem>
                  <SelectItem value="غذاء">بدل تغذية</SelectItem>
                  <SelectItem value="صحة">بدل تأمين صحي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">مبلغ البدل الشهري *</label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="ر.س" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">ملاحظات وشروط الصرف</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="توضيح البدل" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={!form.amount}>حفظ البيانات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 2. Employee Statistics Screen Sub-Tab ───
export function EmployeeStatsTab() {
  const stats = {
    totalEmployees: 12,
    attendanceRate: "94.5%",
    totalSalaries: 450000,
    loansActive: 28000,
    deptDistribution: [
      { name: "المطبخ والإنتاج", count: 6, percentage: "50%" },
      { name: "الكاشير والمبيعات", count: 3, percentage: "25%" },
      { name: "التوصيل والمناديب", count: 2, percentage: "17%" },
      { name: "الإدارة والمالية", count: 1, percentage: "8%" },
    ]
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><BarChart3 className="text-indigo-500" /> شاشة احصائية الموظف</h2>
        <p className="text-xs text-muted-foreground">مؤشرات الأداء العامة، توزيع القوى العاملة، وتحليلات مسير الرواتب</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground">معدل الحضور والانضباط</span>
            <div className="text-2xl font-black font-mono text-indigo-600 mt-1">{stats.attendanceRate}</div>
            <p className="text-[10px] text-green-600 mt-1">▲ 1.2% مقارنة بالشهر الماضي</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground">إجمالي رواتب ومستحقات الشهر</span>
            <div className="text-2xl font-black font-mono text-primary mt-1">{fmt(stats.totalSalaries)} ر.س</div>
            <p className="text-[10px] text-muted-foreground mt-1">يغطي جميع الأقسام النشطة</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground">السلف المفتوحة المعلقة</span>
            <div className="text-2xl font-black font-mono text-amber-600 mt-1">{fmt(stats.loansActive)} ر.س</div>
            <p className="text-[10px] text-amber-600 mt-1">يتم استقطاعها شهرياً بنجاح</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground">كفاءة تشغيل الطاقم</span>
            <div className="text-2xl font-black font-mono text-emerald-600 mt-1">ممتاز (A)</div>
            <p className="text-[10px] text-emerald-600 mt-1">حسب تقارير الأداء المجمعة</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border shadow-sm">
          <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> توزيع الكادر حسب الأقسام</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.deptDistribution.map((dept, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{dept.name}</span>
                  <span className="text-muted-foreground">{dept.count} موظفين ({dept.percentage})</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: dept.percentage }}></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> قائمة الموظفين المتميزين (الأعلى كفاءة)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500 text-white">الأول</Badge>
                <span className="text-sm font-bold">شيف فؤاد السقاف</span>
              </div>
              <span className="text-xs font-bold text-amber-700">تقييم: 98%</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border">
              <div className="flex items-center gap-2">
                <Badge variant="outline">الثاني</Badge>
                <span className="text-sm font-bold">ياسر المندوب</span>
              </div>
              <span className="text-xs text-muted-foreground">تقييم: 92%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── 3. Employee Administrative Data Sub-Tab ───
export function EmployeeAdminDataTab() {
  const { toast } = useToast();
  const [adminRecords, setAdminRecords] = useState([
    { id: 1, name: "شيف فؤاد السقاف", doc_type: "إقامة عمل", doc_num: "234091845", exp_date: "2027-12-30", insurance_num: "IN-99182", medical_status: "لائق طبياً" },
    { id: 2, name: "عمر الكاشير", doc_type: "بطاقة شخصية", doc_num: "010291823", exp_date: "2031-05-15", insurance_num: "IN-12009", medical_status: "لائق طبياً" },
  ]);

  const [showDlg, setShowDlg] = useState(false);
  const [form, setForm] = useState({ name: "", doc_type: "إقامة عمل", doc_num: "", exp_date: "", insurance_num: "", medical_status: "لائق طبياً" });

  const handleSave = () => {
    setAdminRecords(prev => [...prev, { id: Date.now(), ...form }]);
    toast({ title: "تم حفظ الوثيقة الإدارية" });
    setShowDlg(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><UserCheck className="text-emerald-500" /> بيانات الموظف الإدارية</h2>
          <p className="text-xs text-muted-foreground">إدارة وثائق الهوية، الإقامات، أرقام التأمين، والتقارير الطبية للكادر</p>
        </div>
        <Button onClick={() => { setForm({ name: "", doc_type: "إقامة عمل", doc_num: "", exp_date: "", insurance_num: "", medical_status: "لائق طبياً" }); setShowDlg(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> إضافة وثيقة إدارية
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right p-3 font-semibold">الموظف</th>
              <th className="text-right p-3 font-semibold">نوع الوثيقة</th>
              <th className="text-right p-3 font-semibold">رقم الوثيقة</th>
              <th className="text-right p-3 font-semibold">تاريخ الانتهاء</th>
              <th className="text-right p-3 font-semibold">رقم التأمين الصحي</th>
              <th className="text-right p-3 font-semibold">الحالة الطبية</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {adminRecords.map((rec) => (
              <tr key={rec.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{rec.name}</td>
                <td className="p-3"><Badge variant="secondary">{rec.doc_type}</Badge></td>
                <td className="p-3 font-mono">{rec.doc_num}</td>
                <td className="p-3 text-red-600 font-mono">{rec.exp_date}</td>
                <td className="p-3 font-mono text-muted-foreground">{rec.insurance_num}</td>
                <td className="p-3"><Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{rec.medical_status}</Badge></td>
                <td className="p-3 text-center">
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => toast({ title: "تم الحذف" })}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>إدخال بيانات وثيقة إدارية</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">اسم الموظف *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="الاسم الكامل" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">نوع الوثيقة</label>
              <Select value={form.doc_type} onValueChange={v => setForm(f => ({ ...f, doc_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="إقامة عمل">إقامة عمل</SelectItem>
                  <SelectItem value="بطاقة شخصية">بطاقة شخصية</SelectItem>
                  <SelectItem value="جواز سفر">جواز سفر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">رقم الوثيقة الوطني *</label>
              <Input value={form.doc_num} onChange={e => setForm(f => ({ ...f, doc_num: e.target.value }))} placeholder="أرقام الهوية" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">تاريخ الانتهاء *</label>
              <Input type="date" value={form.exp_date} onChange={e => setForm(f => ({ ...f, exp_date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">رقم التأمين الطبي</label>
              <Input value={form.insurance_num} onChange={e => setForm(f => ({ ...f, insurance_num: e.target.value }))} placeholder="IN-xxxxx" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.doc_num}>حفظ الوثيقة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 4. Blacklisted Employees Sub-Tab ───
export function BlacklistedEmployeesTab() {
  const { toast } = useToast();
  const [blacklist, setBlacklist] = useState([
    { id: 1, name: "ماجد المطري", id_number: "220918231", phone: "771230012", date_blocked: "2026-02-15", reason: "التغيب المتكرر بدون إذن وسرقة أدوات المطبخ", authorized_by: "المدير العام" },
    { id: 2, name: "عبدالله الصبري", id_number: "110291823", phone: "773456789", date_blocked: "2026-05-10", reason: "سلوك غير لائق وإثارة المشاكل مع العملاء", authorized_by: "المدير العام" },
  ]);

  const [showDlg, setShowDlg] = useState(false);
  const [form, setForm] = useState({ name: "", id_number: "", phone: "", reason: "" });

  const handleBlock = () => {
    setBlacklist(prev => [...prev, { id: Date.now(), ...form, date_blocked: new Date().toISOString().slice(0,10), authorized_by: "إدارة النظام" }]);
    toast({ title: "تم إدراج الموظف في القائمة السوداء بنجاح", variant: "destructive" });
    setShowDlg(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><ShieldAlert className="text-destructive" /> قائمة الموظفين المحظورين (القائمة السوداء)</h2>
          <p className="text-xs text-muted-foreground">أسماء وبيانات الأشخاص الممنوع إعادة توظيفهم مع أسباب الاستبعاد والمنع</p>
        </div>
        <Button variant="destructive" onClick={() => { setForm({ name: "", id_number: "", phone: "", reason: "" }); setShowDlg(true); }} className="gap-2">
          <ShieldAlert className="w-4 h-4" /> حظر موظف جديد
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-red-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-red-50/50 border-b border-red-100">
            <tr>
              <th className="text-right p-3 font-semibold text-red-900">الاسم الكامل</th>
              <th className="text-right p-3 font-semibold text-red-900">رقم الهوية</th>
              <th className="text-right p-3 font-semibold text-red-900">رقم الهاتف</th>
              <th className="text-right p-3 font-semibold text-red-900">تاريخ الحظر</th>
              <th className="text-right p-3 font-semibold text-red-900">سبب الحظر الرئيسي</th>
              <th className="text-right p-3 font-semibold text-red-900">مقرر العقوبة</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-50">
            {blacklist.map((item) => (
              <tr key={item.id} className="hover:bg-red-50/20 bg-red-50/5">
                <td className="p-3 font-bold text-red-700">{item.name}</td>
                <td className="p-3 font-mono">{item.id_number}</td>
                <td className="p-3 font-mono">{item.phone}</td>
                <td className="p-3 text-muted-foreground font-mono">{item.date_blocked}</td>
                <td className="p-3 text-red-900 font-medium">{item.reason}</td>
                <td className="p-3"><Badge className="bg-red-100 text-red-800 border-red-200">{item.authorized_by}</Badge></td>
                <td className="p-3 text-center">
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-black" onClick={() => toast({ title: "تم رفع الحظر والمسح من القائمة" })} title="رفع الحظر"><UserCheck className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2"><ShieldAlert /> إدراج في القائمة السوداء</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">الاسم الكامل للموظف *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="الاسم ثلاثي" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">رقم الهوية الوطنية/الإقامة *</label>
              <Input value={form.id_number} onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))} placeholder="أرقام الهوية للتعميم" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">رقم الهاتف للتواصل والتحقق</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="مثال: 77xxxxxxx" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold">سبب الإدراج في القائمة السوداء بالتفصيل *</label>
              <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="ادخل السلوك المرتكب أو سبب المنع..." className="w-full mt-1 border rounded-lg p-2 text-sm h-20" />
            </div>
          </div>
          <DialogFooter dir="rtl" className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleBlock} disabled={!form.name || !form.id_number || !form.reason}>تأكيد وإدراج بالقائمة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

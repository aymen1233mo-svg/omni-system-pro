import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Folder, FolderOpen, ChevronRight, ChevronDown, FileText, Users, DollarSign,
  Building2, CalendarCheck, UtensilsCrossed, Plus, Pencil, Trash2, ShieldAlert,
  HardHat, StickyNote, Activity, FileSpreadsheet, ListTodo, Wallet, Clock,
  Coins, BarChart3, UserCheck, CreditCard, ArrowLeftRight, Flame, ShieldCheck
} from "lucide-react";
import { PayrollPrintButton } from "@/components/payroll-print";

// Import custom HR tabs
import { LoansTab } from "./hr/loans";
import { ToolsTab } from "./hr/tools";
import { LeavesTab } from "./hr/leaves";
import { CustodiesTab } from "./hr/custodies";
import { PenaltiesTab } from "./hr/penalties";
import { OvertimeTab } from "./hr/overtime";
import { TempEmployeesTab } from "./hr/temp-employees";
import { NotesTab } from "./hr/notes";
import { MonthlyClosureTab } from "./hr/monthly-closure";
import { ReportsTab } from "./hr/reports";

// Import new modular tabs corresponding to images
import { EmployeeAllowancesTab, EmployeeStatsTab, EmployeeAdminDataTab, BlacklistedEmployeesTab } from "./hr/hr-allowances";
import { MonthlyInstallmentsTab, MonthlyAbsenceTab, TemporaryAdvancesTab, EntitlementsTab, PayrollPostingTab } from "./hr/hr-installments";
import { HrCodingTab } from "./hr/hr-coding";
import { OrderVouchersTab, KitchenQuantitiesTab, SalesControlTab, PostSalesTab } from "./hr/hr-sales-kitchen";
import { SalesReportsTab } from "./hr/hr-sales-reports";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}

async function apiGet(url: string) {
  const r = await fetchAuth(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPost(url: string, body: any) {
  const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPut(url: string, body: any) {
  const r = await fetchAuth(url, { method: "PUT", body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiDel(url: string) {
  const r = await fetchAuth(url, { method: "DELETE" });
  if (!r.ok && r.status !== 204) throw new Error(await r.text());
}

function fmt(n?: number) { return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* ─── Departments Tab ─── */
function DepartmentsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: depts = [], isLoading } = useQuery({ queryKey: ["hr-depts"], queryFn: () => apiGet("/api/hr/departments") });
  const [showDlg, setShowDlg] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", budget: "" });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-depts"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => editing
      ? apiPut(`/api/hr/departments/${editing.id}`, { name: f.name, budget: Number(f.budget) })
      : apiPost("/api/hr/departments", { name: f.name, budget: Number(f.budget) }),
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: editing ? "تم التعديل" : "تمت الإضافة" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل في الحفظ", description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/departments/${id}`),
    onSuccess: invalidate,
    onError: (e: any) => toast({ variant: "destructive", title: "فشل في الحذف", description: e.message }),
  });

  const openAdd = () => { setEditing(null); setForm({ name: "", budget: "" }); setShowDlg(true); };
  const openEdit = (d: any) => { setEditing(d); setForm({ name: d.name, budget: String(d.budget) }); setShowDlg(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">أقسام الشركة</h2>
        <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />إضافة قسم</Button>
      </div>
      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">اسم القسم</th>
                <th className="text-right p-3 font-semibold">الميزانية</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((depts as any[]) || []).map((d: any) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{d.name}</td>
                  <td className="p-3 text-primary font-mono">{fmt(d.budget)}</td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف القسم؟") && delMut.mutate(d.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {((depts as any[]) || []).length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">لا توجد أقسام</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل قسم" : "إضافة قسم"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">اسم القسم *</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: المبيعات" className="mt-1" /></div>
            <div><label className="text-sm font-medium">الميزانية</label><Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="0" className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.name || saveMut.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Employees Tab ─── */
function EmployeesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: employees = [], isLoading } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });
  const { data: depts = [] } = useQuery({ queryKey: ["hr-depts"], queryFn: () => apiGet("/api/hr/departments") });
  const [showDlg, setShowDlg] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const emptyForm = { employee_number: "", name: "", phone: "", position: "", department_id: "", basic_salary: "", hire_date: "", active: true };
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-employees"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => {
      // Don't force department_id to Number here, let the server handle dynamic department creation
      const data = { 
        ...f, 
        department_id: (f.department_id && !isNaN(Number(f.department_id))) ? Number(f.department_id) : (f.department_id || null),
        basic_salary: Number(f.basic_salary) 
      };
      return editing ? apiPut(`/api/hr/employees/${editing.id}`, data) : apiPost("/api/hr/employees", data);
    },
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: editing ? "تم التعديل" : "تمت الإضافة" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل في الحفظ", description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/employees/${id}`),
    onSuccess: invalidate,
    onError: (e: any) => toast({ variant: "destructive", title: "فشل في الحذف", description: e.message }),
  });

  const getNextEmployeeNumber = () => {
    const nums = ((employees as any[]) || [])
      .map((e: any) => parseInt(String(e.employee_number || "").replace(/\D/g, ""), 10))
      .filter((n: number) => !isNaN(n) && n > 0);
    return String(nums.length > 0 ? Math.max(...nums) + 1 : 1);
  };

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm, employee_number: getNextEmployeeNumber() }); setShowDlg(true); };
  const openEdit = (e: any) => { setEditing(e); setForm({ employee_number: String(e.employee_number || "").replace(/\D/g, "") || String(e.id || 1), name: e.name, phone: e.phone ?? "", position: e.position ?? "", department_id: e.department_id ? String(e.department_id) : "", basic_salary: String(e.basic_salary), hire_date: e.hire_date ?? "", active: Boolean(e.active) }); setShowDlg(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">الموظفون</h2>
        <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />إضافة موظف</Button>
      </div>
      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">رقم الموظف</th>
                <th className="text-right p-3 font-semibold">الاسم</th>
                <th className="text-right p-3 font-semibold">المنصب</th>
                <th className="text-right p-3 font-semibold">القسم</th>
                <th className="text-right p-3 font-semibold">الراتب الأساسي</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((employees as any[]) || []).map((e: any) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{e.employee_number}</td>
                  <td className="p-3 font-medium">{e.name}</td>
                  <td className="p-3 text-muted-foreground">{e.position ?? "—"}</td>
                  <td className="p-3">{e.department_name ?? "—"}</td>
                  <td className="p-3 text-primary font-mono">{fmt(e.basic_salary)}</td>
                  <td className="p-3"><Badge variant={e.active ? "default" : "secondary"}>{e.active ? "نشط" : "غير نشط"}</Badge></td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm(`حذف الموظف "${e.name}"؟`) && delMut.mutate(e.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {((employees as any[]) || []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا يوجد موظفون</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل موظف" : "إضافة موظف"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">رقم الموظف</label><Input type="number" min="1" step="1" value={form.employee_number} onChange={e => setForm(f => ({ ...f, employee_number: e.target.value.replace(/\D/g, "") }))} placeholder={editing ? "" : "يُنشأ تلقائياً (1, 2, 3...)"} className="mt-1 font-mono" /></div>
            <div><label className="text-sm font-medium">الاسم *</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم الموظف" className="mt-1" /></div>
            <div><label className="text-sm font-medium">رقم الهاتف</label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05xxxxxxxx" className="mt-1" /></div>
            <div><label className="text-sm font-medium">المنصب الوظيفي</label><Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="مثال: محاسب" className="mt-1" /></div>
            <div>
              <label className="text-sm font-medium">القسم</label>
              {!depts.some((d:any) => String(d.id) === form.department_id) && form.department_id !== "" ? (
                <div className="flex gap-2 mt-1">
                  <Input value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} placeholder="اسم القسم الجديد" autoFocus />
                  <Button variant="ghost" size="icon" onClick={() => setForm(f => ({...f, department_id: ""}))}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              ) : (
                <Select value={form.department_id} onValueChange={v => {
                  if (v === "new") {
                    setForm(f => ({ ...f, department_id: "قسم جديد..." }));
                  } else {
                    setForm(f => ({ ...f, department_id: v }));
                  }
                }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                  <SelectContent>
                    {((depts as any[]) || []).map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                    <SelectItem value="new" className="text-primary font-bold">➕ إضافة قسم جديد يدوياً</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div><label className="text-sm font-medium">الراتب الأساسي</label><Input type="number" value={form.basic_salary} onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))} placeholder="0" className="mt-1" /></div>
            <div><label className="text-sm font-medium">تاريخ التعيين</label><Input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className="mt-1" /></div>
            <div className="flex items-center gap-3 mt-6">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} id="emp-active" className="w-4 h-4" />
              <label htmlFor="emp-active" className="text-sm font-medium">موظف نشط</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.name || saveMut.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Salaries Tab ─── */
function SalariesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const { data: salaries = [], isLoading } = useQuery({ queryKey: ["hr-salaries", filterMonth], queryFn: () => apiGet(`/api/hr/salaries?month=${filterMonth}`) });
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });
  const [showDlg, setShowDlg] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const emptyForm = { employee_id: "", month: currentMonth, basic_salary: "", bonuses: "0", deductions: "0", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-salaries"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => {
      const data = { ...f, employee_id: Number(f.employee_id), basic_salary: Number(f.basic_salary), bonuses: Number(f.bonuses), deductions: Number(f.deductions) };
      return editing ? apiPut(`/api/hr/salaries/${editing.id}`, { ...data, status: editing.status }) : apiPost("/api/hr/salaries", data);
    },
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: "تم الحفظ" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل في الحفظ", description: e.message }),
  });

  const payMut = useMutation({
    mutationFn: (s: any) => apiPut(`/api/hr/salaries/${s.id}`, { ...s, status: "paid", payment_date: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => { invalidate(); toast({ title: "تم صرف الراتب" }); },
    onError: () => toast({ variant: "destructive", title: "فشل في الصرف" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/salaries/${id}`),
    onSuccess: invalidate,
    onError: () => toast({ variant: "destructive", title: "فشل في الحذف" }),
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowDlg(true); };
  const openEdit = (s: any) => { setEditing(s); setForm({ employee_id: String(s.employee_id), month: s.month, basic_salary: String(s.basic_salary), bonuses: String(s.bonuses), deductions: String(s.deductions), notes: s.notes ?? "" }); setShowDlg(true); };

  const totalNet = ((salaries as any[]) || []).reduce((sum: number, s: any) => sum + s.net_salary, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">الرواتب المسجلة والمصروفة</h2>
          <p className="text-sm text-muted-foreground">إجمالي صرف هذا الشهر: <span className="font-bold text-primary font-mono">{fmt(totalNet)}</span></p>
        </div>
        <div className="flex gap-2">
          <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-40" />
          <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />إضافة سجل راتب</Button>
        </div>
      </div>
      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">الموظف</th>
                <th className="text-right p-3 font-semibold">الشهر</th>
                <th className="text-right p-3 font-semibold">الأساسي</th>
                <th className="text-right p-3 font-semibold">البدلات</th>
                <th className="text-right p-3 font-semibold">الخصومات</th>
                <th className="text-right p-3 font-semibold">الصافي</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
                <th className="p-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((salaries as any[]) || []).map((s: any) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{s.employee_name}</td>
                  <td className="p-3 text-muted-foreground">{s.month}</td>
                  <td className="p-3 font-mono">{fmt(s.basic_salary)}</td>
                  <td className="p-3 font-mono text-green-600">+{fmt(s.bonuses)}</td>
                  <td className="p-3 font-mono text-red-600">-{fmt(s.deductions)}</td>
                  <td className="p-3 font-mono font-bold text-primary">{fmt(s.net_salary)}</td>
                  <td className="p-3"><Badge variant={s.status === "paid" ? "default" : "secondary"}>{s.status === "paid" ? "مصروف" : "معلق"}</Badge></td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end flex-wrap">
                      {s.status !== "paid" && <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => payMut.mutate(s)}>صرف</Button>}
                      <PayrollPrintButton employeeId={s.employee_id} month={s.month} employeeName={s.employee_name} />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف السجل؟") && delMut.mutate(s.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {((salaries as any[]) || []).length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد رواتب لهذا الشهر</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل راتب" : "إضافة راتب"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">الموظف *</label>
              <Select value={form.employee_id} onValueChange={v => { const emp = (employees as any[]).find((e: any) => e.id === Number(v)); setForm(f => ({ ...f, employee_id: v, basic_salary: emp ? String(emp.basic_salary) : f.basic_salary })); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{((employees as any[]) || []).filter((e: any) => e.active).map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">الشهر *</label><Input type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-sm font-medium">الراتب الأساسي</label><Input type="number" value={form.basic_salary} onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))} className="mt-1" /></div>
              <div><label className="text-sm font-medium">البدلات</label><Input type="number" value={form.bonuses} onChange={e => setForm(f => ({ ...f, bonuses: e.target.value }))} className="mt-1" /></div>
              <div><label className="text-sm font-medium">الخصومات</label><Input type="number" value={form.deductions} onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <span className="text-sm text-muted-foreground">صافي الراتب: </span>
              <span className="font-bold text-lg text-primary">{fmt(Number(form.basic_salary || 0) + Number(form.bonuses || 0) - Number(form.deductions || 0))}</span>
            </div>
            <div><label className="text-sm font-medium">ملاحظات</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات اختيارية" className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.employee_id || !form.month || saveMut.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Attendance Tab ─── */
function AttendanceTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [filterDate, setFilterDate] = useState(today);
  const { data: attendance = [], isLoading } = useQuery({ queryKey: ["hr-attendance", filterDate], queryFn: () => apiGet(`/api/hr/attendance?date=${filterDate}`) });
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });
  const [showDlg, setShowDlg] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const emptyForm = { employee_id: "", date: today, check_in: "", check_out: "", status: "present", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-attendance"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => {
      const data = { ...f, employee_id: Number(f.employee_id) };
      return editing ? apiPut(`/api/hr/attendance/${editing.id}`, data) : apiPost("/api/hr/attendance", data);
    },
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: "تم التسجيل" }); },
    onError: () => toast({ variant: "destructive", title: "فشل في التسجيل" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/attendance/${id}`),
    onSuccess: invalidate,
    onError: () => toast({ variant: "destructive", title: "فشل في الحذف" }),
  });

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm, date: filterDate }); setShowDlg(true); };
  const openEdit = (a: any) => { setEditing(a); setForm({ employee_id: String(a.employee_id), date: a.date, check_in: a.check_in ?? "", check_out: a.check_out ?? "", status: a.status, notes: a.notes ?? "" }); setShowDlg(true); };

  const statusLabel: Record<string, string> = { present: "حاضر", absent: "غائب", late: "متأخر", leave: "إجازة" };
  const statusVariant: Record<string, any> = { present: "default", absent: "destructive", late: "secondary", leave: "outline" };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg font-semibold">سجل الحضور والانصراف اليومي</h2>
        <div className="flex gap-2">
          <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-40" />
          <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />تسجيل حضور</Button>
        </div>
      </div>
      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">الموظف</th>
                <th className="text-right p-3 font-semibold">التاريخ</th>
                <th className="text-right p-3 font-semibold">وقت الحضور</th>
                <th className="text-right p-3 font-semibold">وقت الانصراف</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
                <th className="text-right p-3 font-semibold">ملاحظات</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((attendance as any[]) || []).map((a: any) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{a.employee_name}</td>
                  <td className="p-3 text-muted-foreground">{a.date}</td>
                  <td className="p-3 font-mono">{a.check_in ?? "—"}</td>
                  <td className="p-3 font-mono">{a.check_out ?? "—"}</td>
                  <td className="p-3"><Badge variant={statusVariant[a.status]}>{statusLabel[a.status] ?? a.status}</Badge></td>
                  <td className="p-3 text-muted-foreground text-xs">{a.notes ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف السجل؟") && delMut.mutate(a.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {((attendance as any[]) || []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد سجلات حضور لهذا اليوم</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل سجل الحضور" : "تسجيل حضور"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">الموظف *</label>
              <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{((employees as any[]) || []).filter((e: any) => e.active).map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">التاريخ *</label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">وقت الحضور</label><Input type="time" value={form.check_in} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} className="mt-1" /></div>
              <div><label className="text-sm font-medium">وقت الانصراف</label><Input type="time" value={form.check_out} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))} className="mt-1" /></div>
            </div>
            <div>
              <label className="text-sm font-medium">الحالة</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">حاضر</SelectItem>
                  <SelectItem value="absent">غائب</SelectItem>
                  <SelectItem value="late">متأخر</SelectItem>
                  <SelectItem value="leave">إجازة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">ملاحظات</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="اختيارية" className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.employee_id || !form.date || saveMut.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── تبويب خصم وجبات الموظفين ─── */
function MealDeductionsTab() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterEmp, setFilterEmp] = useState("");
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });
  const { data: deductions = [], isLoading } = useQuery({
    queryKey: ["hr-meal-deductions", filterMonth, filterEmp],
    queryFn: () => {
      const params = new URLSearchParams({ month: filterMonth });
      if (filterEmp) params.set("employee_id", filterEmp);
      return apiGet(`/api/hr/meal-deductions?${params}`);
    },
  });

  const totalDeductions = ((deductions as any[]) || []).reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-600" />سجل خصومات وجبات الموظفين
          </h2>
          <p className="text-sm text-muted-foreground">
            إجمالي الخصومات للمطالبة بها: <span className="font-bold text-destructive font-mono">{fmt(totalDeductions)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-44"><SelectValue placeholder="كل الموظفين" /></SelectTrigger>
            <SelectContent>
              <SelectItem value=" ">كل الموظفين</SelectItem>
              {((employees as any[]) || []).filter((e: any) => e.active).map((e: any) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-40" />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">الموظف</th>
                <th className="text-right p-3 font-semibold">رقم الموظف</th>
                <th className="text-right p-3 font-semibold">الكاشير</th>
                <th className="text-right p-3 font-semibold">التاريخ</th>
                <th className="text-right p-3 font-semibold">رقم الفاتورة</th>
                <th className="text-right p-3 font-semibold">ملاحظات</th>
                <th className="text-right p-3 font-semibold">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((deductions as any[]) || []).map((d: any) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{d.employee_name}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{d.employee_number}</td>
                  <td className="p-3 text-muted-foreground">{d.cashier_name}</td>
                  <td className="p-3 text-muted-foreground">{new Date(d.created_at).toLocaleDateString("ar-SA")}</td>
                  <td className="p-3 font-mono text-xs">{d.invoice_number ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{d.notes ?? "—"}</td>
                  <td className="p-3 font-mono font-bold text-destructive">{fmt(d.amount)}</td>
                </tr>
              ))}
              {((deductions as any[]) || []).length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد خصومات وجبات لهذا الشهر</td></tr>
              )}
            </tbody>
            {((deductions as any[]) || []).length > 0 && (
              <tfoot className="border-t border-border bg-muted/30">
                <tr>
                  <td colSpan={6} className="p-3 font-bold text-right">الإجمالي</td>
                  <td className="p-3 font-bold text-destructive font-mono">
                    {fmt(totalDeductions)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Main HR Page ─── */
interface TreeItem {
  id: string;
  label: string;
  icon?: any;
  children?: TreeItem[];
}

export default function HR() {
  const [location] = useLocation();
  const { data: summary } = useQuery({ queryKey: ["hr-summary"], queryFn: () => apiGet("/api/hr/summary") });
  
  const [activeView, setActiveView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("view") || params.get("tab") || "employees";
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("view") || params.get("tab");
      if (v) {
        setActiveView(v);
      }
    };
    handleUrlChange();
    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, [location]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["sys_hr", "ops", "docs", "entitlements", "reports", "coding_sys", "sales_ops_sys", "reports_center"]));

  const toggleFolder = (folderId: string) => {
    const next = new Set(expandedFolders);
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    setExpandedFolders(next);
  };

  // Main navigation tree matching all items from the requested legacy system images
  const tree: TreeItem[] = [
    {
      id: "sys_hr",
      label: "شؤون الموظفين والعمليات",
      children: [
        { id: "employees", label: "بيانات الموظفين الأساسية", icon: Users },
        { id: "allowances_emp", label: "بدلات الموظف الإضافية", icon: Coins },
        { id: "emp_stats", label: "شاشة احصائية الموظفين", icon: BarChart3 },
        { id: "admin_data", label: "بيانات الموظف الإدارية", icon: UserCheck },
        { id: "blacklist", label: "قائمة الموظفين السوداء", icon: ShieldAlert },
        { id: "monthly_absence", label: "الغياب الشهري والدوام", icon: CalendarCheck },
        { id: "installments", label: "الأقساط الشهرية للموظفين", icon: CreditCard },
        { id: "loans", label: "سلف الموظفين", icon: Wallet },
        { id: "temp_loans", label: "إدخال السلف المؤقتة للموظفين", icon: Coins },
        { id: "payroll_posting", label: "الترحيل الشهري لكشف المرتبات", icon: ArrowLeftRight },
        { id: "monthly_closure", label: "شاشة الإغلاق الشهري", icon: FileSpreadsheet },
        { id: "notes", label: "شاشة ملاحظات الأقسام", icon: StickyNote },
        { id: "tools", label: "مستودع وبيانات الأدوات", icon: HardHat },
        { id: "entitlements", label: "المستحقات اليومية والشهرية", icon: FileText },
        { id: "leaves", label: "طلب وإقرار الإجازات", icon: Clock },
        { id: "custodies", label: "العهد وممتلكات العمل", icon: Activity },
        { id: "meals", label: "خصومات وجبات الموظفين", icon: UtensilsCrossed },
        { id: "temp_employees", label: "الموظفون المؤقتون والمستقلون", icon: HardHat },
      ]
    },
    {
      id: "coding_sys",
      label: "قائمة التكويد والتهيئة",
      children: [
        { id: "hr_coding", label: "تهيئة جداول تكويد النظام", icon: ListTodo },
        { id: "departments", label: "بيانات الإدارات والأقسام", icon: Building2 },
      ]
    },
    {
      id: "sales_ops_sys",
      label: "عمليات المبيعات والمطابخ",
      children: [
        { id: "order_vouchers", label: "سندات تحصيل وإرجاع الطلبيات", icon: Coins },
        { id: "kitchen_qty", label: "إدخال وكميات المطابخ", icon: Flame },
        { id: "sales_control", label: "رقابة المبيعات وتأمين الأدوات", icon: ShieldCheck },
        { id: "post_sales", label: "ترحيل وإلغاء ترحيل الفواتير", icon: ArrowLeftRight },
      ]
    },
    {
      id: "reports_center",
      label: "مركز التقارير والمطبوعات",
      children: [
        { id: "sales_reports", label: "تقارير مبيعات ورقابة ومطابخ", icon: FileText },
        { id: "reports_tab", label: "مركز تقارير شؤون الموظفين", icon: FileText },
      ]
    }
  ];

  const renderActiveView = () => {
    switch (activeView) {
      case "employees": return <EmployeesTab />;
      case "departments": return <DepartmentsTab />;
      case "salaries": return <SalariesTab />;
      case "attendance": return <AttendanceTab />;
      case "meals": return <MealDeductionsTab />;
      case "temp_employees": return <TempEmployeesTab />;
      case "loans": return <LoansTab />;
      case "leaves": return <LeavesTab />;
      case "custodies": return <CustodiesTab />;
      case "overtime": return <OvertimeTab />;
      case "penalties": return <PenaltiesTab />;
      case "tools": return <ToolsTab />;
      case "notes": return <NotesTab />;
      case "monthly_closure": return <MonthlyClosureTab />;
      case "reports_tab": return <ReportsTab initialTab="employee_statement" />;
      case "hr_reports_statement": return <ReportsTab initialTab="employee_statement" />;
      case "hr_reports_custody": return <ReportsTab initialTab="custody_statement" />;
      case "hr_reports_tools": return <ReportsTab initialTab="tools_movement" />;
      case "hr_reports_leaves": return <ReportsTab initialTab="leaves_report" />;
      case "hr_reports_penalties": return <ReportsTab initialTab="penalties_report" />;
      case "hr_reports_notes": return <ReportsTab initialTab="notes_report" />;
      
      // New Image mapping tabs
      case "allowances_emp": return <EmployeeAllowancesTab />;
      case "emp_stats": return <EmployeeStatsTab />;
      case "admin_data": return <EmployeeAdminDataTab />;
      case "blacklist": return <BlacklistedEmployeesTab />;
      case "monthly_absence": return <MonthlyAbsenceTab />;
      case "installments": return <MonthlyInstallmentsTab />;
      case "temp_loans": return <TemporaryAdvancesTab />;
      case "payroll_posting": return <PayrollPostingTab />;
      case "entitlements": return <EntitlementsTab />;
      case "hr_coding": return <HrCodingTab initialCategory="jobs" />;
      case "hr_coding_jobs": return <HrCodingTab initialCategory="jobs" />;
      case "hr_coding_allowances": return <HrCodingTab initialCategory="allowances" />;
      case "hr_coding_leaves": return <HrCodingTab initialCategory="leaves" />;
      case "hr_coding_penalties": return <HrCodingTab initialCategory="penalties" />;
      case "hr_coding_nationalities": return <HrCodingTab initialCategory="nationalities" />;
      case "hr_coding_shifts": return <HrCodingTab initialCategory="shifts" />;
      case "hr_coding_overtime": return <HrCodingTab initialCategory="overtime" />;
      case "hr_coding_years": return <HrCodingTab initialCategory="years" />;
      case "hr_coding_qualifications": return <HrCodingTab initialCategory="qualifications" />;
      case "hr_coding_experiences": return <HrCodingTab initialCategory="experiences" />;
      case "hr_coding_custody_cats": return <HrCodingTab initialCategory="custody_cats" />;
      case "hr_coding_tool_cats": return <HrCodingTab initialCategory="tool_cats" />;
      case "hr_coding_tool_exits": return <HrCodingTab initialCategory="tool_exits" />;
      case "order_vouchers": return <OrderVouchersTab />;
      case "kitchen_qty": return <KitchenQuantitiesTab />;
      case "sales_control": return <SalesControlTab />;
      case "post_sales": return <PostSalesTab />;
      case "sales_reports": return <SalesReportsTab initialReport="general_sales" />;
      case "sales_reports_general": return <SalesReportsTab initialReport="general_sales" />;
      case "sales_reports_cashier": return <SalesReportsTab initialReport="cashier_sales" />;
      case "sales_reports_control": return <SalesReportsTab initialReport="control_sales" />;
      case "sales_reports_returns": return <SalesReportsTab initialReport="returns_sales" />;
      case "sales_reports_menu": return <SalesReportsTab initialReport="print_menu" />;
      case "sales_reports_delegates": return <SalesReportsTab initialReport="delegates_orders" />;
      case "sales_reports_reservations": return <SalesReportsTab initialReport="reservations" />;
      case "sales_reports_insurance": return <SalesReportsTab initialReport="tools_insurance" />;
      case "sales_reports_delivery": return <SalesReportsTab initialReport="delivery_sales" />;
      
      default: return <EmployeesTab />;
    }
  };

  const renderTree = (items: TreeItem[], depth = 0) => {
    return (
      <ul className="space-y-1">
        {items.map((item) => {
          const isFolder = !!item.children;
          const isExpanded = expandedFolders.has(item.id);
          const isActive = activeView === item.id;
          const Icon = item.icon || FileText;

          return (
            <li key={item.id} className="text-sm">
              {isFolder ? (
                <div>
                  <button
                    onClick={() => toggleFolder(item.id)}
                    className="w-full flex items-center justify-between p-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold dark:text-slate-300 dark:hover:bg-slate-800 transition text-right"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <FolderOpen className="w-4 h-4 text-amber-500 fill-amber-500/20" /> : <Folder className="w-4 h-4 text-amber-500 fill-amber-500/10" />}
                      <span>{item.label}</span>
                    </div>
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-50" /> : <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                  </button>
                  {isExpanded && (
                    <div className="mr-4 pr-3 border-r border-dashed border-slate-200 dark:border-slate-700 mt-1 space-y-1">
                      {renderTree(item.children!, depth + 1)}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-right transition ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-primary-foreground" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header Title with Subtitle */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" /> نظام شؤون الموظفين المتكامل (ERP)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">تتبع الحضور والإنتاجية والأدوات والمخالفات والرواتب في نظام موحد ومبسط</p>
          </div>
          <p className="text-sm text-muted-foreground font-mono bg-muted px-3 py-1.5 rounded-lg border">
            {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Dashboard quick statistic numbers cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2"><Users className="w-4 h-4 text-primary" />الموظفون النشطون</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black font-mono">{(summary as any)?.totalEmployees ?? 0} <span className="text-sm font-normal text-muted-foreground">فرد</span></div></CardContent>
          </Card>
          <Card className="shadow-sm border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />أقسام المؤسسة</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black font-mono">{(summary as any)?.totalDepts ?? 0} <span className="text-sm font-normal text-muted-foreground">قسم</span></div></CardContent>
          </Card>
          <Card className="shadow-sm border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" />مستحقات رواتب الشهر</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black font-mono text-green-600">{(summary as any)?.currentMonthSalaries?.toLocaleString("ar-SA", { maximumFractionDigits: 0 }) ?? 0} <span className="text-sm font-normal text-muted-foreground">ر.س</span></div></CardContent>
          </Card>
          <Card className="shadow-sm border border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-blue-500" />الحضور اليومي</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-black font-mono text-blue-600">{(summary as any)?.todayPresent ?? 0} <span className="text-sm font-normal text-muted-foreground">حاضر</span></div></CardContent>
          </Card>
        </div>

        {/* Main Content Area mapped to selected view from sidebar dropdown */}
        <Card className="shadow-md border border-slate-200 dark:border-slate-800 p-6 min-h-[500px] w-full">
          {renderActiveView()}
        </Card>
      </div>
    </AdminLayout>
  );
}

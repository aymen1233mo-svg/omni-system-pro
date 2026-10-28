import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  Wallet,
  Receipt,
  FileText,
  DollarSign,
  Printer,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Eye,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

const fmt = (num: number) => (num || 0).toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function TravelSuppliersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Modals & Sheets
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [openStatementSheet, setOpenStatementSheet] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);

  // Full-Screen Report Viewer
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportTitle, setReportTitle] = useState("");

  // Forms
  const [form, setForm] = useState({
    name: "",
    supplier_type: "شركة طيران",
    contact_person: "",
    phone: "",
    email: "",
    country: "السعودية",
    currency: "ريال",
    bank_details: "",
    notes: ""
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 1000,
    voucher_date: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    notes: "سداد دفعة حساب للمورد"
  });

  // Queries
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["/api/travel/suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/travel/suppliers");
      return res.json();
    }
  });

  const { data: statementData, refetch: refetchStatement } = useQuery({
    queryKey: ["/api/travel/suppliers", selectedSupplier?.id, "statement"],
    queryFn: async () => {
      if (!selectedSupplier?.id) return null;
      const res = await fetch(`/api/travel/suppliers/${selectedSupplier.id}/statement`);
      return res.json();
    },
    enabled: !!selectedSupplier?.id
  });

  // Mutations
  const createSupplierMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل تسجيل المورد");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/suppliers"] });
      toast({ title: "نجاح", description: "تم تسجيل المورد/الوكيل بنجاح ✅" });
      setOpenAddModal(false);
    }
  });

  const paySupplierMutation = useMutation({
    mutationFn: async ({ suppId, payload }: { suppId: number; payload: any }) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch(`/api/travel/suppliers/${suppId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل إضافة سند الصرف");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/suppliers"] });
      refetchStatement();
      toast({ title: "تم الصرف", description: "تم إنشاء سند الصرف وترحيل القيد المحاسبي بنجاح ✅" });
      setOpenPaymentModal(false);
    }
  });

  const filtered = suppliers.filter((s: any) => {
    const matchType = filterType === "all" || s.supplier_type === filterType;
    const matchSearch =
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.supplier_code?.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_person?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  // Print Statement Report Preview
  const handlePreviewStatement = (supp: any) => {
    const suppName = supp.name || "المورد";
    const balance = supp.current_balance || 0;
    const payments = statementData?.payments || [];
    const paymentsRows = payments.map((p: any, idx: number) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;">${p.voucher_number || `PV-${p.id}`}</td>
        <td>${p.voucher_date || '-'}</td>
        <td>${p.notes || 'سند صرف دفعة'}</td>
        <td style="font-family: monospace; font-weight: bold; color: #b45309;">${fmt(p.amount)} ريال</td>
      </tr>
    `).join("");

    const html = `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 25px;">
        <div style="text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 12px; margin-bottom: 15px;">
          <h1 style="margin: 0; color: #b45309;">كشف حساب مورد / وكيل تفصيلي</h1>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">المورد: ${suppName} | الكود: ${supp.supplier_code || 'SUP-101'}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; text-align: center;">
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b;">اسم المورد</div>
            <div style="font-size: 15px; font-weight: bold; color: #1e293b;">${suppName}</div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b;">تصنيف النشاط</div>
            <div style="font-size: 15px; font-weight: bold; color: #1e293b;">${supp.supplier_type || 'خدمات سياحية'}</div>
          </div>
          <div style="background: #fef3c7; padding: 12px; border-radius: 8px; border: 1px solid #fde68a;">
            <div style="font-size: 12px; color: #92400e;">الرصيد الدائن المستحق</div>
            <div style="font-size: 18px; font-weight: bold; color: #b45309; font-family: monospace;">${fmt(balance)} ريال</div>
          </div>
        </div>

        <h3 style="color: #1e293b; margin-bottom: 10px;">سجل سندات الدفع والصرف:</h3>
        <table>
          <thead>
            <tr style="background: #fef3c7; color: #78350f;">
              <th>#</th>
              <th>رقم السند</th>
              <th>التاريخ</th>
              <th>البيان والملاحظات</th>
              <th>المبلغ المصروف</th>
            </tr>
          </thead>
          <tbody>
            ${paymentsRows || "<tr><td colSpan='5' style='text-align: center;'>لا توجد عمليات صرف مسجلة لهذه الفترة</td></tr>"}
          </tbody>
        </table>
      </div>
    `;

    setReportHtml(html);
    setReportTitle(`كشف حساب المورد - ${suppName}`);
    setReportViewerOpen(true);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-8 h-8 text-amber-600" />
              <h1 className="text-2xl font-bold text-slate-800">إدارة الموردين والوكلاء (Suppliers & Agents)</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              إدارة شركات الطيران، سلاسل الفنادق، النقل، وكلاء التأشيرات، مع كشف حساب دائن ومدين وسندات الصرف المحاسبية
            </p>
          </div>
          <Button onClick={() => setOpenAddModal(true)} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-medium">
            <Plus className="w-4 h-4" /> إضافة مورد/وكيل جديد
          </Button>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المورد، الكود، مسؤول التواصل..."
              className="pr-9"
            />
          </div>

          <div className="w-full md:w-64">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="نوع المورد" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الموردين والوكلاء</SelectItem>
                <SelectItem value="شركة طيران">شركات الطيران</SelectItem>
                <SelectItem value="فندق / سلسلة">سلاسل الفنادق</SelectItem>
                <SelectItem value="شركة نقل">شركات النقل والمواصلات</SelectItem>
                <SelectItem value="شركة تأمين">شركات التأمين</SelectItem>
                <SelectItem value="وكيل تأشيرات">وكلاء التأشيرات</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Supplier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-3 text-center py-12 text-slate-500">جاري تحميل قائمة الموردين...</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-3 text-center py-12 bg-white rounded-2xl border text-slate-500">
              لا يوجد موردين مطابقين للبحث
            </div>
          ) : (
            filtered.map((supp: any) => (
              <div key={supp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-1 text-xs font-mono font-bold bg-amber-50 text-amber-800 rounded-lg">
                      {supp.supplier_code}
                    </span>
                    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-bold">
                      {supp.supplier_type}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-snug">{supp.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">المسؤول: {supp.contact_person || "غير محدد"}</p>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
                    {supp.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /><span dir="ltr">{supp.phone}</span></div>}
                    {supp.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /><span className="truncate">{supp.email}</span></div>}
                  </div>

                  <div className="flex justify-between items-center p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                    <span className="text-xs text-slate-600">الرصيد الدائن المستحق:</span>
                    <span className="font-bold text-amber-800 text-base font-mono">
                      {fmt(supp.current_balance)} ريال
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs gap-1 border-slate-200"
                    onClick={() => { setSelectedSupplier(supp); setOpenStatementSheet(true); }}
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" /> كشف حساب
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1"
                    onClick={() => { setSelectedSupplier(supp); setOpenPaymentModal(true); }}
                  >
                    <Coins className="w-3.5 h-3.5" /> سند صرف
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Full-Screen Modal Add Supplier */}
        <Dialog open={openAddModal} onOpenChange={setOpenAddModal}>
          <DialogContent className="max-w-[100vw] w-screen h-screen max-h-screen m-0 rounded-none p-6 bg-white flex flex-col justify-between font-sans overflow-y-auto" dir="rtl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-800">
                <Users className="w-6 h-6 text-amber-600" /> تسجيل مورد أو وكيل خدمات سياحية جديد
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 my-4 text-sm">
              <div className="space-y-1 col-span-2">
                <Label className="font-bold">اسم المورد / الشركة *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: الخطوط السعودية / Bupa / VFS Global" />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">تصنيف المورد</Label>
                <Select value={form.supplier_type} onValueChange={(v) => setForm({ ...form, supplier_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="شركة طيران">شركة طيران</SelectItem>
                    <SelectItem value="فندق / سلسلة">فندق / سلسلة فنادق</SelectItem>
                    <SelectItem value="شركة نقل">شركة نقل ومواصلات</SelectItem>
                    <SelectItem value="شركة تأمين">شركة تأمين</SelectItem>
                    <SelectItem value="وكيل تأشيرات">وكيل تأشيرات</SelectItem>
                    <SelectItem value="متعهد رحلات">متعهد رحلات سياحية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-bold">اسم مسؤول التواصل</Label>
                <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="اسم المندوب" />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">رقم الهاتف</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0501122334" />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">البريد الإلكتروني</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="b2b@supplier.com" />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="font-bold">تفاصيل الحساب البنكي والتحويلات</Label>
                <Input value={form.bank_details} onChange={(e) => setForm({ ...form, bank_details: e.target.value })} placeholder="رقم الآيبان IBAN - اسم البنك" />
              </div>
            </div>

            <DialogFooter className="border-t pt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenAddModal(false)}>إلغاء</Button>
              <Button onClick={() => createSupplierMutation.mutate(form)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8">
                حفظ بيانات المورد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Payment Voucher */}
        <Dialog open={openPaymentModal} onOpenChange={setOpenPaymentModal}>
          <DialogContent className="max-w-xl font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-800">
                <Coins className="w-5 h-5 text-amber-600" /> سند صرف دفعة للمورد: {selectedSupplier?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm my-2">
              <div className="space-y-1">
                <Label className="font-bold">مبلغ السداد (ريال) *</Label>
                <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">تاريخ السند</Label>
                <Input type="date" value={paymentForm.voucher_date} onChange={(e) => setPaymentForm({ ...paymentForm, voucher_date: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">طريقة الدفع</Label>
                <Select value={paymentForm.payment_method} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقداً من الصندوق الرئيسية</SelectItem>
                    <SelectItem value="bank">تحويل بنكي direct bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-bold">البيان / ملاحظات</Label>
                <Input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="سداد مستحقات حجز تذاكر طيران..." />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenPaymentModal(false)}>إلغاء</Button>
              <Button
                onClick={() => paySupplierMutation.mutate({ suppId: selectedSupplier.id, payload: paymentForm })}
                disabled={paySupplierMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                تأكيد الصرف وترحيل القيد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Statement of Account Sheet */}
        <Sheet open={openStatementSheet} onOpenChange={setOpenStatementSheet}>
          <SheetContent side="left" className="w-full sm:max-w-xl font-sans overflow-y-auto" dir="rtl">
            <SheetHeader>
              <SheetTitle className="text-lg font-bold flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" /> كشف حساب المورد: {selectedSupplier?.name}
                </span>
              </SheetTitle>
              <SheetDescription className="text-xs">
                ملخص كامل للخدمات المشتراة وسندات الدفع مع رصيد الحساب الجاري
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 mt-6 text-sm">
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-center text-xs">
                <div>
                  <div className="text-slate-500">إجمالي المشتريات</div>
                  <div className="font-bold text-slate-800">{fmt(statementData?.summary?.totalPurchases)} ريال</div>
                </div>
                <div>
                  <div className="text-slate-500">إجمالي المدفوعات</div>
                  <div className="font-bold text-emerald-700">{fmt(statementData?.summary?.totalPayments)} ريال</div>
                </div>
                <div>
                  <div className="text-slate-500">الرصيد المتبقي</div>
                  <div className="font-bold text-amber-800">{fmt(statementData?.summary?.balance)} ريال</div>
                </div>
              </div>

              <Button
                onClick={() => handlePreviewStatement(selectedSupplier)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
              >
                <Eye className="w-4 h-4" /> استعراض كشف الحساب قبل الطباعة (شاشة كاملة)
              </Button>

              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-700">سجل الدفعات وسندات الصرف:</h4>
                {statementData?.payments?.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">لا توجد سندات دفع سابقة.</div>
                ) : (
                  statementData?.payments?.map((p: any) => (
                    <div key={p.id} className="p-3 bg-white border rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{p.voucher_number}</div>
                        <div className="text-slate-500">{p.voucher_date} - {p.notes || "دفعة نقدية"}</div>
                      </div>
                      <div className="font-bold text-amber-800 font-mono">-{fmt(p.amount)} ريال</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Full-Screen Report Viewer Modal */}
        <ReportViewerModal
          isOpen={reportViewerOpen}
          onClose={() => setReportViewerOpen(false)}
          htmlContent={reportHtml}
          title={reportTitle}
        />

      </div>
    </AdminLayout>
  );
}

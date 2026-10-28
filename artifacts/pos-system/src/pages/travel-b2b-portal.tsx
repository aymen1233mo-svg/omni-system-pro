import React, { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  FileText,
  DollarSign,
  TrendingUp,
  Download,
  AlertCircle,
  Search,
  Filter,
  Check,
  X,
  CreditCard,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers
    }
  }).then(async (r) => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ في الخادم");
    }
    return r.json();
  });
}

function fmt(n?: number) {
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TravelB2bPortalPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCorporateId, setSelectedCorporateId] = useState<number | null>(null);

  // Dialog States
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddRequestOpen, setIsAddRequestOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);

  // Forms
  const [accountForm, setAccountForm] = useState({
    company_name: "",
    company_name_en: "",
    cr_number: "",
    tax_number: "",
    contact_person: "",
    contact_phone: "",
    contact_email: "",
    credit_limit: 100000,
    payment_terms_days: 30,
    policy_max_booking_budget: 6000,
    policy_allowed_classes: "اقتصادية,أعمال",
    policy_require_manager_approval: 1,
    notes: ""
  });

  const [requestForm, setRequestForm] = useState({
    corporate_id: 1,
    passenger_name: "",
    origin: "RUH",
    destination: "LHR",
    departure_date: "2026-09-20",
    return_date: "2026-09-27",
    preferred_class: "أعمال (Business)",
    purpose_of_trip: "مؤتمر الطاقة والنفط السنوي",
    estimated_cost: 7500
  });

  const [employeeForm, setEmployeeForm] = useState({
    name_ar: "",
    name_en: "",
    employee_number: "",
    department: "المشاريع الهندسية",
    job_title: "مدير مشاريع",
    phone: "",
    email: "",
    passport_number: "",
    max_budget: 8000,
    allowed_class: "أعمال"
  });

  // Queries
  const { data: accounts, isLoading: accountsLoading } = useQuery<any[]>({
    queryKey: ["corporate-accounts"],
    queryFn: () => fetchWithAuth("/api/travel/corporate/accounts")
  });

  const activeCorporateId = selectedCorporateId || accounts?.[0]?.id || 1;

  const { data: corporateDetails } = useQuery<any>({
    queryKey: ["corporate-details", activeCorporateId],
    queryFn: () => fetchWithAuth(`/api/travel/corporate/accounts/${activeCorporateId}`),
    enabled: !!activeCorporateId
  });

  // Mutations
  const createAccountMutation = useMutation({
    mutationFn: (data: any) =>
      fetchWithAuth("/api/travel/corporate/accounts", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corporate-accounts"] });
      setIsAddAccountOpen(false);
      toast({ title: "تم إنشاء حساب الشركة بنجاح! 🏢" });
    },
    onError: (err: any) => toast({ title: "فشل الحفظ", description: err.message, variant: "destructive" })
  });

  const createRequestMutation = useMutation({
    mutationFn: (data: any) =>
      fetchWithAuth("/api/travel/corporate/requests", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corporate-details", activeCorporateId] });
      setIsAddRequestOpen(false);
      toast({ title: "تم تقديم طلب السفر بنجاح وهو قيد الموافقة ✈️" });
    },
    onError: (err: any) => toast({ title: "فشل التقديم", description: err.message, variant: "destructive" })
  });

  const createEmployeeMutation = useMutation({
    mutationFn: (data: any) =>
      fetchWithAuth("/api/travel/corporate/employees", {
        method: "POST",
        body: JSON.stringify({ ...data, corporate_id: activeCorporateId })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corporate-details", activeCorporateId] });
      setIsAddEmployeeOpen(false);
      toast({ title: "تمت إضافة الموظف بنجاح 👤" });
    },
    onError: (err: any) => toast({ title: "فشل الحفظ", description: err.message, variant: "destructive" })
  });

  const actionRequestMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      fetchWithAuth(`/api/travel/corporate/requests/${id}/action`, {
        method: "POST",
        body: JSON.stringify({ action })
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["corporate-details", activeCorporateId] });
      queryClient.invalidateQueries({ queryKey: ["corporate-accounts"] });
      toast({
        title: vars.action === "approve" ? "تمت الموافقة على طلب السفر بنجاح ✅" : "تم رفض الطلب ❌"
      });
    }
  });

  const selectedAccount = corporateDetails?.account || accounts?.find((a) => a.id === activeCorporateId);
  const employees = corporateDetails?.employees || [];
  const requests = corporateDetails?.requests || [];

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600/30 border border-blue-400/30 rounded-xl">
                <Building2 className="w-8 h-8 text-blue-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">بوابة الشركات والمؤسسات B2B Corporate Portal</h1>
                <p className="text-sm text-slate-300 mt-1">
                  إدارة حسابات الشركات، سياسات السفر والاعتماد المالي، موازنات الموظفين، والمطالبات الشهرية
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/travel-dashboard">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition shadow-md cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                الرجوع للواجهة الرئيسية
              </button>
            </Link>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              onClick={() => setIsAddAccountOpen(true)}
            >
              <Plus className="w-4 h-4 ml-2" />
              إضافة شركة جديدة
            </Button>
          </div>
        </div>

        {/* Corporate Selector Cards Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {accounts?.map((acc) => {
            const isSelected = acc.id === activeCorporateId;
            const creditPct = Math.round(((acc.current_balance || 0) / (acc.credit_limit || 1)) * 100);
            return (
              <Card
                key={acc.id}
                onClick={() => setSelectedCorporateId(acc.id)}
                className={`cursor-pointer transition-all border-2 ${
                  isSelected ? "border-indigo-600 bg-indigo-50/40 shadow-md" : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-600">{acc.account_code}</span>
                    <Badge variant="outline" className={acc.status === "active" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}>
                      {acc.status === "active" ? "نشط" : "معلق"}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 line-clamp-1">{acc.company_name}</h3>
                    <p className="text-xs text-slate-500">{acc.contact_person} • {acc.contact_phone || "لا يوجد هاتف"}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">الرصيد المستحق:</span>
                      <span className="font-bold font-mono text-slate-800">{fmt(acc.current_balance)} SAR</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${creditPct > 80 ? "bg-red-500" : creditPct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(creditPct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>الحد الائتماني: {fmt(acc.credit_limit)} SAR</span>
                      <span>{creditPct}% مستهلك</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Selected Corporate Deep View */}
        {selectedAccount && (
          <div className="space-y-6">
            {/* Corporate Overview & Policies Header */}
            <Card className="border-indigo-100 bg-white shadow-sm">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse">
                  {/* Info */}
                  <div className="space-y-2">
                    <div className="text-xs text-indigo-600 font-bold uppercase">بيانات المنشأة</div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedAccount?.company_name}</h2>
                    <p className="text-xs text-slate-500 font-mono">س.ت: {selectedAccount.cr_number || "7001928374"} | ضريبي: {selectedAccount.tax_number || "310928374600003"}</p>
                    <div className="text-xs text-slate-600">مسؤول الحساب: <span className="font-semibold">{selectedAccount.contact_person}</span></div>
                  </div>

                  {/* Financial Terms */}
                  <div className="space-y-2 md:pr-6">
                    <div className="text-xs text-blue-600 font-bold uppercase">الشروط الائتمانية والمالية</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">الحد الائتماني المتاح:</span>
                      <span className="font-bold font-mono text-slate-900">{fmt(selectedAccount.credit_limit)} SAR</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">فترة السداد الآجل:</span>
                      <span className="font-bold text-slate-900">{selectedAccount.payment_terms_days} يوماً</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">المبلغ المتبقي للحد:</span>
                      <span className="font-bold font-mono text-emerald-600">{fmt((selectedAccount.credit_limit || 0) - (selectedAccount.current_balance || 0))} SAR</span>
                    </div>
                  </div>

                  {/* Travel Policy Rules */}
                  <div className="space-y-2 md:pr-6">
                    <div className="text-xs text-emerald-600 font-bold uppercase">سياسة السفر (Travel Policy Engine)</div>
                    <div className="text-xs text-slate-600">
                      سقف التذكرة بدون اعتماد: <strong className="font-mono text-slate-900">{fmt(selectedAccount.policy_max_booking_budget)} SAR</strong>
                    </div>
                    <div className="text-xs text-slate-600">
                      الدرجات المسموحة: <Badge variant="outline" className="bg-slate-100 font-medium">{selectedAccount.policy_allowed_classes || "سياحية,أعمال"}</Badge>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>{selectedAccount.policy_require_manager_approval ? "يتطلب موافقة المدير المباشر" : "إصدار تلقائي ضمن الموازنة"}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col justify-center gap-2 md:pr-6">
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9"
                      onClick={() => {
                        setRequestForm((prev) => ({ ...prev, corporate_id: activeCorporateId }));
                        setIsAddRequestOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 ml-1" />
                      تقديم طلب سفر لموظف
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs h-9 text-slate-700"
                      onClick={() => setIsAddEmployeeOpen(true)}
                    >
                      <Users className="w-4 h-4 ml-1 text-slate-500" />
                      إضافة موظف للمنظومة
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Corporate Tabs: Requests & Approvals / Employees / Statement */}
            <Tabs defaultValue="requests" className="w-full">
              <TabsList className="grid grid-cols-3 w-full bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="requests" className="py-2.5 font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>طلبات السفر ومسار الاعتماد ({requests.length})</span>
                </TabsTrigger>
                <TabsTrigger value="employees" className="py-2.5 font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>دليل الموظفين والمخصصات ({employees.length})</span>
                </TabsTrigger>
                <TabsTrigger value="statement" className="py-2.5 font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>كشف الحساب والمطالبات المالية</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: TRAVEL REQUESTS & APPROVALS */}
              <TabsContent value="requests" className="pt-4 space-y-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold">سجل طلبات حجز السفر للشركة</CardTitle>
                      <CardDescription>متابعة طلبات التذاكر والفنادق وإجراءات الموافقة والاعتماد المالي</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-slate-100/80 text-slate-700 border-b">
                          <tr>
                            <th className="p-3">رقم الطلب</th>
                            <th className="p-3">اسم الموظف / المسافر</th>
                            <th className="p-3">خط السير والخدمة</th>
                            <th className="p-3">تاريخ السفر</th>
                            <th className="p-3">الدرجة</th>
                            <th className="p-3">الغرض من الرحلة</th>
                            <th className="p-3">التكلفة التقديرية</th>
                            <th className="p-3">الحالة</th>
                            <th className="p-3 text-center">إجراء الاعتماد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {requests.map((r: any) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-indigo-600">{r.request_number}</td>
                              <td className="p-3 font-semibold text-slate-900">{r.passenger_name}</td>
                              <td className="p-3">
                                {r.origin} ✈️ {r.destination} ({r.service_type === "flight" ? "طيران" : "فندق"})
                              </td>
                              <td className="p-3 font-mono">{r.departure_date} {r.return_date ? `إلى ${r.return_date}` : ""}</td>
                              <td className="p-3">{r.preferred_class}</td>
                              <td className="p-3 text-slate-600 max-w-xs truncate">{r.purpose_of_trip || "مهمة عمل"}</td>
                              <td className="p-3 font-mono font-bold text-slate-900">{fmt(r.estimated_cost)} SAR</td>
                              <td className="p-3">
                                <Badge
                                  className={
                                    r.status === "approved"
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : r.status === "rejected"
                                      ? "bg-red-100 text-red-800 border-red-300"
                                      : "bg-amber-100 text-amber-800 border-amber-300"
                                  }
                                >
                                  {r.status === "approved" ? "معتمد ومصدر" : r.status === "rejected" ? "مرفوض" : "بانتظار الموافقة"}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                {r.status === "pending_approval" ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      size="sm"
                                      className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2"
                                      onClick={() => actionRequestMutation.mutate({ id: r.id, action: "approve" })}
                                    >
                                      <Check className="w-3.5 h-3.5 ml-1" />
                                      اعتماد
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 text-xs px-2"
                                      onClick={() => actionRequestMutation.mutate({ id: r.id, action: "reject" })}
                                    >
                                      <X className="w-3.5 h-3.5 ml-1" />
                                      رفض
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">{r.approver_name || "تمت المعالجة"}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 2: CORPORATE EMPLOYEES */}
              <TabsContent value="employees" className="pt-4 space-y-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                    <CardTitle className="text-base font-bold">دليل موظفي المنشأة المعتمدين</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-slate-100/80 text-slate-700 border-b">
                          <tr>
                            <th className="p-3">الرقم الوظيفي</th>
                            <th className="p-3">اسم الموظف (عربي / English)</th>
                            <th className="p-3">القسم / الإدارة</th>
                            <th className="p-3">المسمى الوظيفي</th>
                            <th className="p-3">رقم الجواز</th>
                            <th className="p-3">سقف الموازنة المسموح</th>
                            <th className="p-3">درجة السفر</th>
                            <th className="p-3">حالة الحساب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {employees.map((emp: any) => (
                            <tr key={emp.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-slate-700">{emp.employee_number}</td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{emp.name_ar}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{emp.name_en}</div>
                              </td>
                              <td className="p-3">{emp.department || "الإدارة العامة"}</td>
                              <td className="p-3 text-slate-700">{emp.job_title || "موظف"}</td>
                              <td className="p-3 font-mono text-slate-600">{emp.passport_number || "—"}</td>
                              <td className="p-3 font-mono font-bold text-emerald-700">{fmt(emp.max_budget)} SAR</td>
                              <td className="p-3">
                                <Badge variant="outline">{emp.allowed_class || "اقتصادية"}</Badge>
                              </td>
                              <td className="p-3">
                                <Badge className="bg-emerald-100 text-emerald-800">نشط</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 3: CORPORATE STATEMENT */}
              <TabsContent value="statement" className="pt-4 space-y-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold">كشف الحساب والمطالبات الدورية لشركة {selectedAccount?.company_name}</CardTitle>
                      <CardDescription>ملخص الحجوزات الآجلة والفواتير الشهرية المستحقة</CardDescription>
                    </div>
                    <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Onyx ERP)"}) : alert("تحت التطوير")} variant="outline" size="sm" className="text-xs">
                      <Download className="w-4 h-4 ml-1.5" />
                      تصدير كشف الحساب (PDF)
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border">
                        <div className="text-xs text-slate-500">إجمالي الحجوزات الصادرة:</div>
                        <div className="text-xl font-bold font-mono text-slate-900 mt-1">{fmt(selectedAccount.current_balance)} SAR</div>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                        <div className="text-xs text-emerald-700">الرصيد المتاح للشركة:</div>
                        <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
                          {fmt((selectedAccount.credit_limit || 0) - (selectedAccount.current_balance || 0))} SAR
                        </div>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="text-xs text-blue-700">موعد استحقاق المطالبة القادمة:</div>
                        <div className="text-base font-bold text-blue-900 mt-1">نهاية الشهر الميلادي (30 يوماً)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* DIALOG: CREATE CORPORATE ACCOUNT */}
        <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
          <DialogContent className="max-w-xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">إضافة حساب شركة / مؤسسة B2B جديدة</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="font-semibold block mb-1">اسم الشركة / الجهة (عربي):</label>
                <Input value={accountForm.company_name} onChange={(e) => setAccountForm({ ...accountForm, company_name: e.target.value })} placeholder="مثال: شركة أرامكو السعودية" />
              </div>
              <div>
                <label className="font-semibold block mb-1">الاسم بالإنجليزية:</label>
                <Input value={accountForm.company_name_en} onChange={(e) => setAccountForm({ ...accountForm, company_name_en: e.target.value })} placeholder="Saudi Aramco" />
              </div>
              <div>
                <label className="font-semibold block mb-1">رقم السجل التجاري:</label>
                <Input value={accountForm.cr_number} onChange={(e) => setAccountForm({ ...accountForm, cr_number: e.target.value })} />
              </div>
              <div>
                <label className="font-semibold block mb-1">الرقم الضريبي:</label>
                <Input value={accountForm.tax_number} onChange={(e) => setAccountForm({ ...accountForm, tax_number: e.target.value })} />
              </div>
              <div>
                <label className="font-semibold block mb-1">اسم مسؤول التواصل:</label>
                <Input value={accountForm.contact_person} onChange={(e) => setAccountForm({ ...accountForm, contact_person: e.target.value })} />
              </div>
              <div>
                <label className="font-semibold block mb-1">هاتف التواصل:</label>
                <Input value={accountForm.contact_phone} onChange={(e) => setAccountForm({ ...accountForm, contact_phone: e.target.value })} />
              </div>
              <div>
                <label className="font-semibold block mb-1">البريد الإلكتروني:</label>
                <Input value={accountForm.contact_email} onChange={(e) => setAccountForm({ ...accountForm, contact_email: e.target.value })} />
              </div>
              <div>
                <label className="font-semibold block mb-1">الحد الائتماني (SAR):</label>
                <Input type="number" value={accountForm.credit_limit} onChange={(e) => setAccountForm({ ...accountForm, credit_limit: Number(e.target.value) })} />
              </div>
              <div>
                <label className="font-semibold block mb-1">فترة السداد (أيام):</label>
                <Input type="number" value={accountForm.payment_terms_days} onChange={(e) => setAccountForm({ ...accountForm, payment_terms_days: Number(e.target.value) })} />
              </div>
              <div className="col-span-2">
                <label className="font-semibold block mb-1">سقف موازنة التذكرة بدون موافقة (SAR):</label>
                <Input type="number" value={accountForm.policy_max_booking_budget} onChange={(e) => setAccountForm({ ...accountForm, policy_max_booking_budget: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddAccountOpen(false)}>إلغاء</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold" onClick={() => createAccountMutation.mutate(accountForm)}>
                حفظ وإنشاء الحساب 🏢
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG: SUBMIT TRAVEL REQUEST */}
        <Dialog open={isAddRequestOpen} onOpenChange={setIsAddRequestOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">تقديم طلب سفر لموظف المنشأة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">اسم المسافر / الموظف:</label>
                <Input value={requestForm.passenger_name} onChange={(e) => setRequestForm({ ...requestForm, passenger_name: e.target.value })} placeholder="مثال: م. فهد السبيعي" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">من (المغادرة):</label>
                  <Input value={requestForm.origin} onChange={(e) => setRequestForm({ ...requestForm, origin: e.target.value })} />
                </div>
                <div>
                  <label className="font-semibold block mb-1">إلى (الوجهة):</label>
                  <Input value={requestForm.destination} onChange={(e) => setRequestForm({ ...requestForm, destination: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">تاريخ المغادرة:</label>
                  <Input type="date" value={requestForm.departure_date} onChange={(e) => setRequestForm({ ...requestForm, departure_date: e.target.value })} />
                </div>
                <div>
                  <label className="font-semibold block mb-1">تاريخ العودة:</label>
                  <Input type="date" value={requestForm.return_date} onChange={(e) => setRequestForm({ ...requestForm, return_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">الدرجة المفضلة:</label>
                <Input value={requestForm.preferred_class} onChange={(e) => setRequestForm({ ...requestForm, preferred_class: e.target.value })} />
              </div>
              <div>
                <label className="font-semibold block mb-1">الغرض من الرحلة / المهمة:</label>
                <Input value={requestForm.purpose_of_trip} onChange={(e) => setRequestForm({ ...requestForm, purpose_of_trip: e.target.value })} />
              </div>
              <div>
                <label className="font-semibold block mb-1">التكلفة التقديرية (SAR):</label>
                <Input type="number" value={requestForm.estimated_cost} onChange={(e) => setRequestForm({ ...requestForm, estimated_cost: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddRequestOpen(false)}>إلغاء</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => createRequestMutation.mutate(requestForm)}>
                إرسال للاعتماد 🚀
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG: ADD EMPLOYEE */}
        <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">إضافة موظف لشركة {selectedAccount?.company_name || ""}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">الاسم بالعربي:</label>
                <Input value={employeeForm.name_ar} onChange={(e) => setEmployeeForm({ ...employeeForm, name_ar: e.target.value })} />
              </div>
              <div>
                <label className="font-semibold block mb-1">الاسم بالإنجليزية (كما في الجواز):</label>
                <Input value={employeeForm.name_en} onChange={(e) => setEmployeeForm({ ...employeeForm, name_en: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">الرقم الوظيفي:</label>
                  <Input type="number" min="1" step="1" placeholder="يُنشأ تلقائياً (1, 2, 3...)" value={employeeForm.employee_number} onChange={(e) => setEmployeeForm({ ...employeeForm, employee_number: e.target.value.replace(/\D/g, "") })} />
                </div>
                <div>
                  <label className="font-semibold block mb-1">القسم / الإدارة:</label>
                  <Input value={employeeForm.department} onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">رقم الجواز:</label>
                  <Input value={employeeForm.passport_number} onChange={(e) => setEmployeeForm({ ...employeeForm, passport_number: e.target.value })} />
                </div>
                <div>
                  <label className="font-semibold block mb-1">سقف الموازنة (SAR):</label>
                  <Input type="number" value={employeeForm.max_budget} onChange={(e) => setEmployeeForm({ ...employeeForm, max_budget: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>إلغاء</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold" onClick={() => createEmployeeMutation.mutate(employeeForm)}>
                حفظ الموظف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useGetUsers, useCreateUser, useUpdateUser, useDeleteUser, getGetUsersQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Shield, ShieldCheck, UserCheck, MapPin, Info, Monitor,
  Layers, Users as UsersIcon, FileText, UserPlus, ShieldAlert, CheckCircle2, XCircle
} from "lucide-react";
import { ErpUsersDisplayPanel, ErpUserGroupsPanel } from "@/components/erp-users-and-groups";
import { ErpUserDataMasterPanel } from "@/components/erp-user-master";
import { ErpScreenPermissionsPanel } from "@/components/erp-screen-permissions";

type FormData = {
  username: string;
  name: string;
  role: "general_manager" | "admin" | "cashier" | "accountant" | "storekeeper" | "purchasing" | "sales" | "hr";
  password: string;
  active: boolean;
  can_discount: boolean;
  allow_meal_deduction: boolean;
  perm_pos_only: boolean;
  perm_pos_delivery: boolean;
  perm_pos_dinein: boolean;
  perm_pos_takeaway: boolean;
  perm_pos_cash: boolean;
  perm_pos_card: boolean;
  perm_pos_credit: boolean;
  perm_last_invoice_reprint: string;
  employee_id: string;
  branch_id: string;
  perm_create_invoice: boolean;
  perm_edit_invoice: boolean;
  perm_cancel_invoice: boolean;
  perm_return: boolean;
  perm_view_prices: boolean;
  perm_view_profits: boolean;
  perm_edit_stock: boolean;
  perm_stocktake: boolean;
  perm_edit_entries: boolean;
  perm_close_periods: boolean;
  perm_view_salaries: boolean;
};

const ROLES = [
  { value: "general_manager", label: "مدير عام النظام (كامل صلاحيات النظام ما عدا المطور)" },
  { value: "admin", label: "مدير نظام كامل (Admin)" },
  { value: "cashier", label: "كاشير (فتح واجهة نقطة المبيعات POS مباشرة)" },
  { value: "accountant", label: "محاسب (نظام الحسابات العامة والمالية)" },
  { value: "storekeeper", label: "أمين مخازن ومستودعات" },
  { value: "purchasing", label: "مسؤول مشتريات وموردين" },
  { value: "sales", label: "مسؤول مبيعات وعملاء" },
  { value: "hr", label: "مسؤول شؤون الموظفين والرواتب" },
];

const isAdminRole = (r?: string) =>
  r === "admin" || r === "general_manager" || r === "developer" || r === "مدير" || r === "مدير عام" || r === "مدير عام النظام" || r === "مدير عام الشركة";

export default function Users() {
  const [location] = useLocation();
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "active_users" || t === "master_record" || t === "screen_permissions" || t === "manage") return t as any;
    return "master_record";
  };

  const [activeTab, setActiveTab] = useState<"master_record" | "screen_permissions" | "manage" | "active_users">(getInitialTab);

  useEffect(() => {
    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      if (t === "active_users" || t === "master_record" || t === "screen_permissions" || t === "manage") {
        setActiveTab(t as any);
      }
    };
    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, [location]);

  const handleTabChange = (t: "master_record" | "screen_permissions" | "manage" | "active_users") => {
    setActiveTab(t);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", t);
    window.history.pushState({}, "", u.toString());
  };

  const { data: users = [], isLoading } = useGetUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const r = await fetch("/api/employees", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    }
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["branches-list"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const r = await fetch("/api/branches", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    }
  });

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormData>({
    username: "",
    name: "",
    role: "cashier",
    password: "",
    active: true,
    can_discount: false,
    allow_meal_deduction: false,
    perm_pos_only: true,
    perm_pos_delivery: true,
    perm_pos_dinein: true,
    perm_pos_takeaway: true,
    perm_pos_cash: true,
    perm_pos_card: true,
    perm_pos_credit: false,
    perm_last_invoice_reprint: "all",
    employee_id: "",
    branch_id: "",
    perm_create_invoice: true,
    perm_edit_invoice: true,
    perm_cancel_invoice: false,
    perm_return: true,
    perm_view_prices: true,
    perm_view_profits: false,
    perm_edit_stock: false,
    perm_stocktake: false,
    perm_edit_entries: false,
    perm_close_periods: false,
    perm_view_salaries: false
  });

  const openAdd = () => {
    setEditing(null);
    setForm({
      username: "",
      name: "",
      role: "cashier",
      password: "",
      active: true,
      can_discount: false,
      allow_meal_deduction: false,
      perm_pos_only: true,
      perm_pos_delivery: true,
      perm_pos_dinein: true,
      perm_pos_takeaway: true,
      perm_pos_cash: true,
      perm_pos_card: true,
      perm_pos_credit: false,
      perm_last_invoice_reprint: "all",
      employee_id: "",
      branch_id: "",
      perm_create_invoice: true,
      perm_edit_invoice: true,
      perm_cancel_invoice: false,
      perm_return: true,
      perm_view_prices: true,
      perm_view_profits: false,
      perm_edit_stock: false,
      perm_stocktake: false,
      perm_edit_entries: false,
      perm_close_periods: false,
      perm_view_salaries: false
    });
    setShowDialog(true);
  };

  const openEdit = (u: any) => {
    setEditing(u);
    const isUserAdmin = isAdminRole(u.role) || u.username === "admin" || u.username === "developer" || Boolean(u.is_system_admin);
    setForm({
      username: u.username,
      name: u.name,
      role: (u.role || "cashier") as any,
      password: "",
      active: Boolean(u.active && !u.is_suspended),
      can_discount: isUserAdmin ? true : (u.can_discount !== undefined ? Boolean(u.can_discount) : false),
      allow_meal_deduction: isUserAdmin ? true : Boolean(u.allow_meal_deduction || u.perm_pos_employee_invoice),
      perm_pos_only: isUserAdmin ? false : (u.perm_pos_only !== undefined ? Boolean(u.perm_pos_only) : (u.role === "cashier")),
      perm_pos_delivery: u.perm_pos_delivery !== undefined ? Boolean(u.perm_pos_delivery) : true,
      perm_pos_dinein: u.perm_pos_dinein !== undefined ? Boolean(u.perm_pos_dinein) : true,
      perm_pos_takeaway: u.perm_pos_takeaway !== undefined ? Boolean(u.perm_pos_takeaway) : true,
      perm_pos_cash: u.perm_pos_cash !== undefined ? Boolean(u.perm_pos_cash) : true,
      perm_pos_card: u.perm_pos_card !== undefined ? Boolean(u.perm_pos_card) : true,
      perm_pos_credit: Boolean(u.perm_pos_credit),
      perm_last_invoice_reprint: u.perm_last_invoice_reprint || "all",
      employee_id: u.employee_id ? String(u.employee_id) : "",
      branch_id: u.branch_id ? String(u.branch_id) : "",
      perm_create_invoice: isUserAdmin ? true : (u.perm_create_invoice !== undefined ? Boolean(u.perm_create_invoice) : true),
      perm_edit_invoice: isUserAdmin ? true : (u.perm_edit_invoice !== undefined ? Boolean(u.perm_edit_invoice) : true),
      perm_cancel_invoice: isUserAdmin ? true : (u.perm_cancel_invoice !== undefined ? Boolean(u.perm_cancel_invoice) : false),
      perm_return: isUserAdmin ? true : (u.perm_return !== undefined ? Boolean(u.perm_return) : true),
      perm_view_prices: isUserAdmin ? true : (u.perm_view_prices !== undefined ? Boolean(u.perm_view_prices) : true),
      perm_view_profits: isUserAdmin ? true : (u.perm_view_profits !== undefined ? Boolean(u.perm_view_profits) : false),
      perm_edit_stock: isUserAdmin ? true : (u.perm_edit_stock !== undefined ? Boolean(u.perm_edit_stock) : false),
      perm_stocktake: isUserAdmin ? true : (u.perm_stocktake !== undefined ? Boolean(u.perm_stocktake) : false),
      perm_edit_entries: isUserAdmin ? true : (u.perm_edit_entries !== undefined ? Boolean(u.perm_edit_entries) : false),
      perm_close_periods: isUserAdmin ? true : (u.perm_close_periods !== undefined ? Boolean(u.perm_close_periods) : false),
      perm_view_salaries: isUserAdmin ? true : (u.perm_view_salaries !== undefined ? Boolean(u.perm_view_salaries) : false)
    });
    setShowDialog(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetUsersQueryKey() });
    qc.invalidateQueries({ queryKey: ["users-master-list"] });
    qc.invalidateQueries({ queryKey: ["onyx-users"] });
    qc.invalidateQueries();
    window.dispatchEvent(new Event("pos-permissions-updated"));
  };

  const handleRoleSelectChange = (newRole: any) => {
    const isSysAdmin = newRole === "general_manager" || newRole === "admin";
    const isCashierRole = newRole === "cashier";
    const isAccRole = newRole === "accountant";

    setForm({
      ...form,
      role: newRole,
      perm_pos_only: isCashierRole,
      can_discount: isSysAdmin || isAccRole ? true : form.can_discount,
      allow_meal_deduction: isSysAdmin ? true : form.allow_meal_deduction,
      perm_create_invoice: isSysAdmin ? true : form.perm_create_invoice,
      perm_edit_invoice: isSysAdmin ? true : form.perm_edit_invoice,
      perm_cancel_invoice: isSysAdmin ? true : false,
      perm_return: isSysAdmin ? true : form.perm_return,
      perm_view_prices: isSysAdmin || isAccRole ? true : form.perm_view_prices,
      perm_view_profits: isSysAdmin || isAccRole ? true : false,
      perm_edit_stock: isSysAdmin ? true : false,
      perm_stocktake: isSysAdmin ? true : false,
      perm_edit_entries: isSysAdmin || isAccRole ? true : false,
      perm_close_periods: isSysAdmin ? true : false,
      perm_view_salaries: isSysAdmin ? true : false,
    });
  };

  const handleSave = () => {
    if (!form.username || !form.name || (!editing && !form.password)) return;

    const isFormAdmin = isAdminRole(form.role);

    const payload: any = {
      username: form.username,
      name: form.name,
      role: form.role,
      active: Boolean(form.active),
      is_suspended: !form.active,
      is_system_admin: isFormAdmin,
      can_discount: isFormAdmin || form.role === "accountant" ? true : Boolean(form.can_discount),
      allow_meal_deduction: isFormAdmin ? true : Boolean(form.allow_meal_deduction),
      perm_pos_only: isFormAdmin ? false : Boolean(form.perm_pos_only),
      perm_pos_delivery: isFormAdmin ? true : Boolean(form.perm_pos_delivery),
      perm_pos_dinein: isFormAdmin ? true : Boolean(form.perm_pos_dinein),
      perm_pos_takeaway: isFormAdmin ? true : Boolean(form.perm_pos_takeaway),
      perm_pos_cash: isFormAdmin ? true : Boolean(form.perm_pos_cash),
      perm_pos_card: isFormAdmin ? true : Boolean(form.perm_pos_card),
      perm_pos_credit: isFormAdmin ? true : Boolean(form.perm_pos_credit),
      perm_last_invoice_reprint: form.perm_last_invoice_reprint || "all",
      employee_id: form.employee_id ? Number(form.employee_id) : null,
      branch_id: form.branch_id ? Number(form.branch_id) : null,
      perm_create_invoice: isFormAdmin ? true : Boolean(form.perm_create_invoice),
      perm_edit_invoice: isFormAdmin ? true : Boolean(form.perm_edit_invoice),
      perm_cancel_invoice: isFormAdmin ? true : Boolean(form.perm_cancel_invoice),
      perm_return: isFormAdmin ? true : Boolean(form.perm_return),
      perm_view_prices: isFormAdmin ? true : Boolean(form.perm_view_prices),
      perm_view_profits: isFormAdmin ? true : Boolean(form.perm_view_profits),
      perm_edit_stock: isFormAdmin ? true : Boolean(form.perm_edit_stock),
      perm_stocktake: isFormAdmin ? true : Boolean(form.perm_stocktake),
      perm_edit_entries: isFormAdmin ? true : Boolean(form.perm_edit_entries),
      perm_close_periods: isFormAdmin ? true : Boolean(form.perm_close_periods),
      perm_view_salaries: isFormAdmin ? true : Boolean(form.perm_view_salaries),
      default_screen: form.role === "cashier" || form.perm_pos_only ? "pos" : "dashboard",
      ...(form.password ? { password: form.password } : {})
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => {
          invalidate();
          setShowDialog(false);
          toast({ title: "تم التعديل وتحديث الحساب بنجاح ✅" });
        },
        onError: (err: any) => {
          const errMsg = err?.response?.data?.error || err?.message || "فشل في التعديل";
          toast({ variant: "destructive", title: "فشل في التعديل", description: errMsg });
        }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          invalidate();
          setShowDialog(false);
          toast({ title: "تمت إضافة المستخدم بنجاح ✅" });
        },
        onError: (err: any) => {
          const errMsg = err?.response?.data?.error || err?.message || "فشل في الإضافة";
          toast({ variant: "destructive", title: "فشل في الإضافة", description: errMsg });
        }
      });
    }
  };

  const handleDelete = (u: any) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${u.name}"؟`)) return;
    deleteMutation.mutate({ id: u.id }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "تم الحذف بنجاح" });
      },
      onError: (err: any) => {
        const errMsg = err?.response?.data?.error || err?.message || "فشل في الحذف";
        toast({
          variant: "destructive",
          title: "فشل في الحذف",
          description: errMsg
        });
      }
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Top Header & Navigation Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <h1 className="text-xl font-bold text-slate-800">نظام إدارة المستخدمين وصلاحيات الشاشات والجلسات</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              شاشة بيانات المستخدمين الرسمية، الضبط الدقيق لصلاحيات الشاشات لكل مستخدم، والجلسات الحالية
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleTabChange("master_record")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                activeTab === "master_record"
                  ? "bg-blue-800 text-white border-blue-800 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-4 h-4 text-amber-300" />
              <span>بيانات المستخدمين (الرسمية)</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("screen_permissions")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                activeTab === "screen_permissions"
                  ? "bg-purple-800 text-white border-purple-800 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-purple-300" />
              <span>صلاحيات استخدام الشاشات</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("active_users")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                activeTab === "active_users"
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              <Monitor className="w-4 h-4 text-emerald-400" />
              <span>عرض المستخدمين (العاملين حالياً)</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("manage")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                activeTab === "manage"
                  ? "bg-indigo-700 text-white border-indigo-700 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              <UsersIcon className="w-4 h-4 text-blue-300" />
              <span>جدول وقائمة المستخدمين</span>
            </button>
          </div>
        </div>

        {/* TAB 1: واجهة بيانات المستخدمين (Image 3) */}
        {activeTab === "master_record" && <ErpUserDataMasterPanel />}

        {/* TAB 2: صلاحيات استخدام الشاشات للمستخدمين (Image 4 - New Screen) */}
        {activeTab === "screen_permissions" && <ErpScreenPermissionsPanel />}

        {/* TAB 3: عرض المستخدمين (Image 1) */}
        {activeTab === "active_users" && <ErpUsersDisplayPanel />}

        {/* TAB 4: جدول قائمة المستخدمين */}
        {activeTab === "manage" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
              <div className="text-xs text-slate-600 font-semibold">
                إجمالي المستخدمين المسجلين: <span className="font-bold text-blue-700">{users.length}</span> مستخدم
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleTabChange("master_record")} className="gap-1.5 text-xs bg-white">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  شاشة بيانات المستخدمين
                </Button>
                <Button onClick={openAdd} size="sm" className="gap-1.5 text-xs bg-blue-700 hover:bg-blue-800">
                  <Plus className="w-3.5 h-3.5" />
                  إضافة مستخدم جديد
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="text-right p-3 font-bold">الرقم</th>
                      <th className="text-right p-3 font-bold">المستخدم</th>
                      <th className="text-right p-3 font-bold">اسم الدخول</th>
                      <th className="text-right p-3 font-bold">الدور الوظيفي</th>
                      <th className="text-right p-3 font-bold">القسم / الإدارة</th>
                      <th className="text-center p-3 font-bold">صلاحية الخصم</th>
                      <th className="text-right p-3 font-bold">الحالة</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u: any) => {
                      const hasDiscountPerm = Boolean(u.can_discount ?? (u.role === "admin" || u.role === "accountant" || u.role === "developer" || u.role === "general_manager"));

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-600">{u.user_number || u.id}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{u.name}</div>
                            {u.name_en && <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{u.name_en}</div>}
                          </td>
                          <td className="p-3 font-mono text-blue-700 font-semibold">{u.username}</td>
                          <td className="p-3">
                            <Badge className="bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100 text-[11px]">
                              {ROLES.find(r => r.value === u.role)?.label.split(" (")[0] || u.role}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-600">{u.department || "الإدارة العامة"}</td>
                          <td className="p-3 text-center">
                            {hasDiscountPerm ? (
                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px]">مسموح</Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400 border-slate-300 text-[10px]">محظور</Badge>
                            )}
                          </td>
                          <td className="p-3">
                            {u.is_suspended ? (
                              <Badge variant="destructive" className="gap-1 text-[10px]">
                                <XCircle className="w-3 h-3" /> موقوف
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border gap-1 text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> نشط
                              </Badge>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(u)} className="h-7 w-7 text-blue-600 hover:bg-blue-50">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(u)}
                                disabled={u.username === "admin"}
                                className="h-7 w-7 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* User Modal Form */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {editing ? `تعديل المستخدم: ${editing.name}` : "إضافة مستخدم جديد"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">اسم الدخول (Username) *</label>
                  <Input
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    placeholder="user1"
                    className="h-8 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">الاسم الكامل *</label>
                  <Input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="أحمد محمد"
                    className="h-8"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">الدور الوظيفي</label>
                <select
                  value={form.role}
                  onChange={e => handleRoleSelectChange(e.target.value)}
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-semibold"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  {editing ? "كلمة المرور (اتركها فارغة للإبقاء على الحالية)" : "كلمة المرور *"}
                </label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="h-8"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-lg">
                <div className="text-slate-700 font-semibold">حساب نشط ومفعل</div>
                <Switch checked={form.active} onCheckedChange={c => setForm({ ...form, active: c })} />
              </div>

              <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2.5">
                <div className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-700" />
                  <span>صلاحيات نقطة البيع (POS) وتخصيص الكاشير</span>
                </div>

                <div className="flex items-center justify-between p-1.5 bg-white border rounded">
                  <div>
                    <div className="text-slate-800 font-semibold">الدخول لنقطة المبيعات فقط</div>
                    <div className="text-[10px] text-slate-500">تحويل مباشر للـ POS وتقييد لوحة الإدارة</div>
                  </div>
                  <Switch checked={form.perm_pos_only} onCheckedChange={c => setForm({ ...form, perm_pos_only: c })} />
                </div>

                <div className="flex items-center justify-between p-1.5 bg-white border rounded">
                  <div>
                    <div className="text-slate-800 font-semibold">صلاحية منح الخصم بالفواتير</div>
                    <div className="text-[10px] text-slate-500">إظهار وقفل حقل الخصم في نقطة البيع</div>
                  </div>
                  <Switch checked={form.can_discount} onCheckedChange={c => setForm({ ...form, can_discount: c })} />
                </div>

                <div className="flex items-center justify-between p-1.5 bg-white border rounded">
                  <div>
                    <div className="text-slate-800 font-semibold">قطع فواتير وجبات الموظفين</div>
                    <div className="text-[10px] text-slate-500">إظهار واستخدام زر وجبة موظف</div>
                  </div>
                  <Switch checked={form.allow_meal_deduction} onCheckedChange={c => setForm({ ...form, allow_meal_deduction: c })} />
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px]">
                  <label className="flex items-center gap-1.5 p-1.5 bg-white border rounded cursor-pointer">
                    <input type="checkbox" checked={form.perm_pos_delivery} onChange={e => setForm({ ...form, perm_pos_delivery: e.target.checked })} className="rounded text-blue-600" />
                    <span>زر التوصيل</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-1.5 bg-white border rounded cursor-pointer">
                    <input type="checkbox" checked={form.perm_pos_dinein} onChange={e => setForm({ ...form, perm_pos_dinein: e.target.checked })} className="rounded text-blue-600" />
                    <span>زر المحلي</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-1.5 bg-white border rounded cursor-pointer">
                    <input type="checkbox" checked={form.perm_pos_takeaway} onChange={e => setForm({ ...form, perm_pos_takeaway: e.target.checked })} className="rounded text-blue-600" />
                    <span>زر السفري</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-1.5 bg-white border rounded cursor-pointer">
                    <input type="checkbox" checked={form.perm_pos_cash} onChange={e => setForm({ ...form, perm_pos_cash: e.target.checked })} className="rounded text-blue-600" />
                    <span>دفع نقدي</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-1.5 bg-white border rounded cursor-pointer">
                    <input type="checkbox" checked={form.perm_pos_card} onChange={e => setForm({ ...form, perm_pos_card: e.target.checked })} className="rounded text-blue-600" />
                    <span>دفع شبكة</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-1.5 bg-white border rounded cursor-pointer">
                    <input type="checkbox" checked={form.perm_pos_credit} onChange={e => setForm({ ...form, perm_pos_credit: e.target.checked })} className="rounded text-blue-600" />
                    <span>دفع آجل</span>
                  </label>
                </div>

                {/* صلاحية أزرار آخر فاتورة في نقطة المبيعات */}
                <div className="p-2 bg-white border border-blue-200 rounded space-y-2 mt-2">
                  <div>
                    <div className="text-slate-800 font-bold text-xs">صلاحيات أزرار آخر فاتورة (أسفل نافذة آخر فاتورة)</div>
                    <div className="text-[10px] text-slate-500">التحكم في السماح للمستخدم باستخدام أزرار طباعة آخر فاتورة في الكاشير</div>
                  </div>
                  <select
                    value={form.perm_last_invoice_reprint || "all"}
                    onChange={e => setForm({ ...form, perm_last_invoice_reprint: e.target.value })}
                    className="w-full h-8 px-2 bg-blue-50/50 border border-blue-300 rounded text-xs font-semibold text-blue-900"
                  >
                    <option value="all">تفعيل جميع أزرار آخر فاتورة (الكبيرة + التصنيفات + طباعة الكل)</option>
                    <option value="master_only">زر طباعة الفاتورة الكبيرة فقط (قفل التصنيفات والكل)</option>
                    <option value="departments_only">زر طباعة فواتير التصنيفات فقط (قفل الكبيرة والكل)</option>
                    <option value="master_and_dept">زري الفاتورة الكبيرة + التصنيفات منفصلة (قفل زر طباعة الكل)</option>
                    <option value="all_only">زر طباعة الكل فقط (قفل الأزرار المنفردة)</option>
                    <option value="none">معاينة فقط — قفل جميع أزرار الطباعة السفلية الثلاثة</option>
                    <option value="disabled">إقفال زر آخر فاتورة بالكامل ومنع فتح النافذة</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>إلغاء</Button>
              <Button size="sm" onClick={handleSave} className="bg-blue-700 hover:bg-blue-800">حفظ البيانات</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

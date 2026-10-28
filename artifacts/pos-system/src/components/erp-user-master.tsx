import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Save, Edit2, Trash2, RefreshCw, Search, Printer, Download,
  ChevronFirst, ChevronLast, ChevronRight, ChevronLeft, Shield, ShieldCheck,
  Users, UserPlus, UserCheck, UserX, Lock, Unlock, Monitor, LogOut, CheckCircle2,
  XCircle, Clock, Building2, Globe, Layers, Check, AlertTriangle, RotateCcw,
  Smartphone, CreditCard, ShoppingCart, FileText, Key, Calendar, Eye, EyeOff
} from "lucide-react";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {})
    }
  });
}

async function apiGet(url: string) {
  const r = await fetchAuth(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(url: string, body: any) {
  const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) });
  if (!r.ok) {
    let errText = await r.text();
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) errText = parsed.error;
    } catch {}
    throw new Error(errText);
  }
  return r.json();
}

async function apiPut(url: string, body: any) {
  const r = await fetchAuth(url, { method: "PUT", body: JSON.stringify(body) });
  if (!r.ok) {
    let errText = await r.text();
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) errText = parsed.error;
    } catch {}
    throw new Error(errText);
  }
  return r.json();
}

async function apiDel(url: string) {
  const r = await fetchAuth(url, { method: "DELETE" });
  if (!r.ok && r.status !== 204) {
    let errText = await r.text();
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) errText = parsed.error;
    } catch {}
    throw new Error(errText);
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * واجهة بيانات المستخدمين - Master User Record (تطابق صورة بيانات المستخدمين)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ErpUserDataMasterPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["users-master-list"],
    queryFn: () => apiGet("/api/users")
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-list"],
    queryFn: () => apiGet("/api/branches")
  });

  const { data: safes = [] } = useQuery({
    queryKey: ["safes-list"],
    queryFn: () => apiGet("/api/safes")
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: () => apiGet("/api/customers")
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Form State matching the exact image fields
  const [formData, setFormData] = useState<any>({
    user_number: 1,
    username: "",
    name: "",
    name_en: "",
    password: "",
    group_id: null,
    role: "cashier",
    department: "الإدارة العامة",
    job_title: "كاشير ومبيعات",
    default_branch_id: 1,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    work_start_time: "08:00",
    work_end_time: "22:00",
    language: "عربي",
    email: "",
    phone: "",
    
    // Checkbox and policy flags
    is_system_admin: false,
    is_suspended: false,
    suspended_date: "",
    suspended_reason: "",
    force_password_change: false,
    restrict_devices: false,
    allow_self_service: true,
    is_cashier: true,
    is_customer_rep: false,
    is_pos_user: true,
    is_handheld_user: false,
    allowed_devices: "",
    default_safe_id: null,
    customer_id: null,
    fingerprint_id: "",
    pos_permission_template: "افتراضي",
    
    // Granular POS Permissions
    perm_pos_only: true,
    can_discount: false,
    perm_pos_discount: false,
    allow_meal_deduction: false,
    perm_pos_employee_invoice: false,
    perm_pos_delivery: true,
    perm_pos_dinein: true,
    perm_pos_takeaway: true,
    perm_pos_cash: true,
    perm_pos_card: true,
    perm_pos_credit: false,

    // Granular ERP permissions
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
    perm_view_salaries: false,
  });

  const currentUser = users[currentIndex] || null;

  useEffect(() => {
    if (currentUser && !isNew && !isEditing) {
      const isUserSysAdmin = Boolean(
        currentUser.is_system_admin ||
        currentUser.role === "admin" ||
        currentUser.role === "general_manager" ||
        currentUser.role === "developer" ||
        currentUser.username === "admin"
      );
      const isSuspended = Boolean(currentUser.is_suspended || currentUser.active === 0 || currentUser.active === false);
      setFormData({
        id: currentUser.id,
        user_number: currentUser.user_number || currentUser.id,
        username: currentUser.username || "",
        name: currentUser.name || "",
        name_en: currentUser.name_en || "",
        password: "",
        group_id: null,
        role: currentUser.role || "cashier",
        department: currentUser.department || "الإدارة العامة",
        job_title: currentUser.job_title || "كاشير ومبيعات",
        default_branch_id: currentUser.default_branch_id || 1,
        start_date: currentUser.start_date || (currentUser.created_at ? currentUser.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        end_date: currentUser.end_date || "",
        work_start_time: currentUser.work_start_time || "08:00",
        work_end_time: currentUser.work_end_time || "22:00",
        language: currentUser.language || "عربي",
        email: currentUser.email || "",
        phone: currentUser.phone || "",
        
        is_system_admin: isUserSysAdmin,
        active: !isSuspended,
        is_suspended: isSuspended,
        suspended_date: currentUser.suspended_date || "",
        suspended_reason: currentUser.suspended_reason || "",
        force_password_change: Boolean(currentUser.force_password_change),
        restrict_devices: Boolean(currentUser.restrict_devices),
        allow_self_service: Boolean(currentUser.allow_self_service !== false),
        is_cashier: Boolean(currentUser.is_cashier || currentUser.role === "cashier"),
        is_customer_rep: Boolean(currentUser.is_customer_rep),
        is_pos_user: Boolean(currentUser.is_pos_user || currentUser.role === "cashier"),
        is_handheld_user: Boolean(currentUser.is_handheld_user),
        allowed_devices: currentUser.allowed_devices || "",
        default_safe_id: currentUser.default_safe_id || null,
        customer_id: currentUser.customer_id || null,
        fingerprint_id: currentUser.fingerprint_id || "",
        pos_permission_template: currentUser.pos_permission_template || "افتراضي",
        
        // Granular POS Permissions
        perm_pos_only: isUserSysAdmin ? false : (currentUser.perm_pos_only !== undefined ? Boolean(currentUser.perm_pos_only) : (currentUser.role === "cashier")),
        can_discount: isUserSysAdmin ? true : Boolean(currentUser.can_discount || currentUser.perm_pos_discount),
        perm_pos_discount: isUserSysAdmin ? true : Boolean(currentUser.perm_pos_discount || currentUser.can_discount),
        allow_meal_deduction: isUserSysAdmin ? true : Boolean(currentUser.allow_meal_deduction || currentUser.perm_pos_employee_invoice),
        perm_pos_employee_invoice: isUserSysAdmin ? true : Boolean(currentUser.perm_pos_employee_invoice || currentUser.allow_meal_deduction),
        perm_pos_delivery: currentUser.perm_pos_delivery !== undefined ? Boolean(currentUser.perm_pos_delivery) : true,
        perm_pos_dinein: currentUser.perm_pos_dinein !== undefined ? Boolean(currentUser.perm_pos_dinein) : true,
        perm_pos_takeaway: currentUser.perm_pos_takeaway !== undefined ? Boolean(currentUser.perm_pos_takeaway) : true,
        perm_pos_cash: currentUser.perm_pos_cash !== undefined ? Boolean(currentUser.perm_pos_cash) : true,
        perm_pos_card: currentUser.perm_pos_card !== undefined ? Boolean(currentUser.perm_pos_card) : true,
        perm_pos_mixed: currentUser.perm_pos_mixed !== undefined ? Boolean(currentUser.perm_pos_mixed) : true,
        perm_pos_credit: isUserSysAdmin ? true : Boolean(currentUser.perm_pos_credit),
        perm_last_invoice_reprint: currentUser.perm_last_invoice_reprint || (isUserSysAdmin ? "all" : "all"),

        // Granular ERP permissions
        perm_create_invoice: isUserSysAdmin ? true : Boolean(currentUser.perm_create_invoice),
        perm_edit_invoice: isUserSysAdmin ? true : Boolean(currentUser.perm_edit_invoice),
        perm_cancel_invoice: isUserSysAdmin ? true : Boolean(currentUser.perm_cancel_invoice),
        perm_return: isUserSysAdmin ? true : Boolean(currentUser.perm_return),
        perm_view_prices: isUserSysAdmin ? true : Boolean(currentUser.perm_view_prices),
        perm_view_profits: isUserSysAdmin ? true : Boolean(currentUser.perm_view_profits),
        perm_edit_stock: isUserSysAdmin ? true : Boolean(currentUser.perm_edit_stock),
        perm_stocktake: isUserSysAdmin ? true : Boolean(currentUser.perm_stocktake),
        perm_edit_entries: isUserSysAdmin ? true : Boolean(currentUser.perm_edit_entries),
        perm_close_periods: isUserSysAdmin ? true : Boolean(currentUser.perm_close_periods),
        perm_view_salaries: isUserSysAdmin ? true : Boolean(currentUser.perm_view_salaries),
      });
    }
  }, [currentUser, isNew, isEditing]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isNew) {
        return apiPost("/api/users", payload);
      } else {
        return apiPut(`/api/users/${currentUser.id}`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-master-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-users"] });
      queryClient.invalidateQueries({ queryKey: ["users-list-for-perms"] });
      queryClient.invalidateQueries({ queryKey: ["user-screen-perms"] });
      queryClient.invalidateQueries({ queryKey: ["me-screen-perms"] });
      queryClient.invalidateQueries();
      window.dispatchEvent(new Event("pos-permissions-updated"));
      toast({
        title: isNew ? "تمت إضافة المستخدم بنجاح ✅" : "تم حفظ التعديلات بنجاح ✅",
        description: "تم حفظ بيانات وصلاحيات المستخدم وتحديث صلاحيات أزرار آخر فاتورة بنجاح."
      });
      setIsNew(false);
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في الحفظ",
        description: err.message || "تعذر حفظ بيانات المستخدم",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiDel(`/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-master-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-users"] });
      queryClient.invalidateQueries({ queryKey: ["users-list-for-perms"] });
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف المستخدم من النظام."
      });
      if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في الحذف",
        description: err.message || "تعذر حذف المستخدم",
        variant: "destructive"
      });
    }
  });

  const handleNew = () => {
    const nextNum = (users.length > 0 ? Math.max(...users.map((u: any) => Number(u.user_number || u.id))) : 0) + 1;
    setFormData({
      user_number: nextNum,
      username: `user${nextNum}`,
      name: "",
      name_en: "",
      password: "User@123",
      group_id: null,
      role: "cashier",
      department: "الإدارة العامة",
      job_title: "كاشير ونقطة بيع",
      default_branch_id: branches[0]?.id || 1,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: "",
      work_start_time: "08:00",
      work_end_time: "22:00",
      language: "عربي",
      email: "",
      phone: "",
      
      is_system_admin: false,
      active: true,
      is_suspended: false,
      suspended_date: "",
      suspended_reason: "",
      force_password_change: false,
      restrict_devices: false,
      allow_self_service: true,
      is_cashier: true,
      is_customer_rep: false,
      is_pos_user: true,
      is_handheld_user: false,
      allowed_devices: "",
      default_safe_id: safes[0]?.id || null,
      customer_id: null,
      fingerprint_id: "",
      pos_permission_template: "افتراضي",
      
      perm_pos_only: true,
      can_discount: false,
      perm_pos_discount: false,
      allow_meal_deduction: false,
      perm_pos_employee_invoice: false,
      perm_pos_delivery: true,
      perm_pos_dinein: true,
      perm_pos_takeaway: true,
      perm_pos_cash: true,
      perm_pos_card: true,
      perm_pos_credit: false,
      perm_last_invoice_reprint: "all",

      perm_create_invoice: true,
      perm_edit_invoice: false,
      perm_cancel_invoice: false,
      perm_return: false,
      perm_view_prices: true,
      perm_view_profits: false,
      perm_edit_stock: false,
      perm_stocktake: false,
      perm_edit_entries: false,
      perm_close_periods: false,
      perm_view_salaries: false,
    });
    setIsNew(true);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!formData.username || !formData.name) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى كتابة اسم المستخدم واسم الموظف الكامل.",
        variant: "destructive"
      });
      return;
    }
    if (isNew && !formData.password) {
      toast({
        title: "كلمة المرور مطلوبة",
        description: "يرجى تحديد كلمة مرور للمستخدم الجديد.",
        variant: "destructive"
      });
      return;
    }
    const isRoleAdmin = formData.role === "admin" || formData.role === "general_manager" || Boolean(formData.is_system_admin);
    const isSuspended = Boolean(formData.is_suspended);
    saveMutation.mutate({
      ...formData,
      group_id: null,
      active: !isSuspended,
      is_suspended: isSuspended,
      is_system_admin: isRoleAdmin,
      perm_pos_only: isRoleAdmin ? false : Boolean(formData.perm_pos_only),
      default_screen: (!isRoleAdmin && (formData.role === "cashier" || formData.perm_pos_only)) ? "pos" : "dashboard",
    });
  };

  const handleCancel = () => {
    setIsNew(false);
    setIsEditing(false);
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    return users.filter((u: any) => 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(u.user_number || u.id).includes(searchTerm)
    );
  }, [users, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-[#f4f6f9] border border-slate-300 rounded-lg shadow overflow-hidden text-slate-800 font-sans" dir="rtl">
      {/* ─── Top Main Onyx ERP Toolbar ─── */}
      <div className="bg-gradient-to-b from-[#2b5876] to-[#1e3c72] text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-2">
          <div className="bg-white/10 p-1.5 rounded text-amber-300 border border-white/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide">بيانات المستخدمين</h2>
            <p className="text-[11px] text-blue-200">تعريف سجلات المستخدمين، الخزائن، وشروط الأمان</p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-md border border-white/10">
          <Button
            size="sm"
            onClick={handleNew}
            disabled={isEditing}
            className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة
          </Button>

          <Button
            size="sm"
            onClick={() => setIsEditing(true)}
            disabled={isEditing || !currentUser}
            className="h-7 px-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            تعديل
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isEditing || saveMutation.isPending}
            className="h-7 px-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold gap-1"
          >
            <Save className="w-3.5 h-3.5" />
            حفظ
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={!isEditing}
            className="h-7 px-2 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            إلغاء
          </Button>

          <Button
            size="sm"
            onClick={() => {
              if (currentUser && confirm(`هل أنت متأكد من حذف المستخدم: ${currentUser.name}؟`)) {
                deleteMutation.mutate(currentUser.id);
              }
            }}
            disabled={isEditing || !currentUser || currentUser.username === "admin"}
            className="h-7 px-2 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            حذف
          </Button>

          <div className="h-5 w-[1px] bg-white/20 mx-1" />

          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={() => setCurrentIndex(0)}
            disabled={currentIndex === 0 || isEditing}
            className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-40"
            title="الأول"
          >
            <ChevronFirst className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0 || isEditing}
            className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-40"
            title="السابق"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <span className="text-[11px] font-mono px-1.5 py-0.5 bg-white/10 rounded">
            {users.length > 0 ? `${currentIndex + 1} / ${users.length}` : "0 / 0"}
          </span>

          <button
            type="button"
            onClick={() => setCurrentIndex(prev => Math.min(users.length - 1, prev + 1))}
            disabled={currentIndex >= users.length - 1 || isEditing}
            className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-40"
            title="التالي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex(users.length - 1)}
            disabled={currentIndex >= users.length - 1 || isEditing}
            className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-40"
            title="الأخير"
          >
            <ChevronLast className="w-4 h-4" />
          </button>

          <div className="h-5 w-[1px] bg-white/20 mx-1" />

          <button
            type="button"
            onClick={() => refetch()}
            className="p-1 rounded hover:bg-white/20 text-white"
            title="تحديث"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="p-1 rounded hover:bg-white/20 text-white"
            title="طباعة"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Main Content Grid (Master Record) ─── */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {/* Section 1: User Identity Card */}
        <div className="bg-white border border-slate-300 rounded-md p-3 shadow-sm">
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-blue-700" />
              البيانات الأساسية وتسجيل الدخول
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded border border-emerald-200">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={!formData.is_suspended}
                  onChange={e => {
                    const isActive = e.target.checked;
                    setFormData({ ...formData, active: isActive, is_suspended: !isActive });
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span className="font-bold">حساب نشط ومفعل</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer bg-slate-100 px-2.5 py-1 rounded border">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={formData.is_system_admin}
                  onChange={e => {
                    const val = e.target.checked;
                    setFormData({
                      ...formData,
                      is_system_admin: val,
                      role: val && formData.role !== "admin" ? "general_manager" : formData.role,
                      perm_pos_only: val ? false : formData.perm_pos_only
                    });
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span className="font-semibold text-blue-900">مدير عام النظام (كامل الصلاحيات عدا المطور)</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer bg-red-50 text-red-800 px-2.5 py-1 rounded border border-red-200">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={formData.is_suspended}
                  onChange={e => {
                    const susp = e.target.checked;
                    setFormData({ ...formData, is_suspended: susp, active: !susp });
                  }}
                  className="rounded text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                />
                <span className="font-bold">توقيف المستخدم</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* User Number */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1">رقم المستخدم</label>
              <Input
                type="number"
                disabled={!isEditing}
                value={formData.user_number}
                onChange={e => setFormData({ ...formData, user_number: e.target.value })}
                className="h-8 font-mono bg-slate-50 border-slate-300"
              />
            </div>

            {/* Username Login */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1">اسم المستخدم (Login) *</label>
              <Input
                type="text"
                disabled={!isEditing}
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                className="h-8 font-mono font-bold text-blue-800 border-slate-300"
                placeholder="e.g. ahmed"
              />
            </div>

            {/* Full Name Arabic */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1">اسم المستخدم الكامل (عربي) *</label>
              <Input
                type="text"
                disabled={!isEditing}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="h-8 font-semibold border-slate-300"
                placeholder="أحمد محمد العلي"
              />
            </div>

            {/* Full Name English */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1">الاسم الأجنبي (English Name)</label>
              <Input
                type="text"
                disabled={!isEditing}
                value={formData.name_en}
                onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                className="h-8 border-slate-300 text-left"
                placeholder="Ahmed Mohamed"
                dir="ltr"
              />
            </div>

            {/* Role Selector */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1">الدور الوظيفي</label>
              <select
                disabled={!isEditing}
                value={formData.role}
                onChange={e => {
                  const r = e.target.value;
                  if (r === "cashier") {
                    setFormData({
                      ...formData,
                      role: r,
                      job_title: (!formData.job_title || formData.job_title === "كاشير ومبيعات" || formData.job_title === "مدير النظام" || formData.job_title === "مدير عام النظام") ? "كاشير ونقطة بيع" : formData.job_title,
                      is_system_admin: false,
                      is_cashier: true,
                      is_pos_user: true,
                      perm_pos_only: true,
                      perm_pos_cash: true,
                      perm_pos_card: true,
                      perm_pos_delivery: true,
                      perm_pos_dinein: true,
                      perm_pos_takeaway: true,
                      perm_pos_credit: false,
                      can_discount: false,
                      perm_pos_discount: false,
                      allow_meal_deduction: false,
                      perm_pos_employee_invoice: false,
                      perm_create_invoice: true,
                      perm_edit_invoice: false,
                      perm_cancel_invoice: false,
                      perm_return: false,
                      perm_view_prices: true,
                      perm_view_profits: false,
                      perm_edit_stock: false,
                      perm_stocktake: false,
                      perm_edit_entries: false,
                      perm_close_periods: false,
                      perm_view_salaries: false,
                    });
                  } else if (r === "accountant") {
                    setFormData({
                      ...formData,
                      role: r,
                      job_title: (!formData.job_title || formData.job_title === "كاشير ومبيعات" || formData.job_title === "مدير النظام") ? "محاسب مالي رئيسي" : formData.job_title,
                      is_system_admin: false,
                      is_cashier: false,
                      is_pos_user: false,
                      perm_pos_only: false,
                      can_discount: true,
                      perm_pos_discount: true,
                      perm_create_invoice: true,
                      perm_edit_invoice: true,
                      perm_cancel_invoice: true,
                      perm_return: true,
                      perm_view_prices: true,
                      perm_view_profits: true,
                      perm_edit_stock: false,
                      perm_stocktake: true,
                      perm_edit_entries: true,
                      perm_close_periods: true,
                      perm_view_salaries: false,
                    });
                  } else if (r === "admin" || r === "general_manager") {
                    setFormData({
                      ...formData,
                      role: r,
                      job_title: r === "general_manager" ? "مدير عام النظام والشركة" : "مدير النظام",
                      is_system_admin: true,
                      perm_pos_only: false,
                      can_discount: true,
                      perm_pos_discount: true,
                      allow_meal_deduction: true,
                      perm_pos_employee_invoice: true,
                      perm_pos_delivery: true,
                      perm_pos_dinein: true,
                      perm_pos_takeaway: true,
                      perm_pos_cash: true,
                      perm_pos_card: true,
                      perm_pos_credit: true,
                      perm_create_invoice: true,
                      perm_edit_invoice: true,
                      perm_cancel_invoice: true,
                      perm_return: true,
                      perm_view_prices: true,
                      perm_view_profits: true,
                      perm_edit_stock: true,
                      perm_stocktake: true,
                      perm_edit_entries: true,
                      perm_close_periods: true,
                      perm_view_salaries: true,
                    });
                  } else {
                    setFormData({ ...formData, role: r, perm_pos_only: false, is_system_admin: false });
                  }
                }}
                className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 font-semibold"
              >
                <option value="general_manager">مدير عام النظام (كامل الصلاحيات ما عدا المطور)</option>
                <option value="admin">مدير نظام كامل (Admin)</option>
                <option value="cashier">كاشير (فتح نقطة المبيعات مباشرة)</option>
                <option value="accountant">محاسب مالي</option>
                <option value="storekeeper">أمين مستودع ومخازن</option>
                <option value="purchasing">مسؤول مشتريات وموردين</option>
                <option value="sales">مندوب مبيعات</option>
                <option value="hr">مسؤول موارد بشرية HR</option>
                <option value="waiter">ويتر صالة</option>
                <option value="kitchen">شاشة مطبخ / KDS</option>
              </select>
            </div>

            {/* Password */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                {isNew ? "كلمة المرور *" : "تغيير كلمة المرور (اختياري)"}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  disabled={!isEditing}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="h-8 pl-8 font-mono border-slate-300"
                  placeholder={isNew ? "••••••••" : "اتركه فارغاً للإبقاء"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Default Branch */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1">الفرع الافتراضي</label>
              <select
                disabled={!isEditing}
                value={formData.default_branch_id}
                onChange={e => setFormData({ ...formData, default_branch_id: Number(e.target.value) })}
                className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              >
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Department, Job, Dates and Hours */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white border border-slate-300 rounded-md p-3 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b pb-2 mb-3">
              <Building2 className="w-4 h-4 text-emerald-700" />
              البيانات الإدارية وساعات العمل
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">القسم / الإدارة</label>
                <Input
                  type="text"
                  disabled={!isEditing}
                  value={formData.department}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                  className="h-8 border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">المسمى الوظيفي</label>
                <Input
                  type="text"
                  disabled={!isEditing}
                  value={formData.job_title}
                  onChange={e => setFormData({ ...formData, job_title: e.target.value })}
                  className="h-8 border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">تاريخ البدء</label>
                <Input
                  type="date"
                  disabled={!isEditing}
                  value={formData.start_date}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  className="h-8 border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">تاريخ الانتهاء</label>
                <Input
                  type="date"
                  disabled={!isEditing}
                  value={formData.end_date}
                  onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  className="h-8 border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">ساعة بدء العمل</label>
                <Input
                  type="time"
                  disabled={!isEditing}
                  value={formData.work_start_time}
                  onChange={e => setFormData({ ...formData, work_start_time: e.target.value })}
                  className="h-8 border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">ساعة انتهاء العمل</label>
                <Input
                  type="time"
                  disabled={!isEditing}
                  value={formData.work_end_time}
                  onChange={e => setFormData({ ...formData, work_end_time: e.target.value })}
                  className="h-8 border-slate-300 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: POS & Safe Integration */}
          <div className="bg-white border border-slate-300 rounded-md p-3 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b pb-2 mb-3">
              <ShoppingCart className="w-4 h-4 text-purple-700" />
              ربط نقاط البيع، الصناديق والعملاء
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">الخزينة / الصندوق الافتراضي</label>
                <select
                  disabled={!isEditing}
                  value={formData.default_safe_id || ""}
                  onChange={e => setFormData({ ...formData, default_safe_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- الصندوق الرئيسي للفرع --</option>
                  {safes.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.currency || "YER"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">ربط بعميل / مندوب خاص</label>
                <select
                  disabled={!isEditing}
                  value={formData.customer_id || ""}
                  onChange={e => setFormData({ ...formData, customer_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- غير مرتبط بعميل --</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone || c.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">رقم البصمة / الكود الوظيفي</label>
                <Input
                  type="text"
                  disabled={!isEditing}
                  value={formData.fingerprint_id}
                  onChange={e => setFormData({ ...formData, fingerprint_id: e.target.value })}
                  className="h-8 border-slate-300 font-mono"
                  placeholder="FP-1004"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">قالب صلاحيات الكاشير</label>
                <Input
                  type="text"
                  disabled={!isEditing}
                  value={formData.pos_permission_template}
                  onChange={e => setFormData({ ...formData, pos_permission_template: e.target.value })}
                  className="h-8 border-slate-300"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-slate-600 mb-1">الأجهزة المسموح الدخول منها (مفصولة بفواصل)</label>
                <Input
                  type="text"
                  disabled={!isEditing}
                  value={formData.allowed_devices}
                  onChange={e => setFormData({ ...formData, allowed_devices: e.target.value })}
                  className="h-8 border-slate-300 font-mono text-left"
                  placeholder="POS-01, CASHIER-DESK, LAPTOP-ADMIN"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Operational Switches (matching image) */}
        <div className="bg-white border border-slate-300 rounded-md p-3 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b pb-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            خيارات الاستخدام وشروط الأمان
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            <label className="flex items-center gap-2 p-2 bg-slate-50 border rounded hover:bg-slate-100 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={formData.is_cashier}
                onChange={e => setFormData({ ...formData, is_cashier: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">كاشير</span>
            </label>

            <label className="flex items-center gap-2 p-2 bg-slate-50 border rounded hover:bg-slate-100 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={formData.is_pos_user}
                onChange={e => setFormData({ ...formData, is_pos_user: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">مستخدم POS</span>
            </label>

            <label className="flex items-center gap-2 p-2 bg-slate-50 border rounded hover:bg-slate-100 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={formData.is_handheld_user}
                onChange={e => setFormData({ ...formData, is_handheld_user: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">جهاز كفي / موبايل</span>
            </label>

            <label className="flex items-center gap-2 p-2 bg-slate-50 border rounded hover:bg-slate-100 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={formData.force_password_change}
                onChange={e => setFormData({ ...formData, force_password_change: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">إلزام تغيير كلمة المرور</span>
            </label>

            <label className="flex items-center gap-2 p-2 bg-slate-50 border rounded hover:bg-slate-100 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={formData.restrict_devices}
                onChange={e => setFormData({ ...formData, restrict_devices: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">تقييد بالأجهزة المحددة</span>
            </label>

            <label className="flex items-center gap-2 p-2 bg-slate-50 border rounded hover:bg-slate-100 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={formData.allow_self_service}
                onChange={e => setFormData({ ...formData, allow_self_service: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">خدمة ذاتية</span>
            </label>
          </div>
        </div>

        {/* Section 5: POS & Cashier Dedicated Permissions Matrix */}
        <div className="bg-white border border-blue-200 rounded-md p-3 shadow-sm bg-gradient-to-r from-blue-50/40 to-indigo-50/40">
          <h3 className="text-xs font-bold text-blue-900 flex items-center gap-1.5 border-b border-blue-200 pb-2 mb-3">
            <ShoppingCart className="w-4 h-4 text-blue-700" />
            صلاحيات نقطة البيع (POS) وتخصيص الكاشير والعمليات
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
            {[
              { key: "perm_pos_only", label: "الدخول لنقطة المبيعات فقط (تقييد عن الإدارة)", desc: "عند تسجيل الدخول ينتقل مباشرة لـ POS" },
              { key: "can_discount", label: "السماح بمنح الخصم المالي", desc: "إظهار وقفل حقل الخصم في الفاتورة" },
              { key: "allow_meal_deduction", label: "قطع فواتير وجبات الموظفين", desc: "إظهار واستخدام زر وجبة موظف" },
              { key: "perm_pos_delivery", label: "استخدام / إظهار زر التوصيل (Delivery)", desc: "إتاحة زر التوصيل للكاشير" },
              { key: "perm_pos_dinein", label: "استخدام / إظهار زر المحلي (Dine-in)", desc: "إتاحة زر المحلي والطاولات" },
              { key: "perm_pos_takeaway", label: "استخدام / إظهار زر السفري (Takeaway)", desc: "إتاحة زر الطلب السفري" },
              { key: "perm_pos_cash", label: "استخدام / إظهار زر الدفع النقدي (Cash)", desc: "إتاحة خيار السداد النقدي" },
              { key: "perm_pos_card", label: "استخدام / إظهار زر الشبكة / البطاقة (Card)", desc: "إتاحة خيار السداد بالبطاقة" },
              { key: "perm_pos_mixed", label: "استخدام / إظهار زر السداد المختلط (Mixed)", desc: "إتاحة خيار السداد المختلط (نقدي + شبكة)" },
              { key: "perm_pos_credit", label: "استخدام / إظهار زر البيع الآجل (Credit)", desc: "إتاحة خيار السداد على الحساب" },
            ].map(perm => (
              <label
                key={perm.key}
                className="flex flex-col gap-1 p-2 bg-white border border-blue-200/80 rounded hover:border-blue-400 hover:shadow-xs cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={!isEditing || formData.is_system_admin}
                    checked={
                      perm.key === "perm_pos_only"
                        ? (formData.is_system_admin ? false : Boolean(formData.perm_pos_only))
                        : (formData.is_system_admin || Boolean(formData[perm.key]))
                    }
                    onChange={e => {
                      const val = e.target.checked;
                      const next = { ...formData, [perm.key]: val };
                      if (perm.key === "can_discount") next.perm_pos_discount = val;
                      if (perm.key === "allow_meal_deduction") next.perm_pos_employee_invoice = val;
                      setFormData(next);
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-[11px] ${formData[perm.key] ? "font-bold text-blue-950" : "text-slate-600"}`}>
                    {perm.label}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 mr-5">{perm.desc}</span>
              </label>
            ))}
          </div>

          {/* Last Invoice Reprint Permission Selector & Individual Button Checkboxes */}
          <div className="mt-3 p-3 bg-white border border-blue-200 rounded space-y-2.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-700" />
                <div>
                  <span className="text-xs font-bold text-slate-800">صلاحيات أزرار آخر فاتورة في نقطة المبيعات (أسفل نافذة آخر فاتورة)</span>
                  <p className="text-[10px] text-slate-500">التحكم المباشر في السماح للمستخدم باستخدام أزرار (طباعة الفاتورة الكبيرة، طباعة فواتير التصنيفات، طباعة الكل)</p>
                </div>
              </div>
              <select
                disabled={!isEditing}
                value={formData.perm_last_invoice_reprint || "all"}
                onChange={e => setFormData({ ...formData, perm_last_invoice_reprint: e.target.value })}
                className="h-8 px-2 bg-blue-50/50 border border-blue-300 rounded text-xs font-semibold text-blue-900 focus:ring-1 focus:ring-blue-500 min-w-[320px]"
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

            {(() => {
              const raw = String(formData.perm_last_invoice_reprint || "all").trim().toLowerCase();
              const isDisabled = raw === "disabled" || raw === "hide";
              const canMaster = !isDisabled && (raw === "all" || raw === "master_only" || raw === "master_and_dept" || raw.includes("master"));
              const canDept = !isDisabled && (raw === "all" || raw === "departments_only" || raw === "dept_only" || raw === "master_and_dept" || raw.includes("dept"));
              const canAll = !isDisabled && (raw === "all" || raw === "all_only" || (raw.startsWith("custom:") && raw.includes("all")));

              const updateFromFlags = (nextOpen: boolean, nextMaster: boolean, nextDept: boolean, nextAll: boolean) => {
                if (!nextOpen) {
                  setFormData({ ...formData, perm_last_invoice_reprint: "disabled" });
                  return;
                }
                if (nextMaster && nextDept && nextAll) {
                  setFormData({ ...formData, perm_last_invoice_reprint: "all" });
                } else if (!nextMaster && !nextDept && !nextAll) {
                  setFormData({ ...formData, perm_last_invoice_reprint: "none" });
                } else if (nextMaster && !nextDept && !nextAll) {
                  setFormData({ ...formData, perm_last_invoice_reprint: "master_only" });
                } else if (!nextMaster && nextDept && !nextAll) {
                  setFormData({ ...formData, perm_last_invoice_reprint: "departments_only" });
                } else if (nextMaster && nextDept && !nextAll) {
                  setFormData({ ...formData, perm_last_invoice_reprint: "master_and_dept" });
                } else if (!nextMaster && !nextDept && nextAll) {
                  setFormData({ ...formData, perm_last_invoice_reprint: "all_only" });
                } else {
                  const parts: string[] = [];
                  if (nextMaster) parts.push("master");
                  if (nextDept) parts.push("dept");
                  if (nextAll) parts.push("all");
                  setFormData({ ...formData, perm_last_invoice_reprint: `custom:${parts.join(",")}` });
                }
              };

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-blue-100">
                  <label className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer ${!isDisabled ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={!isDisabled}
                      onChange={e => updateFromFlags(e.target.checked, e.target.checked ? true : false, e.target.checked ? true : false, e.target.checked ? true : false)}
                      className="rounded text-emerald-600"
                    />
                    <span>السماح بفتح آخر فاتورة (F9)</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer ${canMaster ? "bg-blue-50/80 border-blue-300 text-blue-950 font-bold" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                    <input
                      type="checkbox"
                      disabled={!isEditing || isDisabled}
                      checked={canMaster}
                      onChange={e => updateFromFlags(true, e.target.checked, canDept, canAll)}
                      className="rounded text-blue-600"
                    />
                    <span>زر طباعة الفاتورة الكبيرة</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer ${canDept ? "bg-amber-50/80 border-amber-300 text-amber-950 font-bold" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                    <input
                      type="checkbox"
                      disabled={!isEditing || isDisabled}
                      checked={canDept}
                      onChange={e => updateFromFlags(true, canMaster, e.target.checked, canAll)}
                      className="rounded text-amber-600"
                    />
                    <span>زر طباعة فواتير التصنيفات</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer ${canAll ? "bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                    <input
                      type="checkbox"
                      disabled={!isEditing || isDisabled}
                      checked={canAll}
                      onChange={e => updateFromFlags(true, canMaster, canDept, e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>زر طباعة الكل (الكبيرة + التصنيفات)</span>
                  </label>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Section 6: General ERP Permissions Matrix */}
        <div className="bg-white border border-slate-300 rounded-md p-3 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b pb-2 mb-3">
            <Shield className="w-4 h-4 text-indigo-700" />
            مصفوفة الصلاحيات العامة والأنظمة الإدارية
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
            {[
              { key: "perm_create_invoice", label: "إنشاء فواتير المبيعات" },
              { key: "perm_edit_invoice", label: "تعديل فواتير المبيعات" },
              { key: "perm_cancel_invoice", label: "إلغاء وحذف الفواتير" },
              { key: "perm_return", label: "مردودات المبيعات" },
              { key: "perm_view_prices", label: "معاينة أسعار التكلفة" },
              { key: "perm_view_profits", label: "معاينة تقارير الأرباح" },
              { key: "perm_edit_stock", label: "تعديل أرصدة المخزون" },
              { key: "perm_stocktake", label: "إجراء الجرد المخزني" },
              { key: "perm_edit_entries", label: "تعديل القيود المحاسبية" },
              { key: "perm_close_periods", label: "إقفال الفترات والورديات" },
              { key: "perm_view_salaries", label: "معاينة رواتب الموظفين" },
            ].map(perm => (
              <label
                key={perm.key}
                className="flex items-center gap-2 p-2 bg-slate-50 border rounded hover:bg-slate-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  disabled={!isEditing || formData.is_system_admin}
                  checked={formData.is_system_admin || formData[perm.key]}
                  onChange={e => setFormData({ ...formData, [perm.key]: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className={`text-[11px] ${formData[perm.key] ? "font-bold text-slate-800" : "text-slate-500"}`}>
                  {perm.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Classic Onyx ERP Audit Footer Bar (matching image) ─── */}
      <div className="bg-[#e2e7ee] border-t-2 border-slate-300 px-3 py-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px] text-slate-700">
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">أدخلت بواسطة:</span>
          <span className="font-bold text-slate-800 truncate">{currentUser?.created_by || "مدير النظام"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">تاريخ الإدخال:</span>
          <span className="font-mono text-slate-800 truncate" dir="ltr">{currentUser?.created_at || "18/07/2026 07:30:00"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">عدلت بواسطة:</span>
          <span className="font-bold text-slate-800 truncate">{currentUser?.updated_by || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">تاريخ التعديل:</span>
          <span className="font-mono text-slate-800 truncate" dir="ltr">{currentUser?.updated_at || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300 col-span-2 md:col-span-1">
          <span className="text-slate-500 font-semibold">مرات التعديل:</span>
          <span className="font-mono font-bold text-blue-700">{currentUser?.edit_count ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

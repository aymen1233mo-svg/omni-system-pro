import { useState, useEffect, useMemo } from "react";
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
  XCircle, Clock, Building2, Globe, Layers, Check, AlertTriangle, RotateCcw
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

// ═════════════════════════════════════════════════════════════════════════════
// 1. واجهة عرض المستخدمين (Users Display / Active & Logged Sessions - Image 1)
// ═════════════════════════════════════════════════════════════════════════════
export function ErpUsersDisplayPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: sessionData = { active: [], history: [], all: [] }, isLoading, refetch: refetchSessions } = useQuery({
    queryKey: ["onyx-sessions"],
    queryFn: () => apiGet("/api/onyx/sessions")
  });

  const { data: dbUsers = [] } = useQuery<any[]>({
    queryKey: ["onyx-users"],
    queryFn: () => apiGet("/api/users").catch(() => [])
  });

  const { data: dbBranches = [] } = useQuery<any[]>({
    queryKey: ["branches"],
    queryFn: () => apiGet("/api/branches").catch(() => [])
  });

  // Checkbox in Image 1: "عرض المستخدمين الحاليين في النظام"
  const [showCurrentOnly, setShowCurrentOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [showSearchBar, setShowSearchBar] = useState<boolean>(false);

  // Selected row index & CRUD mode
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const [sessionForm, setSessionForm] = useState<any>({
    id: null,
    user_id: "",
    username: "مدير النظام",
    device_name: "DESKTOP-QLP03GF-EMAD",
    login_time: new Date().toISOString().replace("T", " ").slice(0, 19),
    logout_time: "",
    status: "نشط",
    branch_id: 1,
    language: "عربي",
    notes: ""
  });

  const allSessions: any[] = useMemo(() => {
    const raw = sessionData?.all || sessionData?.history || [];
    return Array.isArray(raw) ? raw : [];
  }, [sessionData]);

  const filteredSessions = useMemo(() => {
    return allSessions.filter((s: any) => {
      if (showCurrentOnly && s.status !== "نشط") return false;
      if (branchFilter !== "all" && String(s.branch_id) !== branchFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUser = (s.username || "").toLowerCase().includes(q);
        const matchDev = (s.device_name || "").toLowerCase().includes(q);
        const matchStatus = (s.status || "").toLowerCase().includes(q);
        const matchIn = (s.login_time || "").toLowerCase().includes(q);
        const matchOut = (s.logout_time || "").toLowerCase().includes(q);
        if (!matchUser && !matchDev && !matchStatus && !matchIn && !matchOut) return false;
      }
      return true;
    });
  }, [allSessions, showCurrentOnly, branchFilter, searchQuery]);

  const currentRecord = filteredSessions[selectedIndex] || filteredSessions[0] || null;

  useEffect(() => {
    if (selectedIndex >= filteredSessions.length && filteredSessions.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredSessions.length, selectedIndex]);

  useEffect(() => {
    if (currentRecord && !isAdding && !isEditing) {
      setSessionForm({
        id: currentRecord.id,
        user_id: currentRecord.user_id || "",
        username: currentRecord.username || "",
        device_name: currentRecord.device_name || "DESKTOP-QLP03GF-EMAD",
        login_time: currentRecord.login_time || "",
        logout_time: currentRecord.logout_time || "",
        status: currentRecord.status || "نشط",
        branch_id: currentRecord.branch_id || 1,
        language: currentRecord.language || "عربي",
        notes: currentRecord.notes || ""
      });
    }
  }, [currentRecord, isAdding, isEditing]);

  const createSessionMut = useMutation({
    mutationFn: (data: any) => apiPost("/api/onyx/sessions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-sessions"] });
      setIsAdding(false);
      setIsEditing(false);
      setSelectedIndex(0);
      toast({ title: "تم تسجيل جلسة الدخول بنجاح", description: "تمت إضافة الجلسة إلى جدول عرض المستخدمين" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ في الحفظ", description: e.message })
  });

  const updateSessionMut = useMutation({
    mutationFn: (data: any) => apiPut(`/api/onyx/sessions/${data.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-sessions"] });
      setIsEditing(false);
      setIsAdding(false);
      toast({ title: "تم حفظ التعديلات بنجاح", description: "تم تحديث بيانات جلسة المستخدم في النظام" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ في التحديث", description: e.message })
  });

  const disconnectSessionMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status?: string }) => apiPost(`/api/onyx/sessions/disconnect/${id}`, { status: status || "خروج" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-sessions"] });
      toast({ title: "تم تسجيل خروج المستخدم", description: "تم تحديث حالة الجلسة وتسجيل تاريخ ووقت الخروج الفعلي" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الإجراء", description: e.message })
  });

  const reconnectSessionMut = useMutation({
    mutationFn: (id: number) => apiPost(`/api/onyx/sessions/reconnect/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-sessions"] });
      toast({ title: "تم إعادة تفعيل الجلسة", description: "المستخدم في حالة اتصال نشط الآن" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الإجراء", description: e.message })
  });

  const disconnectAllMut = useMutation({
    mutationFn: () => apiPost("/api/onyx/sessions/disconnect-all", {}),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["onyx-sessions"] });
      toast({ title: "تم إغلاق كافة الجلسات النشطة", description: `تم تسجيل خروج (${res?.disconnected_count || 0}) جلسة نشطة` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الإجراء", description: e.message })
  });

  const deleteSessionMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/onyx/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-sessions"] });
      setSelectedIndex(0);
      toast({ title: "تم حذف السجل بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الحذف", description: e.message })
  });

  const handleNew = () => {
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
    setIsAdding(true);
    setIsEditing(true);
    setSessionForm({
      id: null,
      user_id: dbUsers[0]?.id || "",
      username: dbUsers[0]?.name || "مدير النظام",
      device_name: "DESKTOP-QLP03GF-EMAD",
      login_time: nowStr,
      logout_time: "",
      status: "نشط",
      branch_id: 1,
      language: "عربي",
      notes: ""
    });
  };

  const handleSave = () => {
    if (!sessionForm.username) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى اختيار أو إدخال اسم المستخدم" });
      return;
    }
    if (isAdding || !sessionForm.id) {
      createSessionMut.mutate(sessionForm);
    } else {
      updateSessionMut.mutate(sessionForm);
    }
  };

  const handleUndo = () => {
    setIsAdding(false);
    setIsEditing(false);
    if (currentRecord) {
      setSessionForm({
        id: currentRecord.id,
        user_id: currentRecord.user_id || "",
        username: currentRecord.username || "",
        device_name: currentRecord.device_name || "DESKTOP-QLP03GF-EMAD",
        login_time: currentRecord.login_time || "",
        logout_time: currentRecord.logout_time || "",
        status: currentRecord.status || "نشط",
        branch_id: currentRecord.branch_id || 1,
        language: currentRecord.language || "عربي",
        notes: currentRecord.notes || ""
      });
    }
    toast({ title: "تم التراجع عن التغييرات" });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = ["حالة دخول الجهاز", "اسم المستخدم", "اسم الجهاز", "تاريخ الدخول", "تاريخ الخروج", "اللغة", "الفرع"];
    const rows = filteredSessions.map((s: any) => [
      s.status || "نشط",
      s.username || "",
      s.device_name || "",
      s.login_time || "",
      s.logout_time || "متصل حالياً",
      s.language || "عربي",
      s.branch_id || 1
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم تصدير جدول عرض المستخدمين بنجاح" });
  };

  const activeCount = allSessions.filter((s: any) => s.status === "نشط").length;
  const exitedCount = allSessions.filter((s: any) => s.status !== "نشط").length;

  return (
    <div className="bg-[#f4f6f9] border border-slate-300 rounded-lg shadow-sm overflow-hidden font-sans" dir="rtl">
      {/* Classic Onyx Title Bar */}
      <div className="bg-gradient-to-l from-[#1e3a5f] via-[#244673] to-[#1b3252] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-400">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-white/15 flex items-center justify-center border border-white/25">
            <Monitor className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-2">
              <span>عرض المستخدمين</span>
              <span className="text-[11px] font-normal text-blue-200">(مراقبة المستخدمين العاملين في النظام وحركة الدخول والخروج)</span>
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-2.5 py-0.5 rounded font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            متصل حالياً: {activeCount}
          </span>
          <span className="bg-white/10 border border-white/20 text-slate-200 px-2.5 py-0.5 rounded font-mono">
            سجل الخروج: {exitedCount}
          </span>
          <span className="bg-white/10 border border-white/20 text-amber-200 px-2.5 py-0.5 rounded font-mono">
            الإجمالي: {allSessions.length}
          </span>
        </div>
      </div>

      {/* Classic ERP Toolbar */}
      <div className="bg-[#e9edf2] border-b border-slate-300 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNew}
            className="h-8 text-xs font-bold bg-white hover:bg-emerald-50 border-slate-300 text-slate-800 gap-1"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            إضافة
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!currentRecord}
            onClick={() => {
              if (!currentRecord) return;
              setIsAdding(false);
              setIsEditing(true);
            }}
            className={`h-8 text-xs font-bold gap-1 ${isEditing && !isAdding ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-white hover:bg-amber-50 border-slate-300 text-slate-800"}`}
          >
            <Edit2 className="w-3.5 h-3.5 text-amber-600" />
            تعديل
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!currentRecord || isAdding}
            onClick={() => {
              if (!currentRecord) return;
              if (confirm(`هل أنت متأكد من حذف سجل جلسة المستخدم "${currentRecord.username}"؟`)) {
                deleteSessionMut.mutate(currentRecord.id);
              }
            }}
            className="h-8 text-xs font-bold bg-white hover:bg-red-50 border-slate-300 text-slate-800 gap-1"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            حذف
          </Button>

          <div className="w-[1px] h-5 bg-slate-300 mx-0.5" />

          <Button
            variant="outline"
            size="sm"
            disabled={!isEditing && !isAdding}
            onClick={handleSave}
            className="h-8 text-xs font-bold bg-white hover:bg-blue-50 border-slate-300 text-blue-800 gap-1"
          >
            <Save className="w-3.5 h-3.5 text-blue-600" />
            حفظ
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!isEditing && !isAdding}
            onClick={handleUndo}
            className="h-8 text-xs font-bold bg-white hover:bg-slate-100 border-slate-300 text-slate-700 gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            تراجع
          </Button>

          <div className="w-[1px] h-5 bg-slate-300 mx-0.5" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearchBar(!showSearchBar)}
            className={`h-8 text-xs font-bold gap-1 ${showSearchBar ? "bg-blue-100 border-blue-400 text-blue-900" : "bg-white border-slate-300 text-slate-800"}`}
          >
            <Search className="w-3.5 h-3.5 text-blue-600" />
            بحث
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSessions();
              toast({ title: "تم تحديث بيانات جلسات المستخدمين" });
            }}
            className="h-8 text-xs font-bold bg-white border-slate-300 text-slate-800 gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
            تحديث
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!currentRecord || currentRecord.status !== "نشط"}
            onClick={() => {
              if (!currentRecord) return;
              disconnectSessionMut.mutate({ id: currentRecord.id, status: "خروج" });
            }}
            className="h-8 text-xs font-bold bg-white hover:bg-red-50 border-red-200 text-red-700 gap-1"
          >
            <LogOut className="w-3.5 h-3.5 text-red-600" />
            تسجيل خروج / قطع اتصال
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={activeCount === 0}
            onClick={() => {
              if (confirm("هل تريد إغلاق وتسجيل خروج كافة الجلسات النشطة حالياً؟")) {
                disconnectAllMut.mutate();
              }
            }}
            className="h-8 text-xs font-bold bg-white hover:bg-amber-50 border-amber-200 text-amber-800 gap-1"
          >
            <XCircle className="w-3.5 h-3.5 text-amber-600" />
            إغلاق الكل
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs font-bold bg-white border-slate-300 text-slate-800 gap-1"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" />
            طباعة
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-8 text-xs font-bold bg-white border-slate-300 text-slate-800 gap-1"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            تصدير
          </Button>
        </div>

        {/* Navigation Arrows */}
        <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-300">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={selectedIndex <= 0}
            onClick={() => setSelectedIndex(0)}
            title="السجل الأول"
          >
            <ChevronFirst className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={selectedIndex <= 0}
            onClick={() => setSelectedIndex(i => Math.max(0, i - 1))}
            title="السجل السابق"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[11px] font-bold font-mono px-2 text-slate-700">
            {filteredSessions.length > 0 ? `${selectedIndex + 1} / ${filteredSessions.length}` : "0 / 0"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={selectedIndex >= filteredSessions.length - 1}
            onClick={() => setSelectedIndex(i => Math.min(filteredSessions.length - 1, i + 1))}
            title="السجل التالي"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={selectedIndex >= filteredSessions.length - 1}
            onClick={() => setSelectedIndex(Math.max(0, filteredSessions.length - 1))}
            title="السجل الأخير"
          >
            <ChevronLast className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Top Filter Strip matching Image 1: Checkbox "عرض المستخدمين الحاليين في النظام" */}
      <div className="bg-white border-b border-slate-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-blue-50/70 hover:bg-blue-100/60 border border-blue-200 px-3 py-1.5 rounded-md transition-colors">
            <input
              type="checkbox"
              checked={showCurrentOnly}
              onChange={(e) => {
                setShowCurrentOnly(e.target.checked);
                setSelectedIndex(0);
              }}
              className="w-4 h-4 rounded border-slate-400 text-blue-700 focus:ring-blue-600"
            />
            <span className="text-xs font-bold text-slate-800">عرض المستخدمين الحاليين في النظام</span>
          </label>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setShowCurrentOnly(false)}
              className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${!showCurrentOnly ? "bg-slate-800 text-white border-slate-800" : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"}`}
            >
              كافة الحركات ({allSessions.length})
            </button>
            <button
              type="button"
              onClick={() => setShowCurrentOnly(true)}
              className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${showCurrentOnly ? "bg-emerald-700 text-white border-emerald-700" : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"}`}
            >
              العاملين في النظام حالياً ({activeCount})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600">الفرع:</span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 rounded border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
            >
              <option value="all">جميع الفروع</option>
              {dbBranches.map((b: any) => (
                <option key={b.id} value={String(b.id)}>{b.id} - {b.name}</option>
              ))}
            </select>
          </div>

          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم المستخدم أو الجهاز..."
              className="h-8 text-xs pr-8 bg-slate-50 border-slate-300"
            />
          </div>
        </div>
      </div>

      {/* Add / Edit Session Form Panel (shown when Adding or Editing) */}
      {(isAdding || isEditing) && (
        <div className="bg-amber-50/70 border-b border-amber-300 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Edit2 className="w-3.5 h-3.5 text-amber-700" />
              {isAdding ? "تسجيل جلسة دخول مستخدم جديدة في النظام" : `تعديل بيانات جلسة المستخدم: ${sessionForm.username}`}
            </span>
            <Badge variant="outline" className="bg-white border-amber-300 text-amber-800 text-[10px]">
              {isAdding ? "سجل جديد" : `معرف الجلسة #${sessionForm.id}`}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">اسم المستخدم</label>
              <select
                value={sessionForm.username}
                onChange={(e) => {
                  const u = dbUsers.find((usr: any) => usr.name === e.target.value);
                  setSessionForm({
                    ...sessionForm,
                    username: e.target.value,
                    user_id: u?.id || sessionForm.user_id,
                    branch_id: u?.branch_id || u?.default_branch_id || sessionForm.branch_id
                  });
                }}
                className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs font-semibold"
              >
                {dbUsers.map((u: any) => (
                  <option key={u.id} value={u.name}>{u.name} (@{u.username})</option>
                ))}
                {!dbUsers.some((u: any) => u.name === sessionForm.username) && (
                  <option value={sessionForm.username}>{sessionForm.username}</option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">اسم الجهاز</label>
              <Input
                value={sessionForm.device_name}
                onChange={(e) => setSessionForm({ ...sessionForm, device_name: e.target.value })}
                className="h-8 text-xs bg-white border-slate-300 font-mono"
                dir="ltr"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">حالة دخول الجهاز</label>
              <select
                value={sessionForm.status}
                onChange={(e) => {
                  const st = e.target.value;
                  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
                  setSessionForm({
                    ...sessionForm,
                    status: st,
                    logout_time: st === "نشط" ? "" : (sessionForm.logout_time || nowStr)
                  });
                }}
                className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs font-bold"
              >
                <option value="نشط">نشط (متصل بالنظام)</option>
                <option value="خروج">خروج (غادر النظام)</option>
                <option value="قطع اتصال">قطع اتصال (إغلاق إداري)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">تاريخ ووقت الدخول</label>
              <Input
                value={sessionForm.login_time}
                onChange={(e) => setSessionForm({ ...sessionForm, login_time: e.target.value })}
                className="h-8 text-xs bg-white border-slate-300 font-mono"
                dir="ltr"
                placeholder="YYYY-MM-DD HH:mm:ss"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">تاريخ ووقت الخروج</label>
              <Input
                value={sessionForm.logout_time || ""}
                onChange={(e) => setSessionForm({ ...sessionForm, logout_time: e.target.value })}
                disabled={sessionForm.status === "نشط"}
                placeholder={sessionForm.status === "نشط" ? "متصل حالياً" : "YYYY-MM-DD HH:mm:ss"}
                className="h-8 text-xs bg-white border-slate-300 font-mono"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">اللغة</label>
                <select
                  value={sessionForm.language}
                  onChange={(e) => setSessionForm({ ...sessionForm, language: e.target.value })}
                  className="w-full h-8 rounded border border-slate-300 bg-white px-1.5 text-xs"
                >
                  <option value="عربي">عربي</option>
                  <option value="انجليزي">انجليزي</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">الفرع</label>
                <select
                  value={sessionForm.branch_id}
                  onChange={(e) => setSessionForm({ ...sessionForm, branch_id: Number(e.target.value) })}
                  className="w-full h-8 rounded border border-slate-300 bg-white px-1.5 text-xs font-mono"
                >
                  {dbBranches.length > 0 ? dbBranches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.id}</option>
                  )) : <option value={1}>1</option>}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={handleUndo} className="h-7 text-xs bg-white">
              إلغاء
            </Button>
            <Button size="sm" onClick={handleSave} className="h-7 text-xs bg-blue-700 hover:bg-blue-800 text-white gap-1">
              <Save className="w-3.5 h-3.5" />
              حفظ السجل
            </Button>
          </div>
        </div>
      )}

      {/* Main ERP Data Grid matching Image 1 */}
      <div className="bg-white min-h-[340px] max-h-[480px] overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-[#dce3ec] text-slate-800 border-b-2 border-slate-400 shadow-2xs">
            <tr>
              <th className="py-2.5 px-3 text-right font-bold border-l border-slate-300 w-10">#</th>
              <th className="py-2.5 px-3 text-right font-bold border-l border-slate-300">حالة دخول الجهاز</th>
              <th className="py-2.5 px-3 text-right font-bold border-l border-slate-300">اسم المستخدم</th>
              <th className="py-2.5 px-3 text-right font-bold border-l border-slate-300">اسم الجهاز</th>
              <th className="py-2.5 px-3 text-right font-bold border-l border-slate-300">تاريخ الدخول</th>
              <th className="py-2.5 px-3 text-right font-bold border-l border-slate-300">تاريخ الخروج</th>
              <th className="py-2.5 px-3 text-center font-bold border-l border-slate-300">اللغة</th>
              <th className="py-2.5 px-3 text-center font-bold border-l border-slate-300">الفرع</th>
              <th className="py-2.5 px-3 text-center font-bold">العمليات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">جاري تحميل المستخدمين العاملين في النظام...</td>
              </tr>
            ) : filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">لا توجد جلسات مطابقة لمعايير العرض الحالية</td>
              </tr>
            ) : (
              filteredSessions.map((sess: any, idx: number) => {
                const isSelected = idx === selectedIndex;
                const isActive = sess.status === "نشط";
                return (
                  <tr
                    key={sess.id || idx}
                    onClick={() => setSelectedIndex(idx)}
                    onDoubleClick={() => {
                      setSelectedIndex(idx);
                      setIsAdding(false);
                      setIsEditing(true);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#2b6cb0] text-white font-semibold"
                        : idx % 2 === 0
                        ? "bg-white hover:bg-blue-50/60 text-slate-800"
                        : "bg-slate-50/70 hover:bg-blue-50/60 text-slate-800"
                    }`}
                  >
                    <td className={`py-2 px-3 font-mono border-l ${isSelected ? "border-blue-400 text-blue-100" : "border-slate-200 text-slate-500"}`}>
                      {idx + 1}
                    </td>
                    <td className={`py-2 px-3 border-l ${isSelected ? "border-blue-400" : "border-slate-200"}`}>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                          isSelected
                            ? "bg-white/20 text-white border border-white/30"
                            : isActive
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : sess.status === "خروج"
                            ? "bg-slate-100 text-slate-700 border border-slate-300"
                            : "bg-red-100 text-red-800 border border-red-300"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {sess.status || "نشط"}
                      </span>
                    </td>
                    <td className={`py-2 px-3 border-l ${isSelected ? "border-blue-400" : "border-slate-200"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{sess.username}</span>
                        {sess.group_name && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded ${isSelected ? "bg-blue-800 text-blue-100" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                            {sess.group_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`py-2 px-3 font-mono border-l ${isSelected ? "border-blue-400 text-blue-100" : "border-slate-200 text-slate-700"}`} dir="ltr">
                      {sess.device_name}
                    </td>
                    <td className={`py-2 px-3 font-mono border-l ${isSelected ? "border-blue-400 text-white" : "border-slate-200 text-slate-700"}`} dir="ltr">
                      {sess.login_time}
                    </td>
                    <td className={`py-2 px-3 font-mono border-l ${isSelected ? "border-blue-400 text-blue-100" : "border-slate-200 text-slate-600"}`} dir="ltr">
                      {sess.logout_time ? sess.logout_time : (
                        <span className={`text-[11px] font-sans ${isSelected ? "text-emerald-200" : "text-emerald-600 font-semibold"}`}>
                          — يعمل حالياً في النظام —
                        </span>
                      )}
                    </td>
                    <td className={`py-2 px-3 text-center border-l ${isSelected ? "border-blue-400" : "border-slate-200"}`}>
                      {sess.language || "عربي"}
                    </td>
                    <td className={`py-2 px-3 text-center font-mono border-l ${isSelected ? "border-blue-400" : "border-slate-200"}`}>
                      {sess.branch_id || 1}
                    </td>
                    <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => disconnectSessionMut.mutate({ id: sess.id, status: "خروج" })}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              isSelected
                                ? "bg-red-500 hover:bg-red-600 text-white"
                                : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                            }`}
                            title="تسجيل خروج المستخدم من النظام"
                          >
                            خروج
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => reconnectSessionMut.mutate(sess.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              isSelected
                                ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                            }`}
                            title="إعادة تفعيل الجلسة"
                          >
                            تفعيل
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIndex(idx);
                            setIsAdding(false);
                            setIsEditing(true);
                          }}
                          className={`p-1 rounded ${isSelected ? "hover:bg-white/20 text-white" : "hover:bg-slate-200 text-slate-600"}`}
                          title="تعديل"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Classic Onyx ERP Audit Footer Bar (matching Image 1 & 2) */}
      <div className="bg-[#e2e7ee] border-t-2 border-slate-300 px-3 py-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px] text-slate-700">
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">أدخلت بواسطة:</span>
          <span className="font-bold text-slate-800 truncate">{currentRecord?.created_by || currentRecord?.username || "مدير النظام"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">تاريخ الإدخال:</span>
          <span className="font-mono text-slate-800 truncate" dir="ltr">{currentRecord?.created_at || currentRecord?.login_time || "18/07/2026 07:29:52"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">عدلت بواسطة:</span>
          <span className="font-bold text-slate-800 truncate">{currentRecord?.updated_by || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">تاريخ التعديل:</span>
          <span className="font-mono text-slate-800 truncate" dir="ltr">{currentRecord?.updated_at || currentRecord?.logout_time || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300 col-span-2 md:col-span-1">
          <span className="text-slate-500 font-semibold">مرات التعديل:</span>
          <span className="font-mono font-bold text-blue-700">{currentRecord?.edit_count ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. واجهة مجموعة المستخدمين (User Groups & Group Permissions & Linking - Image 2)
// ═════════════════════════════════════════════════════════════════════════════
export function ErpUserGroupsPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: groups = [], isLoading, refetch: refetchGroups } = useQuery<any[]>({
    queryKey: ["user-groups"],
    queryFn: () => apiGet("/api/user-groups")
  });

  const { data: allUsers = [], refetch: refetchUsers } = useQuery<any[]>({
    queryKey: ["onyx-users"],
    queryFn: () => apiGet("/api/users").catch(() => [])
  });

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [userToLink, setUserToLink] = useState<string>("");

  const [groupForm, setGroupForm] = useState<any>({
    id: null,
    group_number: 1,
    name_ar: "",
    name_en: "",
    is_system_admin: false,
    is_suspended: false,
    suspended_date: "",
    suspended_reason: "",
    notes: "",
    can_discount: false,
    perm_create_invoice: true,
    perm_edit_invoice: true,
    perm_cancel_invoice: false,
    perm_return: false,
    perm_view_prices: true,
    perm_view_profits: false,
    perm_edit_stock: false,
    perm_stocktake: false,
    perm_edit_entries: false,
    perm_close_periods: false,
    perm_view_salaries: false,
    can_open_close_safe: false,
    can_transfer_funds: false
  });

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    const q = searchTerm.toLowerCase();
    return groups.filter((g: any) =>
      String(g.group_number).includes(q) ||
      (g.name_ar || "").toLowerCase().includes(q) ||
      (g.name_en || "").toLowerCase().includes(q)
    );
  }, [groups, searchTerm]);

  const currentGroup = filteredGroups[selectedIndex] || filteredGroups[0] || null;

  useEffect(() => {
    if (selectedIndex >= filteredGroups.length && filteredGroups.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredGroups.length, selectedIndex]);

  useEffect(() => {
    if (currentGroup && !isAdding && !isEditing) {
      setGroupForm({
        id: currentGroup.id,
        group_number: currentGroup.group_number,
        name_ar: currentGroup.name_ar || "",
        name_en: currentGroup.name_en || "",
        is_system_admin: Boolean(currentGroup.is_system_admin),
        is_suspended: Boolean(currentGroup.is_suspended),
        suspended_date: currentGroup.suspended_date || "",
        suspended_reason: currentGroup.suspended_reason || "",
        notes: currentGroup.notes || "",
        can_discount: Boolean(currentGroup.can_discount),
        perm_create_invoice: Boolean(currentGroup.perm_create_invoice),
        perm_edit_invoice: Boolean(currentGroup.perm_edit_invoice),
        perm_cancel_invoice: Boolean(currentGroup.perm_cancel_invoice),
        perm_return: Boolean(currentGroup.perm_return),
        perm_view_prices: Boolean(currentGroup.perm_view_prices),
        perm_view_profits: Boolean(currentGroup.perm_view_profits),
        perm_edit_stock: Boolean(currentGroup.perm_edit_stock),
        perm_stocktake: Boolean(currentGroup.perm_stocktake),
        perm_edit_entries: Boolean(currentGroup.perm_edit_entries),
        perm_close_periods: Boolean(currentGroup.perm_close_periods),
        perm_view_salaries: Boolean(currentGroup.perm_view_salaries),
        can_open_close_safe: Boolean(currentGroup.can_open_close_safe),
        can_transfer_funds: Boolean(currentGroup.can_transfer_funds),
        perm_last_invoice_reprint: currentGroup.perm_last_invoice_reprint || "all"
      });
    }
  }, [currentGroup, isAdding, isEditing]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["user-groups"] });
    qc.invalidateQueries({ queryKey: ["onyx-users"] });
    qc.invalidateQueries({ queryKey: ["/api/users"] });
    qc.invalidateQueries();
    window.dispatchEvent(new Event("pos-permissions-updated"));
  };

  const createGroupMut = useMutation({
    mutationFn: (data: any) => apiPost("/api/user-groups", data),
    onSuccess: (created: any) => {
      invalidateAll();
      setIsAdding(false);
      setIsEditing(false);
      const newIdx = groups.length;
      setSelectedIndex(newIdx);
      toast({ title: "تمت إضافة مجموعة المستخدمين بنجاح", description: `تم تعريف المجموعة (${created.name_ar}) برقم (${created.group_number})` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الحفظ", description: e.message })
  });

  const updateGroupMut = useMutation({
    mutationFn: (data: any) => apiPut(`/api/user-groups/${data.id}`, data),
    onSuccess: (updated: any) => {
      invalidateAll();
      setIsEditing(false);
      setIsAdding(false);
      toast({ title: "تم حفظ وتحديث مجموعة المستخدمين", description: `تم تحديث بيانات وصلاحيات (${updated.name_ar}) وتعميمها على المستخدمين المرتبطين` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التحديث", description: e.message })
  });

  const deleteGroupMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/user-groups/${id}`),
    onSuccess: () => {
      invalidateAll();
      setSelectedIndex(0);
      toast({ title: "تم حذف مجموعة المستخدمين بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "تعذر الحذف", description: e.message })
  });

  const linkUserMut = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) =>
      apiPost(`/api/user-groups/${groupId}/link-user`, { user_id: userId }),
    onSuccess: () => {
      invalidateAll();
      setUserToLink("");
      toast({ title: "تم ربط المستخدم بالمجموعة بنجاح", description: "تم تطبيق صلاحيات المجموعة على المستخدم تلقائياً" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل ربط المستخدم", description: e.message })
  });

  const unlinkUserMut = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: number; userId: number }) =>
      apiPost(`/api/user-groups/${groupId}/unlink-user`, { user_id: userId }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "تم فك ارتباط المستخدم من المجموعة" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الإجراء", description: e.message })
  });

  const applyPermsMut = useMutation({
    mutationFn: (groupId: number) => apiPost(`/api/user-groups/${groupId}/apply-permissions`, {}),
    onSuccess: (res: any) => {
      invalidateAll();
      toast({
        title: "تم تعميم الصلاحيات على مستوى المجموعة",
        description: `تم تطبيق صلاحيات المجموعة على (${res.updated_users || 0}) مستخدمين مرتبطين بها`
      });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التعميم", description: e.message })
  });

  const handleNew = () => {
    const nextNum = groups.length > 0 ? Math.max(...groups.map((g: any) => Number(g.group_number || 0))) + 1 : 1;
    setIsAdding(true);
    setIsEditing(true);
    setGroupForm({
      id: null,
      group_number: nextNum,
      name_ar: "",
      name_en: "",
      is_system_admin: false,
      is_suspended: false,
      suspended_date: "",
      suspended_reason: "",
      notes: "",
      can_discount: false,
      perm_create_invoice: true,
      perm_edit_invoice: true,
      perm_cancel_invoice: false,
      perm_return: false,
      perm_view_prices: true,
      perm_view_profits: false,
      perm_edit_stock: false,
      perm_stocktake: false,
      perm_edit_entries: false,
      perm_close_periods: false,
      perm_view_salaries: false,
      can_open_close_safe: false,
      can_transfer_funds: false,
      perm_last_invoice_reprint: "all"
    });
  };

  const handleSave = () => {
    if (!groupForm.name_ar || !String(groupForm.name_ar).trim()) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى إدخال اسم المجموعة بالعربية" });
      return;
    }
    if (isAdding || !groupForm.id) {
      createGroupMut.mutate(groupForm);
    } else {
      updateGroupMut.mutate({ ...groupForm, sync_users: true });
    }
  };

  const handleUndo = () => {
    setIsAdding(false);
    setIsEditing(false);
    if (currentGroup) {
      setGroupForm({
        id: currentGroup.id,
        group_number: currentGroup.group_number,
        name_ar: currentGroup.name_ar || "",
        name_en: currentGroup.name_en || "",
        is_system_admin: Boolean(currentGroup.is_system_admin),
        is_suspended: Boolean(currentGroup.is_suspended),
        suspended_date: currentGroup.suspended_date || "",
        suspended_reason: currentGroup.suspended_reason || "",
        notes: currentGroup.notes || "",
        can_discount: Boolean(currentGroup.can_discount),
        perm_create_invoice: Boolean(currentGroup.perm_create_invoice),
        perm_edit_invoice: Boolean(currentGroup.perm_edit_invoice),
        perm_cancel_invoice: Boolean(currentGroup.perm_cancel_invoice),
        perm_return: Boolean(currentGroup.perm_return),
        perm_view_prices: Boolean(currentGroup.perm_view_prices),
        perm_view_profits: Boolean(currentGroup.perm_view_profits),
        perm_edit_stock: Boolean(currentGroup.perm_edit_stock),
        perm_stocktake: Boolean(currentGroup.perm_stocktake),
        perm_edit_entries: Boolean(currentGroup.perm_edit_entries),
        perm_close_periods: Boolean(currentGroup.perm_close_periods),
        perm_view_salaries: Boolean(currentGroup.perm_view_salaries),
        can_open_close_safe: Boolean(currentGroup.can_open_close_safe),
        can_transfer_funds: Boolean(currentGroup.can_transfer_funds)
      });
    }
  };

  const toggleSystemAdmin = (checked: boolean) => {
    if (!isEditing && !isAdding) setIsEditing(true);
    setGroupForm((prev: any) => ({
      ...prev,
      is_system_admin: checked,
      ...(checked
        ? {
            can_discount: true,
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
            can_open_close_safe: true,
            can_transfer_funds: true
          }
        : {})
    }));
  };

  return (
    <div className="bg-[#f4f6f9] border border-slate-300 rounded-lg shadow-sm overflow-hidden font-sans" dir="rtl">
      {/* Classic Onyx Title Bar */}
      <div className="bg-gradient-to-l from-[#1e3a5f] via-[#244673] to-[#1b3252] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-400">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-white/15 flex items-center justify-center border border-white/25">
            <Layers className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-2">
              <span>مجموعة المستخدمين</span>
              <span className="text-[11px] font-normal text-blue-200">(تعريف مجموعات المستخدمين وربط المستخدم بالمجموعة ومنح الصلاحيات على مستوى المجموعة)</span>
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-white/10 border border-white/20 text-amber-200 px-2.5 py-0.5 rounded font-bold">
            إجمالي المجموعات: {groups.length}
          </span>
          <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-2.5 py-0.5 rounded font-bold">
            المستخدمين المرتبطين: {allUsers.filter((u: any) => u.group_id).length}
          </span>
        </div>
      </div>

      {/* Classic ERP Toolbar */}
      <div className="bg-[#e9edf2] border-b border-slate-300 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNew}
            className="h-8 text-xs font-bold bg-white hover:bg-emerald-50 border-slate-300 text-slate-800 gap-1"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            إضافة
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!currentGroup}
            onClick={() => {
              if (!currentGroup) return;
              setIsAdding(false);
              setIsEditing(true);
            }}
            className={`h-8 text-xs font-bold gap-1 ${isEditing && !isAdding ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-white hover:bg-amber-50 border-slate-300 text-slate-800"}`}
          >
            <Edit2 className="w-3.5 h-3.5 text-amber-600" />
            تعديل
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!currentGroup || isAdding}
            onClick={() => {
              if (!currentGroup) return;
              if (confirm(`هل أنت متأكد من حذف المجموعة "${currentGroup.name_ar}"؟`)) {
                deleteGroupMut.mutate(currentGroup.id);
              }
            }}
            className="h-8 text-xs font-bold bg-white hover:bg-red-50 border-slate-300 text-slate-800 gap-1"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            حذف
          </Button>

          <div className="w-[1px] h-5 bg-slate-300 mx-0.5" />

          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            className="h-8 text-xs font-bold bg-white hover:bg-blue-50 border-slate-300 text-blue-800 gap-1"
          >
            <Save className="w-3.5 h-3.5 text-blue-600" />
            حفظ
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!isEditing && !isAdding}
            onClick={handleUndo}
            className="h-8 text-xs font-bold bg-white hover:bg-slate-100 border-slate-300 text-slate-700 gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            تراجع
          </Button>

          <div className="w-[1px] h-5 bg-slate-300 mx-0.5" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className={`h-8 text-xs font-bold gap-1 ${showSearch ? "bg-blue-100 border-blue-400 text-blue-900" : "bg-white border-slate-300 text-slate-800"}`}
          >
            <Search className="w-3.5 h-3.5 text-blue-600" />
            بحث
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchGroups();
              refetchUsers();
              toast({ title: "تم تحديث بيانات مجموعات المستخدمين" });
            }}
            className="h-8 text-xs font-bold bg-white border-slate-300 text-slate-800 gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
            تحديث
          </Button>

          {currentGroup && !isAdding && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPermsMut.mutate(currentGroup.id)}
              className="h-8 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800 gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              تعميم صلاحيات المجموعة ({currentGroup.users_count || 0})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-8 text-xs font-bold bg-white border-slate-300 text-slate-800 gap-1"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" />
            طباعة
          </Button>
        </div>

        {/* Navigation Arrows */}
        <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-300">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={selectedIndex <= 0}
            onClick={() => { setIsAdding(false); setIsEditing(false); setSelectedIndex(0); }}
            title="المجموعة الأولى"
          >
            <ChevronFirst className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={selectedIndex <= 0}
            onClick={() => { setIsAdding(false); setIsEditing(false); setSelectedIndex(i => Math.max(0, i - 1)); }}
            title="المجموعة السابقة"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[11px] font-bold font-mono px-2 text-slate-700">
            {filteredGroups.length > 0 ? `${selectedIndex + 1} / ${filteredGroups.length}` : "0 / 0"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={selectedIndex >= filteredGroups.length - 1}
            onClick={() => { setIsAdding(false); setIsEditing(false); setSelectedIndex(i => Math.min(filteredGroups.length - 1, i + 1)); }}
            title="المجموعة التالية"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={selectedIndex >= filteredGroups.length - 1}
            onClick={() => { setIsAdding(false); setIsEditing(false); setSelectedIndex(Math.max(0, filteredGroups.length - 1)); }}
            title="المجموعة الأخيرة"
          >
            <ChevronLast className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Optional Search Strip */}
      {showSearch && (
        <div className="bg-blue-50/70 border-b border-blue-200 px-4 py-2 flex items-center gap-3">
          <Search className="w-4 h-4 text-blue-700" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث برقم المجموعة أو اسم المجموعة بالعربية أو الاسم الأجنبي..."
            className="h-8 text-xs bg-white border-blue-300 max-w-md"
          />
          {searchTerm && (
            <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")} className="h-7 text-xs">
              مسح
            </Button>
          )}
        </div>
      )}

      {/* Upper Definition Form matching Image 2 ("مجموعة المستخدمين") */}
      <div className="p-4 bg-white border-b border-slate-300">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Right Side Fields: رقم المجموعة / اسم المجموعة / الاسم الأجنبي */}
          <div className="lg:col-span-7 space-y-2.5 bg-slate-50/80 p-3.5 rounded-md border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-3 text-xs font-bold text-slate-700">رقم المجموعة *</label>
              <div className="sm:col-span-4">
                <Input
                  type="number"
                  value={groupForm.group_number}
                  onChange={(e) => {
                    if (!isEditing && !isAdding) setIsEditing(true);
                    setGroupForm({ ...groupForm, group_number: Number(e.target.value) });
                  }}
                  className="h-8 text-xs font-mono font-bold bg-white border-slate-300 text-center"
                />
              </div>
              <div className="sm:col-span-5 flex items-center gap-2">
                {isAdding ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]">وضع إضافة مجموعة جديدة</Badge>
                ) : isEditing ? (
                  <Badge className="bg-amber-600 text-white text-[10px]">وضع التعديل النشط</Badge>
                ) : (
                  <Badge variant="outline" className="bg-white text-slate-600 border-slate-300 text-[10px]">
                    مستعرض المجموعة #{groupForm.group_number}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-3 text-xs font-bold text-slate-700">اسم المجموعة *</label>
              <div className="sm:col-span-9">
                <Input
                  value={groupForm.name_ar}
                  onChange={(e) => {
                    if (!isEditing && !isAdding) setIsEditing(true);
                    setGroupForm({ ...groupForm, name_ar: e.target.value });
                  }}
                  placeholder="مثال: مجموعة الإدارة العليا / مجموعة المحاسبين..."
                  className="h-8 text-xs font-bold bg-white border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-3 text-xs font-bold text-slate-700">الاسم الأجنبي</label>
              <div className="sm:col-span-9">
                <Input
                  value={groupForm.name_en}
                  onChange={(e) => {
                    if (!isEditing && !isAdding) setIsEditing(true);
                    setGroupForm({ ...groupForm, name_en: e.target.value });
                  }}
                  placeholder="e.g. Administrators Group"
                  dir="ltr"
                  className="h-8 text-xs font-mono bg-white border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Left Side Checkboxes matching Image 2: إدارة النظام & موقف (تاريخ التوقيف / سبب التوقيف) */}
          <div className="lg:col-span-5 space-y-2.5 bg-slate-50/80 p-3.5 rounded-md border border-slate-200">
            <div className="flex flex-wrap items-center gap-6 pb-2 border-b border-slate-200">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(groupForm.is_system_admin)}
                  onChange={(e) => toggleSystemAdmin(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-400 text-blue-700"
                />
                <span className="text-xs font-bold text-slate-800">إدارة النظام</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(groupForm.is_suspended)}
                  onChange={(e) => {
                    if (!isEditing && !isAdding) setIsEditing(true);
                    const checked = e.target.checked;
                    setGroupForm({
                      ...groupForm,
                      is_suspended: checked,
                      suspended_date: checked ? (groupForm.suspended_date || new Date().toISOString().slice(0, 10)) : ""
                    });
                  }}
                  className="w-4 h-4 rounded border-slate-400 text-red-600"
                />
                <span className="text-xs font-bold text-red-700">موقف</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-xs font-semibold text-slate-600">تاريخ التوقيف</label>
              <div className="sm:col-span-8">
                <Input
                  type="date"
                  disabled={!groupForm.is_suspended}
                  value={groupForm.suspended_date || ""}
                  onChange={(e) => {
                    if (!isEditing && !isAdding) setIsEditing(true);
                    setGroupForm({ ...groupForm, suspended_date: e.target.value });
                  }}
                  className="h-8 text-xs font-mono bg-white border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <label className="sm:col-span-4 text-xs font-semibold text-slate-600">سبب التوقيف</label>
              <div className="sm:col-span-8">
                <Input
                  disabled={!groupForm.is_suspended}
                  value={groupForm.suspended_reason || ""}
                  onChange={(e) => {
                    if (!isEditing && !isAdding) setIsEditing(true);
                    setGroupForm({ ...groupForm, suspended_reason: e.target.value });
                  }}
                  placeholder={groupForm.is_suspended ? "اذكر سبب إيقاف المجموعة..." : "—"}
                  className="h-8 text-xs bg-white border-slate-300"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Data Grid Table matching Image 2 (رقم المجموعة | اسم المجموعة | الاسم الأجنبي) */}
      <div className="bg-white border-b border-slate-300 max-h-[240px] overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-[#dce3ec] text-slate-800 border-b-2 border-slate-400">
            <tr>
              <th className="py-2 px-3 text-right font-bold border-l border-slate-300 w-28">رقم المجموعة</th>
              <th className="py-2 px-3 text-right font-bold border-l border-slate-300">اسم المجموعة</th>
              <th className="py-2 px-3 text-right font-bold border-l border-slate-300">الاسم الأجنبي</th>
              <th className="py-2 px-3 text-center font-bold border-l border-slate-300 w-28">إدارة النظام</th>
              <th className="py-2 px-3 text-center font-bold border-l border-slate-300 w-24">الحالة</th>
              <th className="py-2 px-3 text-center font-bold w-32">المستخدمين المرتبطين</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">جاري تحميل مجموعات المستخدمين...</td>
              </tr>
            ) : filteredGroups.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">لا توجد مجموعات مستخدمين معرفة</td>
              </tr>
            ) : (
              filteredGroups.map((grp: any, idx: number) => {
                const isSelected = idx === selectedIndex && !isAdding;
                return (
                  <tr
                    key={grp.id}
                    onClick={() => {
                      setIsAdding(false);
                      setIsEditing(false);
                      setSelectedIndex(idx);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#2b6cb0] text-white font-semibold"
                        : idx % 2 === 0
                        ? "bg-white hover:bg-blue-50/60 text-slate-800"
                        : "bg-slate-50/70 hover:bg-blue-50/60 text-slate-800"
                    }`}
                  >
                    <td className={`py-2 px-3 font-mono font-bold border-l ${isSelected ? "border-blue-400 text-white" : "border-slate-200 text-blue-900"}`}>
                      {grp.group_number}
                    </td>
                    <td className={`py-2 px-3 font-bold border-l ${isSelected ? "border-blue-400" : "border-slate-200"}`}>
                      {grp.name_ar}
                    </td>
                    <td className={`py-2 px-3 font-mono border-l ${isSelected ? "border-blue-400 text-blue-100" : "border-slate-200 text-slate-600"}`} dir="ltr">
                      {grp.name_en || "—"}
                    </td>
                    <td className={`py-2 px-3 text-center border-l ${isSelected ? "border-blue-400" : "border-slate-200"}`}>
                      {grp.is_system_admin ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isSelected ? "bg-amber-400 text-slate-900" : "bg-amber-100 text-amber-900 border border-amber-300"}`}>
                          إدارة النظام
                        </span>
                      ) : (
                        <span className={`text-[10px] ${isSelected ? "text-blue-200" : "text-slate-400"}`}>صلاحيات مخصصة</span>
                      )}
                    </td>
                    <td className={`py-2 px-3 text-center border-l ${isSelected ? "border-blue-400" : "border-slate-200"}`}>
                      {grp.is_suspended ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isSelected ? "bg-red-500 text-white" : "bg-red-100 text-red-800 border border-red-300"}`}>
                          موقف
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-800 border border-emerald-300"}`}>
                          نشط
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold">
                      {grp.users_count || 0} مستخدم
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Group Permissions & User Linking Dual Section */}
      <div className="p-4 bg-slate-50 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Right Panel: صلاحيات المجموعة (Group-Level Permissions) */}
        <div className="lg:col-span-7 bg-white border border-slate-300 rounded-md p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-700" />
                <span>صلاحيات المجموعة: {groupForm.name_ar || "مجموعة جديدة"}</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                تُمنح هذه الصلاحيات تلقائياً لكل مستخدم يتم ربطه بهذه المجموعة
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 text-[11px] bg-blue-700 hover:bg-blue-800 text-white gap-1"
            >
              <Save className="w-3 h-3" />
              حفظ وتعميم الصلاحيات
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {[
              { key: "perm_create_invoice", label: "إصدار الفواتير وحجوزات السفر والطيران" },
              { key: "perm_edit_invoice", label: "تعديل الفواتير والحجوزات السياحية" },
              { key: "perm_cancel_invoice", label: "إلغاء وحذف الفواتير والتذاكر" },
              { key: "perm_return", label: "معالجة استرجاع التذاكر والمرتجعات" },
              { key: "can_discount", label: "منح الخصم المباشر في الفواتير (POS)" },
              { key: "perm_view_prices", label: "عرض أسعار التكلفة والتذاكر الموردة" },
              { key: "perm_view_profits", label: "عرض أرباح الحجوزات والعمولات الحساسة" },
              { key: "perm_edit_stock", label: "تعديل وخدمة عهد المستندات والمخازن" },
              { key: "perm_stocktake", label: "القيام بجرد وتدقيق المخازن والوثائق" },
              { key: "perm_edit_entries", label: "إنشاء وتعديل القيود والسندات المحاسبية" },
              { key: "perm_close_periods", label: "إغلاق وتقفيل تسويات الـ BSP والفترات" },
              { key: "perm_view_salaries", label: "الاطلاع على رواتب وعمولات الموظفين" }
            ].map((perm) => (
              <label
                key={perm.key}
                className="flex items-center justify-between p-2 rounded border border-slate-200 bg-slate-50/60 hover:bg-blue-50/40 cursor-pointer"
              >
                <span className="text-[11px] font-semibold text-slate-700">{perm.label}</span>
                <Switch
                  checked={Boolean(groupForm.is_system_admin || groupForm[perm.key])}
                  disabled={Boolean(groupForm.is_system_admin)}
                  onCheckedChange={(val) => {
                    if (!isEditing && !isAdding) setIsEditing(true);
                    setGroupForm({ ...groupForm, [perm.key]: val });
                  }}
                />
              </label>
            ))}
          </div>

          <div className="p-2.5 bg-blue-50/50 border border-blue-200 rounded space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-800">صلاحيات أزرار آخر فاتورة في نقطة المبيعات (للمجموعة)</div>
                <div className="text-[10px] text-slate-500">تُطبّق على كافة المستخدمين المرتبطين بهذه المجموعة</div>
              </div>
              <select
                value={groupForm.perm_last_invoice_reprint || "all"}
                onChange={(e) => {
                  if (!isEditing && !isAdding) setIsEditing(true);
                  setGroupForm({ ...groupForm, perm_last_invoice_reprint: e.target.value });
                }}
                className="h-8 px-2 bg-white border border-blue-300 rounded text-xs font-semibold text-blue-900 min-w-[260px]"
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

        {/* Left Panel: ربط المستخدمين بالمجموعة (Linking Users to this Group) */}
        <div className="lg:col-span-5 bg-white border border-slate-300 rounded-md p-3.5 flex flex-col justify-between space-y-3 shadow-2xs">
          <div className="space-y-3">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-700" />
                <span>المستخدمون المرتبطون بالمجموعة ({currentGroup?.linked_users?.length || 0})</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                ربط المستخدم بالمجموعة يمنحه كافة صلاحيات المجموعة فور الربط
              </p>
            </div>

            {currentGroup && !isAdding && (
              <div className="flex gap-1.5">
                <select
                  value={userToLink}
                  onChange={(e) => setUserToLink(e.target.value)}
                  className="flex-1 h-8 rounded border border-slate-300 bg-slate-50 px-2 text-xs font-semibold"
                >
                  <option value="">-- اختر مستخدماً لربطه بهذه المجموعة --</option>
                  {allUsers
                    .filter((u: any) => u.group_id !== currentGroup.id && u.role !== "developer")
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} (@{u.username}) {u.group_name ? `[حالياً: ${u.group_name}]` : ""}
                      </option>
                    ))}
                </select>
                <Button
                  size="sm"
                  disabled={!userToLink}
                  onClick={() => {
                    if (!userToLink || !currentGroup) return;
                    linkUserMut.mutate({ groupId: currentGroup.id, userId: Number(userToLink) });
                  }}
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1 shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  ربط بالمجموعة
                </Button>
              </div>
            )}

            <div className="border border-slate-200 rounded max-h-[210px] overflow-y-auto divide-y divide-slate-100">
              {(!currentGroup?.linked_users || currentGroup.linked_users.length === 0) ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  لا يوجد مستخدمون مرتبطون بهذه المجموعة حالياً
                </div>
              ) : (
                currentGroup.linked_users.map((u: any) => (
                  <div key={u.id} className="p-2 flex items-center justify-between hover:bg-slate-50 text-xs">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <div>
                        <div className="font-bold text-slate-800">{u.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">@{u.username}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                        مرتبط بالمجموعة
                      </Badge>
                      <button
                        type="button"
                        onClick={() => unlinkUserMut.mutate({ groupId: currentGroup.id, userId: u.id })}
                        className="p-1 rounded hover:bg-red-50 text-red-600"
                        title="فك ارتباط المستخدم من المجموعة"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px] text-blue-900">
            <strong>ملاحظة التكامل:</strong> عند تعديل صلاحيات هذه المجموعة والضغط على "حفظ"، يقوم النظام آلياً بتحديث صلاحيات جميع المستخدمين المرتبطين بها دون الحاجة لتعديل كل مستخدم على حدة.
          </div>
        </div>
      </div>

      {/* Classic Onyx ERP Audit Footer Bar (matching Image 2) */}
      <div className="bg-[#e2e7ee] border-t-2 border-slate-300 px-3 py-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px] text-slate-700">
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">أدخلت بواسطة:</span>
          <span className="font-bold text-slate-800 truncate">{currentGroup?.created_by || "مدير النظام"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">تاريخ الإدخال:</span>
          <span className="font-mono text-slate-800 truncate" dir="ltr">{currentGroup?.created_at || "18/07/2026 07:30:00"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">عدلت بواسطة:</span>
          <span className="font-bold text-slate-800 truncate">{currentGroup?.updated_by || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">تاريخ التعديل:</span>
          <span className="font-mono text-slate-800 truncate" dir="ltr">{currentGroup?.updated_at || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300 col-span-2 md:col-span-1">
          <span className="text-slate-500 font-semibold">مرات التعديل:</span>
          <span className="font-mono font-bold text-blue-700">{currentGroup?.edit_count ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

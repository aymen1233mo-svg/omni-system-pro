import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Edit2, RotateCcw, RefreshCw, Printer, Search,
  ChevronFirst, ChevronLast, ChevronRight, ChevronLeft,
  ShieldCheck, Shield, Users, Layers, CheckSquare, Square,
  FolderTree, Folder, FolderOpen, FileText, Check, Copy,
  CheckCircle2, XCircle, ArrowRightLeft, Lock, Unlock, Eye, Sparkles
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

interface ScreenRow {
  screen_number: number;
  screen_name: string;
  module_name: string;
  submodule_name?: string;
  category_type?: string;
  can_check: boolean;       // فحص / إتاحة الشاشة
  can_print: boolean;       // طباعة
  can_view_report: boolean; // عرض التقرير
  can_add: boolean;         // إضافة
  can_edit: boolean;        // تعديل
  can_delete: boolean;      // حذف
  can_view: boolean;        // عرض
  can_review: boolean;      // مراجعة
  can_post: boolean;        // ترحيل
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}

export function ErpScreenPermissionsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Fetch Users List
  const { data: users = [] } = useQuery({
    queryKey: ["users-list-for-perms"],
    queryFn: () => apiGet("/api/users")
  });

  const [selectedUserIndex, setSelectedUserIndex] = useState(0);
  const currentUser = users[selectedUserIndex] || null;

  // 2. Fetch Selected User Screen Permissions
  const { data: userPermsData, isLoading: permsLoading, refetch } = useQuery({
    queryKey: ["user-screen-perms", currentUser?.id],
    queryFn: () => apiGet(`/api/users/${currentUser.id}/screen-permissions`),
    enabled: !!currentUser?.id
  });

  const [screensList, setScreensList] = useState<ScreenRow[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [sourceUserId, setSourceUserId] = useState<string>("");

  // Sync state when backend returns data
  useEffect(() => {
    if (userPermsData?.screens) {
      setScreensList(userPermsData.screens);
    }
  }, [userPermsData]);

  // Tree nodes definition matching Onyx ERP structure from image
  const treeNodes = useMemo(() => {
    return [
      { id: "all", label: "عرض جميع أنظمة وشاشات البرنامج", level: 0 },
      { id: "تهيئة النظام", label: "تهيئة النظام", level: 0 },
      { id: "إدارة النظام", label: "إدارة النظام والأمان", level: 0 },
      {
        id: "أنظمة الحسابات", label: "أنظمة الحسابات", level: 0,
        children: [
          {
            id: "نظام الأستاذ العام", label: "نظام الأستاذ العام", level: 1,
            children: [
              { id: "تهيئة الأستاذ العام", label: "تهيئة الأستاذ العام", level: 2 },
              { id: "مدخلات الأستاذ العام", label: "مدخلات الأستاذ العام", level: 2 },
              { id: "عمليات الأستاذ العام", label: "عمليات الأستاذ العام", level: 2 },
              { id: "تقارير الأستاذ العام", label: "تقارير الأستاذ العام", level: 2 },
            ]
          },
          { id: "نظام إدارة المراجعة والترحيلات", label: "نظام إدارة المراجعة والترحيلات", level: 1 },
        ]
      },
      { id: "أنظمة المخازن", label: "أنظمة المخازن", level: 0 },
      { id: "أنظمة العملاء ونقاط البيع", label: "أنظمة العملاء ونقاط البيع", level: 0 },
      { id: "أنظمة الموردين والمشتريات", label: "أنظمة الموردين والمشتريات", level: 0 },
      { id: "أنظمة رأس المال البشري", label: "أنظمة رأس المال البشري", level: 0 },
    ];
  }, []);

  // Preset Applicator
  const applyPreset = (presetType: "gm" | "cashier" | "accountant" | "storekeeper") => {
    if (!isEditing) setIsEditing(true);
    setScreensList(prev =>
      prev.map(s => {
        // Screen 900 is strictly for developer
        if (s.screen_number === 900) {
          return {
            ...s,
            can_check: false,
            can_print: false,
            can_view_report: false,
            can_add: false,
            can_edit: false,
            can_delete: false,
            can_view: false,
            can_review: false,
            can_post: false,
          };
        }

        if (presetType === "gm") {
          // General Manager gets all system screens EXCEPT 900
          return {
            ...s,
            can_check: true,
            can_print: true,
            can_view_report: true,
            can_add: true,
            can_edit: true,
            can_delete: true,
            can_view: true,
            can_review: true,
            can_post: true,
          };
        }

        if (presetType === "cashier") {
          // POS Cashier screens
          const isPosScreen = s.screen_number === 50 || s.screen_number === 51 || s.screen_number === 53 || s.screen_number === 55 || s.screen_number === 56 || s.screen_number === 57;
          return {
            ...s,
            can_check: isPosScreen,
            can_print: isPosScreen,
            can_view_report: false,
            can_add: isPosScreen,
            can_edit: false,
            can_delete: false,
            can_view: isPosScreen,
            can_review: false,
            can_post: false,
          };
        }

        if (presetType === "accountant") {
          // Accountant screens
          const isAccScreen = (s.screen_number >= 1 && s.screen_number <= 42) || (s.screen_number >= 70 && s.screen_number <= 75) || (s.screen_number >= 50 && s.screen_number <= 57);
          return {
            ...s,
            can_check: isAccScreen,
            can_print: isAccScreen,
            can_view_report: isAccScreen,
            can_add: isAccScreen,
            can_edit: isAccScreen,
            can_delete: false,
            can_view: isAccScreen,
            can_review: isAccScreen,
            can_post: isAccScreen,
          };
        }

        if (presetType === "storekeeper") {
          // Storekeeper screens
          const isStoreScreen = (s.screen_number >= 60 && s.screen_number <= 65) || (s.screen_number >= 70 && s.screen_number <= 74);
          return {
            ...s,
            can_check: isStoreScreen,
            can_print: isStoreScreen,
            can_view_report: isStoreScreen,
            can_add: isStoreScreen,
            can_edit: isStoreScreen,
            can_delete: false,
            can_view: isStoreScreen,
            can_review: false,
            can_post: false,
          };
        }

        return s;
      })
    );
    toast({
      title: "تم تطبيق القالب بنجاح",
      description: "تم تحديث الصلاحيات في الجدول، اضغط على (حفظ التعديلات) لاعتمادها."
    });
  };

  // Filtered screens for the grid
  const displayedScreens = useMemo(() => {
    return screensList.filter(s => {
      // Tree Filter
      let matchesTree = true;
      if (selectedNode !== "all") {
        matchesTree = (
          s.module_name === selectedNode ||
          s.submodule_name === selectedNode ||
          (selectedNode === "أنظمة الحسابات" && (s.module_name?.includes("الأستاذ") || s.module_name?.includes("الحسابات") || s.module_name?.includes("الترحيلات")))
        );
      }

      // Search Filter
      let matchesSearch = true;
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        matchesSearch = (
          s.screen_name.toLowerCase().includes(q) ||
          String(s.screen_number).includes(q) ||
          (s.module_name || "").toLowerCase().includes(q) ||
          (s.submodule_name || "").toLowerCase().includes(q)
        );
      }

      return matchesTree && matchesSearch;
    });
  }, [screensList, selectedNode, searchFilter]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiPut(`/api/users/${currentUser.id}/screen-permissions`, {
        screens: screensList
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-screen-perms", currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["me-screen-perms"] });
      queryClient.invalidateQueries({ queryKey: ["users-master-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-users"] });
      toast({
        title: "تم حفظ صلاحيات الشاشات بنجاح ✅",
        description: `تم تحديث جدول صلاحيات الشاشات للمستخدم (${currentUser.name}) وتطبيقها فورياً على حسابه.`
      });
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast({
        title: "خطأ أثناء الحفظ",
        description: err.message || "تعذر حفظ صلاحيات الشاشات",
        variant: "destructive"
      });
    }
  });

  // Copy Permissions Mutation
  const copyMutation = useMutation({
    mutationFn: async (srcId: number) => {
      return apiPost(`/api/users/${currentUser.id}/screen-permissions/copy-from`, {
        source_user_id: srcId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-screen-perms", currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["me-screen-perms"] });
      queryClient.invalidateQueries({ queryKey: ["users-master-list"] });
      queryClient.invalidateQueries({ queryKey: ["get-users"] });
      toast({
        title: "تم نسخ الصلاحيات بنجاح ✅",
        description: `تم استنساخ صلاحيات الشاشات للمستخدم (${currentUser.name}).`
      });
      setShowCopyModal(false);
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في النسخ",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  const isTargetDeveloper = currentUser?.username === "developer" || currentUser?.role === "developer";

  // Toggle single cell
  const handleCellToggle = (screenNumber: number, field: keyof ScreenRow) => {
    if (!isEditing) return;
    if (screenNumber === 900 && !isTargetDeveloper) {
      toast({
        title: "صلاحية محظورة",
        description: "شاشة التراخيص والمطور مخصصة لحساب المطور الرئيسي فقط ولا يمكن منحها لأي مستخدم آخر.",
        variant: "destructive"
      });
      return;
    }
    setScreensList(prev =>
      prev.map(s => {
        if (s.screen_number === screenNumber) {
          const newVal = !s[field];
          if (field === "can_check" && newVal === true) {
            // If turning on check and other permissions are all false, turn on view/add/edit/print
            const hasAny = s.can_view || s.can_add || s.can_edit || s.can_print || s.can_view_report;
            return {
              ...s,
              can_check: true,
              can_view: hasAny ? s.can_view : true,
              can_add: hasAny ? s.can_add : true,
              can_edit: hasAny ? s.can_edit : true,
              can_print: hasAny ? s.can_print : true,
            };
          }
          return { ...s, [field]: newVal };
        }
        return s;
      })
    );
  };

  // Toggle entire row
  const handleRowToggle = (screenNumber: number, enable: boolean) => {
    if (!isEditing) return;
    if (screenNumber === 900 && !isTargetDeveloper) {
      toast({
        title: "صلاحية محظورة",
        description: "شاشة التراخيص والمطور مخصصة للمطور فقط.",
        variant: "destructive"
      });
      return;
    }
    setScreensList(prev =>
      prev.map(s => {
        if (s.screen_number === screenNumber) {
          return {
            ...s,
            can_check: enable,
            can_print: enable,
            can_view_report: enable,
            can_add: enable,
            can_edit: enable,
            can_delete: enable,
            can_view: enable,
            can_review: enable,
            can_post: enable,
          };
        }
        return s;
      })
    );
  };

  // Master Column Toggle (تحديد الكل / إلغاء تحديد الكل للعمود بالكامل)
  const handleColumnMasterToggle = (field: keyof ScreenRow) => {
    if (!isEditing) return;
    const toggleableScreens = displayedScreens.filter(s => isTargetDeveloper || s.screen_number !== 900);
    const allChecked = toggleableScreens.every(s => Boolean(s[field]));
    const targetVal = !allChecked;

    const visibleScreenNumbers = new Set(displayedScreens.map(s => s.screen_number));

    setScreensList(prev =>
      prev.map(s => {
        if (s.screen_number === 900 && !isTargetDeveloper) {
          return {
            ...s,
            can_check: false,
            can_print: false,
            can_view_report: false,
            can_add: false,
            can_edit: false,
            can_delete: false,
            can_view: false,
            can_review: false,
            can_post: false,
          };
        }
        if (visibleScreenNumbers.has(s.screen_number)) {
          return { ...s, [field]: targetVal };
        }
        return s;
      })
    );
  };

  // Check all / Uncheck all visible screens
  const handleToggleAllVisible = (targetState: boolean) => {
    if (!isEditing) return;
    const visibleSet = new Set(displayedScreens.map(s => s.screen_number));
    setScreensList(prev =>
      prev.map(s => {
        if (s.screen_number === 900 && !isTargetDeveloper) {
          return {
            ...s,
            can_check: false,
            can_print: false,
            can_view_report: false,
            can_add: false,
            can_edit: false,
            can_delete: false,
            can_view: false,
            can_review: false,
            can_post: false,
          };
        }
        if (visibleSet.has(s.screen_number)) {
          return {
            ...s,
            can_check: targetState,
            can_print: targetState,
            can_view_report: targetState,
            can_add: targetState,
            can_edit: targetState,
            can_delete: targetState,
            can_view: targetState,
            can_review: targetState,
            can_post: targetState,
          };
        }
        return s;
      })
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f6f9] border border-slate-300 rounded-lg shadow overflow-hidden text-slate-800 font-sans" dir="rtl">
      {/* ─── Top Main Onyx ERP Toolbar ─── */}
      <div className="bg-gradient-to-b from-[#2b5876] to-[#1e3c72] text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-1.5 rounded text-amber-300 border border-white/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide">صلاحيات استخدام الشاشات للمستخدمين</h2>
            <p className="text-[11px] text-blue-200">التحكم الدقيق بصلاحيات الوصول، الإضافة، التعديل، الحذف، الطباعة، المراجعة والترحيل</p>
          </div>
        </div>

        {/* User Selector Dropdown & Navigation Bar */}
        <div className="flex items-center gap-2 bg-white/10 px-2.5 py-1 rounded border border-white/20">
          <span className="text-xs font-bold text-amber-200">رقم المستخدم:</span>
          <select
            disabled={isEditing}
            value={currentUser?.id || ""}
            onChange={e => {
              const idx = users.findIndex((u: any) => u.id === Number(e.target.value));
              if (idx !== -1) setSelectedUserIndex(idx);
            }}
            className="h-7 px-2 bg-white text-slate-900 font-bold rounded text-xs focus:ring-1 focus:ring-amber-400 border-0"
          >
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.user_number || u.id} - {u.name} ({u.role})
              </option>
            ))}
          </select>

          {/* User Nav Arrows */}
          <div className="flex items-center gap-0.5 border-r border-white/20 pr-1.5 mr-1">
            <button
              type="button"
              disabled={selectedUserIndex === 0 || isEditing}
              onClick={() => setSelectedUserIndex(0)}
              className="p-1 rounded hover:bg-white/20 disabled:opacity-30"
              title="المستخدم الأول"
            >
              <ChevronFirst className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={selectedUserIndex === 0 || isEditing}
              onClick={() => setSelectedUserIndex(prev => Math.max(0, prev - 1))}
              className="p-1 rounded hover:bg-white/20 disabled:opacity-30"
              title="المستخدم السابق"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1">
              {users.length > 0 ? `${selectedUserIndex + 1}/${users.length}` : "0"}
            </span>
            <button
              type="button"
              disabled={selectedUserIndex >= users.length - 1 || isEditing}
              onClick={() => setSelectedUserIndex(prev => Math.min(users.length - 1, prev + 1))}
              className="p-1 rounded hover:bg-white/20 disabled:opacity-30"
              title="المستخدم التالي"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={selectedUserIndex >= users.length - 1 || isEditing}
              onClick={() => setSelectedUserIndex(users.length - 1)}
              className="p-1 rounded hover:bg-white/20 disabled:opacity-30"
              title="المستخدم الأخير"
            >
              <ChevronLast className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-md border border-white/10">
          {!isEditing ? (
            <Button
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-7 px-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" />
              تعديل الصلاحيات
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                حفظ التعديلات
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => { setIsEditing(false); refetch(); }}
                className="h-7 px-2 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                إلغاء
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCopyModal(true)}
            disabled={isEditing}
            className="h-7 px-2 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs gap-1"
            title="نسخ الصلاحيات من مستخدم آخر"
          >
            <Copy className="w-3.5 h-3.5" />
            نسخ الصلاحيات
          </Button>

          {isEditing && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggleAllVisible(true)}
                className="h-7 px-2 bg-emerald-800/80 hover:bg-emerald-700 text-white border-emerald-500 text-xs gap-1"
                title="تحديد كامل الشاشات الظاهرة"
              >
                <CheckSquare className="w-3 h-3" />
                تحديد الكل
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggleAllVisible(false)}
                className="h-7 px-2 bg-red-900/80 hover:bg-red-800 text-white border-red-500 text-xs gap-1"
                title="إلغاء تحديد كل الشاشات الظاهرة"
              >
                <Square className="w-3 h-3" />
                إلغاء الكل
              </Button>
            </>
          )}

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

      {/* ─── Main Two-Column Layout (Matching Onyx ERP Split) ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* RIGHT COLUMN: Modules and Screens Tree Hierarchy */}
        <div className="w-64 bg-[#f8fafc] border-l border-slate-300 flex flex-col shrink-0">
          <div className="p-2.5 bg-[#e2e8f0] border-b border-slate-300 font-bold text-xs text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FolderTree className="w-4 h-4 text-blue-800" />
              دليل وشجرة أنظمة وشاشات البرنامج
            </span>
          </div>

          <div className="p-2 border-b bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
              <Input
                type="text"
                placeholder="بحث في الشاشات..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="h-7 pr-8 text-xs bg-slate-50 border-slate-300"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
            {treeNodes.map((node) => {
              const isSelected = selectedNode === node.id;
              return (
                <div key={node.id} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedNode(node.id)}
                    className={`w-full text-right px-2 py-1.5 rounded flex items-center justify-between text-xs font-semibold transition-colors ${
                      isSelected
                        ? "bg-blue-700 text-white shadow-xs"
                        : "text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {isSelected ? <FolderOpen className="w-3.5 h-3.5 text-amber-300 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      <span className="truncate">{node.label}</span>
                    </span>
                  </button>

                  {/* Level 1 / 2 Children */}
                  {node.children && (
                    <div className="pr-3 space-y-0.5 border-r border-slate-300 mr-2">
                      {node.children.map((child: any) => {
                        const isChildSel = selectedNode === child.id;
                        return (
                          <div key={child.id} className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedNode(child.id)}
                              className={`w-full text-right px-2 py-1 rounded flex items-center justify-between text-[11px] font-medium transition-colors ${
                                isChildSel
                                  ? "bg-blue-600 text-white"
                                  : "text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              <span className="flex items-center gap-1 truncate">
                                <span>▸</span>
                                <span className="truncate">{child.label}</span>
                              </span>
                            </button>

                            {/* Sub-children */}
                            {child.children && (
                              <div className="pr-3 space-y-0.5 border-r border-blue-200 mr-1.5">
                                {child.children.map((sub: any) => {
                                  const isSubSel = selectedNode === sub.id;
                                  return (
                                    <button
                                      key={sub.id}
                                      type="button"
                                      onClick={() => setSelectedNode(sub.id)}
                                      className={`w-full text-right px-2 py-1 rounded flex items-center justify-between text-[11px] transition-colors ${
                                        isSubSel
                                          ? "bg-blue-800 text-white font-bold"
                                          : "text-slate-600 hover:bg-blue-50"
                                      }`}
                                    >
                                      <span className="truncate">• {sub.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-2 bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600 font-medium">
            الشاشات المعروضة: <strong className="text-blue-800">{displayedScreens.length}</strong> من أصل <strong className="text-slate-800">{screensList.length}</strong>
          </div>
        </div>

        {/* LEFT / CENTER COLUMN: The Classic Permissions Table */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Status and Active Category Banner */}
          <div className="bg-[#f0f4f8] px-3 py-1.5 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <span className="text-blue-900 font-bold">القسم النشط:</span>
              <Badge variant="outline" className="bg-white border-blue-300 text-blue-800 font-bold">
                {selectedNode === "all" ? "جميع الشاشات" : selectedNode}
              </Badge>
              {isEditing ? (
                <Badge className="bg-amber-500 text-white text-[10px]">وضع التعديل مفعل</Badge>
              ) : (
                <Badge variant="outline" className="text-slate-500 text-[10px]">وضع المعاينة (اضغط تعديل للتغيير)</Badge>
              )}
            </div>

            {/* Quick Presets for Admin */}
            {isEditing && (
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-300 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500">قوالب سريعة:</span>
                <button
                  type="button"
                  onClick={() => applyPreset("gm")}
                  className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-800 border border-blue-200 rounded hover:bg-blue-100 font-bold"
                  title="منح كامل صلاحيات النظام ما عدا شاشة المطور"
                >
                  مدير عام
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("cashier")}
                  className="px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded hover:bg-emerald-100 font-bold"
                  title="صلاحيات نقاط البيع والكاشير فقط"
                >
                  كاشير POS
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("accountant")}
                  className="px-2 py-0.5 text-[10px] bg-purple-50 text-purple-800 border border-purple-200 rounded hover:bg-purple-100 font-bold"
                  title="صلاحيات الحسابات والقيود والتقارير المالية"
                >
                  محاسب مالي
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("storekeeper")}
                  className="px-2 py-0.5 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded hover:bg-amber-100 font-bold"
                  title="صلاحيات المخازن والمشتريات"
                >
                  أمين مستودع
                </button>
              </div>
            )}

            <div className="text-[11px] text-slate-500 font-medium">
              المستخدم: <strong className="text-slate-800">{currentUser?.name}</strong> | الدور: <strong className="text-blue-700">{currentUser?.role}</strong>
            </div>
          </div>

          {/* Table Matrix */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-[#dde4ed] text-slate-800 sticky top-0 z-10 border-b-2 border-slate-400 select-none shadow-xs">
                <tr>
                  <th className="p-2 text-center border-l border-slate-300 w-16">رقم الشاشة</th>
                  <th className="p-2 text-right border-l border-slate-300 min-w-[180px]">اسم الشاشة</th>
                  
                  {/* Master Checkbox Columns */}
                  <th className="p-1.5 text-center border-l border-slate-300 w-16 bg-blue-50/50">
                    <div
                      onClick={() => handleColumnMasterToggle("can_check")}
                      className={`cursor-pointer flex flex-col items-center gap-0.5 hover:text-blue-900 ${isEditing ? "hover:bg-blue-100 rounded" : ""}`}
                      title="فحص / إتاحة الشاشة للمستخدم"
                    >
                      <span className="font-bold text-blue-950">فحص</span>
                      <span className="text-[9px] text-slate-500">(Check)</span>
                    </div>
                  </th>

                  <th className="p-1.5 text-center border-l border-slate-300 w-14">
                    <div
                      onClick={() => handleColumnMasterToggle("can_print")}
                      className={`cursor-pointer flex flex-col items-center gap-0.5 ${isEditing ? "hover:bg-slate-200 rounded" : ""}`}
                      title="صلاحية الطباعة"
                    >
                      <span className="font-bold">طباعة</span>
                      <span className="text-[9px] text-slate-500">(Print)</span>
                    </div>
                  </th>

                  <th className="p-1.5 text-center border-l border-slate-300 w-16">
                    <div
                      onClick={() => handleColumnMasterToggle("can_view_report")}
                      className={`cursor-pointer flex flex-col items-center gap-0.5 ${isEditing ? "hover:bg-slate-200 rounded" : ""}`}
                      title="عرض التقرير"
                    >
                      <span className="font-bold text-indigo-950">عرض التقرير</span>
                      <span className="text-[9px] text-slate-500">(Report)</span>
                    </div>
                  </th>

                  <th className="p-1.5 text-center border-l border-slate-300 w-14 bg-emerald-50/30">
                    <div
                      onClick={() => handleColumnMasterToggle("can_add")}
                      className={`cursor-pointer flex flex-col items-center gap-0.5 ${isEditing ? "hover:bg-emerald-100 rounded" : ""}`}
                      title="صلاحية الإضافة"
                    >
                      <span className="font-bold text-emerald-950">إضافة</span>
                      <span className="text-[9px] text-slate-500">(Add)</span>
                    </div>
                  </th>

                  <th className="p-1.5 text-center border-l border-slate-300 w-14 bg-amber-50/30">
                    <div
                      onClick={() => handleColumnMasterToggle("can_edit")}
                      className={`cursor-pointer flex flex-col items-center gap-0.5 ${isEditing ? "hover:bg-amber-100 rounded" : ""}`}
                      title="صلاحية التعديل"
                    >
                      <span className="font-bold text-amber-950">تعديل</span>
                      <span className="text-[9px] text-slate-500">(Edit)</span>
                    </div>
                  </th>

                  <th className="p-1.5 text-center border-l border-slate-300 w-14 bg-red-50/30">
                    <div
                      onClick={() => handleColumnMasterToggle("can_delete")}
                      className={`cursor-pointer flex flex-col items-center gap-0.5 ${isEditing ? "hover:bg-red-100 rounded" : ""}`}
                      title="صلاحية الحذف"
                    >
                      <span className="font-bold text-red-950">حذف</span>
                      <span className="text-[9px] text-slate-500">(Delete)</span>
                    </div>
                  </th>

                  <th className="p-1.5 text-center border-l border-slate-300 w-14">
                    <div
                      onClick={() => handleColumnMasterToggle("can_view")}
                      className={`cursor-pointer flex flex-col items-center gap-0.5 ${isEditing ? "hover:bg-slate-200 rounded" : ""}`}
                      title="صلاحية العرض"
                    >
                      <span className="font-bold">عرض</span>
                      <span className="text-[9px] text-slate-500">(View)</span>
                    </div>
                  </th>

                  <th className="p-1.5 text-center border-l border-slate-300 w-14 bg-purple-50/30">
                    <div
                      onClick={() => handleColumnMasterToggle("can_review")}
                      className={`cursor-pointer flex flex-col items-center gap-0.5 ${isEditing ? "hover:bg-purple-100 rounded" : ""}`}
                      title="صلاحية المراجعة والتدقيق"
                    >
                      <span className="font-bold text-purple-950">مراجعة</span>
                      <span className="text-[9px] text-slate-500">(Review)</span>
                    </div>
                  </th>

                  <th className="p-1.5 text-center border-l border-slate-300 w-14 bg-teal-50/30">
                    <div
                      onClick={() => handleColumnMasterToggle("can_post")}
                      className={`cursor-pointer flex flex-col items-center gap-0.5 ${isEditing ? "hover:bg-teal-100 rounded" : ""}`}
                      title="صلاحية الترحيل والاعتماد"
                    >
                      <span className="font-bold text-teal-950">ترحيل</span>
                      <span className="text-[9px] text-slate-500">(Post)</span>
                    </div>
                  </th>

                  {isEditing && <th className="p-1.5 text-center w-12">تحكم</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {displayedScreens.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400">
                      لا توجد شاشات مطابقة للبحث أو القسم المختار.
                    </td>
                  </tr>
                ) : (
                  displayedScreens.map((row) => {
                    const isDevOnlyRow = row.screen_number === 900 && !isTargetDeveloper;
                    const isChecked = isDevOnlyRow ? false : row.can_check;
                    return (
                      <tr
                        key={row.screen_number}
                        className={`transition-colors ${
                          isDevOnlyRow
                            ? "bg-red-50/40 text-slate-400"
                            : !isChecked
                            ? "bg-slate-50/70 text-slate-400 hover:bg-blue-50/60"
                            : "hover:bg-blue-50/60"
                        }`}
                      >
                        {/* Screen Number */}
                        <td className="p-2 text-center font-mono font-bold text-slate-700 border-l border-slate-200 bg-slate-50">
                          {row.screen_number}
                        </td>

                        {/* Screen Name */}
                        <td className="p-2 text-right font-bold text-slate-900 border-l border-slate-200">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={isChecked ? "text-slate-900" : "text-slate-400 line-through"}>
                              {row.screen_name}
                            </span>
                            {row.submodule_name && (
                              <span className="text-[10px] font-normal text-slate-400">({row.submodule_name})</span>
                            )}
                            {row.screen_number === 900 && (
                              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-[9px] gap-1 px-1.5 py-0">
                                <Lock className="w-2.5 h-2.5" />
                                صلاحية المطور فقط (ممنوع)
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* 1. فحص (can_check) */}
                        <td className="p-1.5 text-center border-l border-slate-200 bg-blue-50/20">
                          <input
                            type="checkbox"
                            disabled={!isEditing || isDevOnlyRow}
                            checked={isChecked}
                            onChange={() => handleCellToggle(row.screen_number, "can_check")}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* 2. طباعة (can_print) */}
                        <td className="p-1.5 text-center border-l border-slate-200">
                          <input
                            type="checkbox"
                            disabled={!isEditing || !isChecked || isDevOnlyRow}
                            checked={row.can_print && isChecked}
                            onChange={() => handleCellToggle(row.screen_number, "can_print")}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* 3. عرض التقرير (can_view_report) */}
                        <td className="p-1.5 text-center border-l border-slate-200 bg-indigo-50/20">
                          <input
                            type="checkbox"
                            disabled={!isEditing || !isChecked || isDevOnlyRow}
                            checked={row.can_view_report && isChecked}
                            onChange={() => handleCellToggle(row.screen_number, "can_view_report")}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* 4. إضافة (can_add) */}
                        <td className="p-1.5 text-center border-l border-slate-200 bg-emerald-50/20">
                          <input
                            type="checkbox"
                            disabled={!isEditing || !isChecked || isDevOnlyRow}
                            checked={row.can_add && isChecked}
                            onChange={() => handleCellToggle(row.screen_number, "can_add")}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* 5. تعديل (can_edit) */}
                        <td className="p-1.5 text-center border-l border-slate-200 bg-amber-50/20">
                          <input
                            type="checkbox"
                            disabled={!isEditing || !isChecked || isDevOnlyRow}
                            checked={row.can_edit && isChecked}
                            onChange={() => handleCellToggle(row.screen_number, "can_edit")}
                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* 6. حذف (can_delete) */}
                        <td className="p-1.5 text-center border-l border-slate-200 bg-red-50/20">
                          <input
                            type="checkbox"
                            disabled={!isEditing || !isChecked || isDevOnlyRow}
                            checked={row.can_delete && isChecked}
                            onChange={() => handleCellToggle(row.screen_number, "can_delete")}
                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* 7. عرض (can_view) */}
                        <td className="p-1.5 text-center border-l border-slate-200">
                          <input
                            type="checkbox"
                            disabled={!isEditing || !isChecked || isDevOnlyRow}
                            checked={row.can_view && isChecked}
                            onChange={() => handleCellToggle(row.screen_number, "can_view")}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* 8. مراجعة (can_review) */}
                        <td className="p-1.5 text-center border-l border-slate-200 bg-purple-50/20">
                          <input
                            type="checkbox"
                            disabled={!isEditing || !isChecked || isDevOnlyRow}
                            checked={row.can_review && isChecked}
                            onChange={() => handleCellToggle(row.screen_number, "can_review")}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* 9. ترحيل (can_post) */}
                        <td className="p-1.5 text-center border-l border-slate-200 bg-teal-50/20">
                          <input
                            type="checkbox"
                            disabled={!isEditing || !isChecked || isDevOnlyRow}
                            checked={row.can_post && isChecked}
                            onChange={() => handleCellToggle(row.screen_number, "can_post")}
                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* Fast Row Toggle */}
                        {isEditing && (
                          <td className="p-1.5 text-center">
                            {isDevOnlyRow ? (
                              <span className="text-[9px] text-red-600 font-bold">مقفل</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleRowToggle(row.screen_number, true)}
                                  className="px-1 py-0.5 text-[9px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold"
                                  title="منح كامل صلاحيات هذا الصف"
                                >
                                  الكل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRowToggle(row.screen_number, false)}
                                  className="px-1 py-0.5 text-[9px] bg-red-100 hover:bg-red-200 text-red-800 rounded font-bold"
                                  title="سحب كامل صلاحيات هذا الصف"
                                >
                                  حظر
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Classic Onyx ERP Audit Footer Bar (matching Image bottom) ─── */}
      <div className="bg-[#e2e7ee] border-t-2 border-slate-300 px-3 py-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-700">
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">مدخل السجل:</span>
          <span className="font-bold text-slate-800 truncate">{currentUser?.created_by || "مدير النظام"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">تاريخ الإدخال:</span>
          <span className="font-mono text-slate-800 truncate" dir="ltr">{currentUser?.created_at || "18/07/2026 07:30:00"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">معدل السجل:</span>
          <span className="font-bold text-slate-800 truncate">{currentUser?.updated_by || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
          <span className="text-slate-500 font-semibold">تاريخ آخر تعديل:</span>
          <span className="font-mono text-slate-800 truncate" dir="ltr">{currentUser?.updated_at || "—"}</span>
        </div>
      </div>

      {/* Copy Permissions Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-lg border border-slate-300 shadow-xl max-w-md w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                <Copy className="w-4 h-4 text-blue-700" />
                نسخ واستنساخ صلاحيات الشاشات
              </h3>
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-slate-600">
                اختر المستخدم الذي ترغب في نسخ كامل صلاحيات الشاشات منه وتطبيقها على: <strong className="text-blue-800">{currentUser?.name}</strong>
              </p>

              <div>
                <label className="block text-slate-700 font-bold mb-1">المستخدم المصدر:</label>
                <select
                  value={sourceUserId}
                  onChange={e => setSourceUserId(e.target.value)}
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs"
                >
                  <option value="">-- اختر المستخدم المصدر --</option>
                  {users
                    .filter((u: any) => u.id !== currentUser?.id)
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.user_number || u.id} - {u.name} ({u.role})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCopyModal(false)}>إلغاء</Button>
              <Button
                size="sm"
                disabled={!sourceUserId || copyMutation.isPending}
                onClick={() => copyMutation.mutate(Number(sourceUserId))}
                className="bg-blue-700 hover:bg-blue-800 text-white"
              >
                تنفيذ النسخ الآن
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

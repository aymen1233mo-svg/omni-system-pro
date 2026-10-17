import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAuth } from "@/components/auth-provider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  ShieldCheck, 
  Clock, 
  Trash2, 
  HardDrive, 
  Sparkles,
  CheckCircle2,
  FolderOpen,
  AlertTriangle,
  Eye,
  ArrowRightLeft,
  Users,
  Receipt,
  BookOpen,
  Layers,
  ShieldAlert,
  X,
  FileSearch,
  Check,
  RefreshCw,
  GitMerge,
  AlertOctagon,
  Plane,
  Building2,
  FileSpreadsheet,
  Package,
  Tag,
  UserCheck,
  FileText
} from "lucide-react";

export default function BackupRestorePage() {
  const { user } = useAuth();
  const role = (user?.role as string) || "";
  const isDeveloper = role === "developer" || user?.username === "developer";
  const canAccessBackup = role === "admin" || role === "manager" || role === "مدير" || user?.username === "admin" || isDeveloper;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  // Settings State
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [intervalMins, setIntervalMins] = useState("30");
  const [maxBackups, setMaxBackups] = useState("50");
  const [customPath, setCustomPath] = useState("");

  // Inspection Modal State
  const [inspectionData, setInspectionData] = useState<any>(null);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);

  // Factory Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Action status
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const { data: backups, refetch: refetchBackups, isLoading: loadingBackups } = useQuery({
    queryKey: ["backups"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/system/backups", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: canAccessBackup
  });

  const { data: settingsData, refetch: refetchSettings } = useQuery({
    queryKey: ["backup-settings"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/system/backup/settings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: canAccessBackup
  });

  useEffect(() => {
    if (settingsData) {
      setAutoEnabled(settingsData.autoBackupEnabled ?? true);
      setIntervalMins(String(settingsData.autoBackupIntervalMinutes ?? 30));
      setMaxBackups(String(settingsData.maxRetainedBackups ?? 50));
      setCustomPath(settingsData.backupDir ?? "");
    }
  }, [settingsData]);

  // 1. Settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/system/backup/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: autoEnabled,
          intervalMinutes: Number(intervalMins) || 30,
          maxBackups: Number(maxBackups) || 50,
          customPath: customPath.trim()
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (res: any) => {
      toast({ title: "تم حفظ الإعدادات", description: res.message });
      refetchSettings();
      refetchBackups();
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
    }
  });

  // 2. Instant backup mutation
  const createInstantBackupMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/system/backup", { 
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (res) => {
      toast({ 
        title: "تم إنشاء النسخة الاحتياطية اللحظية بنجاح 🛡️", 
        description: `تم حفظ الملف بأمان: ${res.name}` 
      });
      refetchBackups();
      refetchSettings();
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "خطأ في النسخ", description: err.message });
    }
  });

  // 3. Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (filename: string) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch(`/api/system/backup/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (res) => {
      toast({ title: "تم الحذف", description: res.message });
      refetchBackups();
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "خطأ في الحذف", description: err.message });
    }
  });

  // 4. Inspect file (Upload or Local)
  const handleInspectFile = async (file?: File, filename?: string) => {
    try {
      setIsInspecting(true);
      const token = localStorage.getItem("pos_token") ?? "";
      let res: Response;

      if (file) {
        const formData = new FormData();
        formData.append("dbFile", file);
        res = await fetch("/api/system/backup/inspect", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData
        });
      } else if (filename) {
        res = await fetch("/api/system/backup/inspect", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ filename })
        });
      } else {
        toast({ variant: "destructive", title: "تنبيه", description: "يرجى اختيار ملف قاعدة بيانات أولاً" });
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل فحص محتوى قاعدة البيانات");

      setInspectionData(data);
      setShowInspectionModal(true);
      toast({ title: "تم فحص محتوى قاعدة البيانات بنجاح 📋", description: `تم استخراج محتويات (${data.fileInfo?.name})` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ في فحص الملف", description: err.message });
    } finally {
      setIsInspecting(false);
    }
  };

  // 5. Execute Full Restore
  const handleExecuteFullRestore = async () => {
    if (!inspectionData?.tempKey) return;
    try {
      setActionInProgress("restore");
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/system/backup/confirm-restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ tempKey: inspectionData.tempKey })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل استبدال قاعدة البيانات");

      toast({ 
        title: "تمت الاستعادة وتطبيق البيانات بنجاح! 🎉", 
        description: data.message 
      });
      setShowInspectionModal(false);

      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err: any) {
      toast({ variant: "destructive", title: "فشل الاستعادة", description: err.message });
    } finally {
      setActionInProgress(null);
    }
  };

  // 6. Execute Smart Merge
  const handleExecuteMerge = async () => {
    if (!inspectionData?.tempKey) return;
    try {
      setActionInProgress("merge");
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/system/backup/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ tempKey: inspectionData.tempKey })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل دمج البيانات");

      const stats = data.statsMerged;
      const desc = stats 
        ? `تم استيعاب ودمج: ${stats.orders || 0} فاتورة، ${stats.products || 0} صنف، ${stats.customers || 0} عميل، ${stats.suppliers || 0} مورد، ${stats.vouchers || 0} سند، ${stats.journals || 0} قيد محاسبي.`
        : data.message;

      toast({ 
        title: "تم دمج واستيراد البيانات بنجاح! ✨", 
        description: desc 
      });
      setShowInspectionModal(false);
      refetchBackups();
    } catch (err: any) {
      toast({ variant: "destructive", title: "فشل الدمج", description: err.message });
    } finally {
      setActionInProgress(null);
    }
  };

  // 7. Execute Factory Reset
  const handleExecuteFactoryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmText.trim() !== "تصفير") {
      toast({ variant: "destructive", title: "تنبيه أمني", description: 'يرجى كتابة كلمة "تصفير" للتأكيد.' });
      return;
    }
    try {
      setIsResetting(true);
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/system/reset-database", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ confirmText: resetConfirmText.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل تصفير قاعدة البيانات");

      toast({
        title: "تم تصفير ومحو كافة البيانات بنجاح 🧹",
        description: "تم أخذ نسخة أمان قبل التصفير وإعادة تهيئة النظام نظيفاً."
      });
      setShowResetModal(false);
      setResetConfirmText("");
      refetchBackups();
      queryClient.invalidateQueries();

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ في التصفير", description: err.message });
    } finally {
      setIsResetting(false);
    }
  };

  const handleDownloadBackup = (filename?: string) => {
    const token = localStorage.getItem("pos_token") ?? "";
    const url = filename 
      ? `/api/system/backup/download/${encodeURIComponent(filename)}`
      : `/api/system/backup/download/latest`;
    
    fetch(url, { headers: { "Authorization": `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("تعذر تحميل ملف النسخة الاحتياطية");
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename || `pos_backup_${new Date().toISOString().slice(0, 10)}.db`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        toast({ title: "تم التنزيل", description: "تم حفظ ملف قاعدة البيانات على جهازك بنجاح" });
      })
      .catch((err) => {
        toast({ variant: "destructive", title: "خطأ", description: err.message });
      });
  };

  if (!canAccessBackup) {
    return (
      <AdminLayout>
        <div className="flex h-full items-center justify-center p-8 text-center" dir="rtl">
          <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 space-y-2">
            <ShieldAlert className="w-10 h-10 mx-auto text-red-600" />
            <p className="text-lg font-bold">غير مصرح لك بالوصول لمركز النسخ الاحتياطي</p>
            <p className="text-xs text-red-600">هذه الشاشة مخصصة لإدارة النظام ومطوري النظام فقط.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        
        {/* Top Hero Banner */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl border border-indigo-900/50">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-indigo-600/30 border border-indigo-500/40 rounded-2xl shadow-inner">
              <Database className="w-10 h-10 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">نظام النسخ الاحتياطي والحماية الشاملة</h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono text-xs">
                  SQLite v3 + Engine
                </Badge>
              </div>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 leading-relaxed">
                حفظ لحظي، فحص واستعراض محتويات قواعد البيانات القديمة، دمج ذكي للسجلات، وحماية تامة ضد فقدان البيانات.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              onClick={() => createInstantBackupMutation.mutate()}
              disabled={createInstantBackupMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm h-10 px-4 gap-2 shadow-md rounded-xl"
            >
              <Sparkles className="w-4 h-4" />
              {createInstantBackupMutation.isPending ? "جاري الحفظ..." : "إنشاء نسخة احتياطية الآن"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownloadBackup()}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs sm:text-sm h-10 px-4 gap-2 rounded-xl"
            >
              <Download className="w-4 h-4" />
              تنزيل ملف .db
            </Button>
          </div>
        </div>

        {/* 2 Main Action Cards: Inspection & File Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Card 1: Select & Inspect File */}
          <Card className="border-2 border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/30 rounded-3xl shadow-md overflow-hidden">
            <CardHeader className="bg-indigo-100/50 border-b border-indigo-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black text-indigo-950 flex items-center gap-2">
                  <FileSearch className="w-5 h-5 text-indigo-600" />
                  <span>فحص واستعراض قاعدة بيانات من الجهاز (Inspect & Preview)</span>
                </CardTitle>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-800 border-indigo-300 text-[10px] font-bold">
                  فحص مسبق آمن 🔍
                </Badge>
              </div>
              <CardDescription className="text-indigo-900/80 text-xs font-medium">
                اختر أي ملف قاعدة بيانات قديم (<code className="font-mono text-indigo-700 bg-white px-1 py-0.5 rounded">.db</code> أو <code className="font-mono text-indigo-700 bg-white px-1 py-0.5 rounded">.sqlite</code>) لفحص محتوياته، وعرض إحصائياته في شاشة استعراض كبرى قبل إقرار الاستعادة أو الدمج.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white p-4 rounded-2xl transition-colors space-y-3">
                <input 
                  type="file" 
                  accept=".db,.sqlite,.sqlite3" 
                  id="db-file-upload"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} 
                  className="w-full text-xs text-slate-700 file:mr-0 file:ml-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                />
                {selectedFile && (
                  <div className="flex items-center justify-between text-xs bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100 font-bold text-indigo-900">
                    <span className="truncate">{selectedFile.name}</span>
                    <span className="font-mono text-indigo-700">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={() => handleInspectFile(selectedFile || undefined)}
                  disabled={!selectedFile || isInspecting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-10 gap-2 rounded-xl shadow-md"
                >
                  <Eye className="w-4 h-4" />
                  {isInspecting ? "جاري قراءة وفحص محتويات الملف..." : "فحص واستعراض محتويات الملف بشاشة كبرى"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Active Database Stats & Engine Health */}
          <Card className="border-slate-200 bg-white rounded-3xl shadow-md overflow-hidden">
            <CardHeader className="bg-slate-50 border-b pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-emerald-600" />
                  <span>حالة قاعدة البيانات النشطة على هذا الجهاز</span>
                </CardTitle>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  متصل وجاهز
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-500 text-[11px]">
                  <span>مسار ملف قاعدة البيانات النشط حالياً:</span>
                  <span className="font-mono text-emerald-700 font-black">Active DB</span>
                </div>
                <p className="font-mono text-[11px] text-slate-900 bg-white p-2 rounded-xl border border-slate-200 dir-ltr break-all font-bold">
                  {settingsData?.activeDbPath || "جاري التحديد..."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px] font-bold">حجم ملف القاعدة:</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {settingsData?.dbSize ? `${(settingsData.dbSize / 1024).toFixed(1)} KB` : "---"}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px] font-bold">محرك الحفظ التلقائي:</span>
                  <span className="text-sm font-black text-emerald-700">
                    {settingsData?.autoBackupEnabled ? `كل ${settingsData.autoBackupIntervalMinutes} دقيقة` : "معطل"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Automated Backup Settings Card */}
        <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/70 border-b pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2 text-slate-800">
                <Clock className="w-4 h-4 text-indigo-600" />
                محرك النسخ الاحتياطي التلقائي المجدول (Auto-Backup Engine)
              </CardTitle>
              <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-xs">
                حفظ في الخلفية دون مقاطعة العمل
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">تفعيل الحماية التلقائية</Label>
                <div className="flex items-center gap-3 p-2.5 bg-slate-50 border rounded-xl">
                  <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
                  <span className="text-xs font-bold text-slate-700">{autoEnabled ? "مفعّل تلقائياً" : "معطّل"}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">فترة التكرار (دقيقة)</Label>
                <select
                  value={intervalMins}
                  onChange={(e) => setIntervalMins(e.target.value)}
                  className="w-full h-10 px-3 border rounded-xl text-xs font-bold bg-white text-slate-800 shadow-xs"
                >
                  <option value="5">كل 5 دقائق (لحظي مشدد)</option>
                  <option value="15">كل 15 دقيقة</option>
                  <option value="30">كل 30 دقيقة (موصى به)</option>
                  <option value="60">كل ساعة</option>
                  <option value="360">كل 6 ساعات</option>
                  <option value="1440">يومياً (كل 24 ساعة)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">أقصى عدد نسخ محفوظة</Label>
                <Input
                  type="number"
                  min="5"
                  max="500"
                  value={maxBackups}
                  onChange={(e) => setMaxBackups(e.target.value)}
                  className="h-10 text-xs font-mono font-bold rounded-xl"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => updateSettingsMutation.mutate()}
                  disabled={updateSettingsMutation.isPending}
                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-sm"
                >
                  {updateSettingsMutation.isPending ? "جاري الحفظ..." : "حفظ وضبط المحرك"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-indigo-600" />
                مجلد حفظ النسخ الاحتياطية على جهاز الكمبيوتر:
              </Label>
              <Input
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="مثال: C:\OmniSystem_Backups أو /home/user/OmniSystem_Backups"
                className="font-mono text-xs bg-slate-50 rounded-xl"
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        {/* Available Backups List */}
        <Card className="shadow-md border-slate-200 rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-black flex items-center gap-2 text-slate-900">
                <HardDrive className="w-5 h-5 text-indigo-600" />
                النسخ الاحتياطية المحفوظة محلياً على الجهاز ({backups?.length || 0})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchBackups()}
                className="text-xs font-bold gap-1 rounded-xl"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                تحديث القائمة
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {loadingBackups ? (
              <div className="text-center py-8 text-slate-500 font-bold text-xs">جاري فحص النسخ المتوفرة...</div>
            ) : backups?.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <Database className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-sm">لا توجد نسخ احتياطية مسجلة في المجلد حتى الآن.</p>
                <p className="text-xs text-slate-400 mt-1">انقر على "إنشاء نسخة احتياطية الآن" لحفظ أول نسخة من قاعدة البيانات.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {backups?.map((b: any) => (
                  <div key={b.name} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 p-4 bg-slate-50/80 hover:bg-indigo-50/40 transition-colors border rounded-2xl">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-slate-800 truncate" dir="ltr">{b.name}</p>
                        {b.isAuto ? (
                          <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-bold rounded-full border border-sky-200">تلقائي مجدول</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">يدوي لحظي</span>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 border rounded-lg whitespace-nowrap">
                          {(b.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">تاريخ الحفظ: {new Date(b.createdAt).toLocaleString("ar-SA")}</p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end shrink-0 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => handleInspectFile(undefined, b.name)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-8 px-3 gap-1 rounded-xl shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>فحص واستعراض المحتوى</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadBackup(b.name)}
                        title="تنزيل الملف"
                        className="text-xs h-8 px-2.5 rounded-xl border-slate-200"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من رغبتك في حذف النسخة الاحتياطية "${b.name}"؟`)) {
                            deleteBackupMutation.mutate(b.name);
                          }
                        }}
                        disabled={deleteBackupMutation.isPending}
                        title="حذف من القرص"
                        className="text-xs h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-xl"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── DANGER ZONE: Factory Reset Section ── */}
        <Card className="border-2 border-red-500/40 bg-gradient-to-br from-red-50/50 via-white to-rose-50/40 rounded-3xl shadow-md overflow-hidden">
          <CardHeader className="bg-red-100/50 border-b border-red-200/60 pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-black text-red-950 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-600" />
                <span>منطقة العمليات الحساسة: تصفير قاعدة البيانات بالكامل (Factory Reset)</span>
              </CardTitle>
              <Badge className="bg-red-600 text-white font-black text-[10px]">
                شديد الحساسية ⚠️
              </Badge>
            </div>
            <CardDescription className="text-red-900/90 text-xs font-medium">
              يتيح لك هذا الخيار محو وتصفير كافة البيانات والعمليات والفواتير والمسافرين والقيود للبدء بسجل نظيف وجديد كلياً.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-800">
                سيقوم النظام تلقائياً بأخذ نسخة أمان احتياطية كاملة قبل التصفير لحفظ بياناتك في حال رغبت باستعادتها لاحقاً.
              </p>
              <p className="text-[11px] text-slate-500">
                يتم الإبقاء حصرياً على حسابات المدير والمطور والتراخيص وإعدادات النظام الأساسية.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setResetConfirmText("");
                setShowResetModal(true);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm h-10 px-5 gap-2 rounded-xl shadow-md shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>تصفير ومحو كافة بيانات قاعدة البيانات</span>
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* ── MODAL 1: Comprehensive Database Inspection & Preview Modal ── */}
      <Dialog open={showInspectionModal} onOpenChange={setShowInspectionModal}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto dir-rtl rounded-3xl p-6 font-sans border-2 border-indigo-500">
          <DialogHeader className="text-right space-y-2 border-b pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <FileSearch className="w-6 h-6 text-indigo-600" />
                <span>شاشة فحص واستعراض محتويات قاعدة البيانات بالتفصيل</span>
              </DialogTitle>
              <Badge className="bg-indigo-100 text-indigo-900 font-mono text-xs">
                {inspectionData?.fileInfo?.sizeFormatted}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-600 font-medium">
              تم فحص الملف: <b className="text-indigo-900 font-mono">{inspectionData?.fileInfo?.name}</b>. يرجى مراجعة إحصائيات وعينات البيانات أدناه، ثم اختيار الإجراء المطلوب (استبدال شامل أو دمج ذكي).
            </DialogDescription>
          </DialogHeader>

          {inspectionData && (
            <div className="space-y-5 py-2">
              
              {/* Comparative Stats Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                  مقارنة بيانات المبيعات والمخزون بين الملف المفحوص والقاعدة الحالية:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: "فواتير ومبيعات النظام", icon: Receipt, incoming: inspectionData.statistics?.orders, current: inspectionData.currentDatabaseStats?.orders, color: "purple" },
                    { label: "المنتجات والأصناف بالمخزون", icon: Package, incoming: inspectionData.statistics?.products, current: inspectionData.currentDatabaseStats?.products, color: "rose" },
                    { label: "العملاء والحسابات المدينة", icon: Users, incoming: inspectionData.statistics?.customers, current: inspectionData.currentDatabaseStats?.customers, color: "blue" },
                    { label: "الموردين والشركات المعتمدة", icon: Building2, incoming: inspectionData.statistics?.suppliers, current: inspectionData.currentDatabaseStats?.suppliers, color: "teal" },
                    { label: "سندات الصرف والقبض", icon: FileText, incoming: inspectionData.statistics?.vouchers, current: inspectionData.currentDatabaseStats?.vouchers, color: "amber" },
                    { label: "قيود اليومية العامة المحاسبية", icon: BookOpen, incoming: inspectionData.statistics?.journals, current: inspectionData.currentDatabaseStats?.journals, color: "indigo" },
                    { label: "فئات وتصنيفات المنتجات", icon: Tag, incoming: inspectionData.statistics?.categories, current: inspectionData.currentDatabaseStats?.categories, color: "sky" },
                    { label: "المستخدمين وصلاحيات الكاشير", icon: UserCheck, incoming: inspectionData.statistics?.users, current: inspectionData.currentDatabaseStats?.users, color: "emerald" },
                  ].map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                      <div key={idx} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                          <span className="truncate">{stat.label}</span>
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div className="flex items-baseline justify-between pt-1">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 block font-bold">في الملف:</span>
                            <span className="text-sm font-black text-indigo-700 font-mono">{stat.incoming ?? 0}</span>
                          </div>
                          <div className="text-left space-y-0.5">
                            <span className="text-[10px] text-slate-400 block font-bold">الحالي:</span>
                            <span className="text-xs font-bold text-slate-700 font-mono">{stat.current ?? 0}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sample Data Tabs */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  معاينة عينات حية من سجلات المبيعات والمخزون والحسابات داخل الملف:
                </h4>

                <Tabs defaultValue="orders" className="w-full">
                  <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex flex-wrap gap-1">
                    <TabsTrigger value="orders" className="text-xs font-bold rounded-lg py-1.5">
                      عينة الفواتير ({inspectionData.samples?.orders?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="products" className="text-xs font-bold rounded-lg py-1.5">
                      عينة المنتجات ({inspectionData.samples?.products?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="customers" className="text-xs font-bold rounded-lg py-1.5">
                      عينة العملاء ({inspectionData.samples?.customers?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="suppliers" className="text-xs font-bold rounded-lg py-1.5">
                      عينة الموردين ({inspectionData.samples?.suppliers?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="vouchers" className="text-xs font-bold rounded-lg py-1.5">
                      عينة السندات ({inspectionData.samples?.vouchers?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="journals" className="text-xs font-bold rounded-lg py-1.5">
                      عينة القيود ({inspectionData.samples?.journals?.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab: Orders Sample */}
                  <TabsContent value="orders" className="mt-2 border rounded-2xl overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b sticky top-0">
                          <tr>
                            <th className="p-2.5">رقم الفاتورة</th>
                            <th className="p-2.5">العميل</th>
                            <th className="p-2.5">الإجمالي</th>
                            <th className="p-2.5">طريقة الدفع</th>
                            <th className="p-2.5">الحالة</th>
                            <th className="p-2.5">التاريخ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inspectionData.samples?.orders?.map((o: any) => (
                            <tr key={o.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-mono font-bold text-indigo-700">#{o.invoice_number || o.id}</td>
                              <td className="p-2.5 font-bold text-slate-900">{o.customer_name || "عميل عام"}</td>
                              <td className="p-2.5 font-mono font-bold text-emerald-700">{o.total || 0} ريال</td>
                              <td className="p-2.5">{o.payment_method === "cash" ? "نقداً" : (o.payment_method === "card" ? "شبكة" : "آجل")}</td>
                              <td className="p-2.5"><Badge variant="outline" className="text-[10px]">{o.status || "مكتملة"}</Badge></td>
                              <td className="p-2.5 text-slate-500 font-mono text-[11px]">{o.created_at || "---"}</td>
                            </tr>
                          ))}
                          {(!inspectionData.samples?.orders || inspectionData.samples.orders.length === 0) && (
                            <tr><td colSpan={6} className="text-center py-4 text-slate-400">لا توجد فواتير مبيعات في هذا الملف</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* Tab: Products Sample */}
                  <TabsContent value="products" className="mt-2 border rounded-2xl overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b sticky top-0">
                          <tr>
                            <th className="p-2.5">الباركود</th>
                            <th className="p-2.5">اسم الصنف / المنتج</th>
                            <th className="p-2.5">سعر البيع</th>
                            <th className="p-2.5">سعر التكلفة</th>
                            <th className="p-2.5">المخزون المتوفر</th>
                            <th className="p-2.5">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inspectionData.samples?.products?.map((p: any) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-mono text-indigo-700 font-bold">{p.barcode || "---"}</td>
                              <td className="p-2.5 font-bold text-slate-900">{p.name}</td>
                              <td className="p-2.5 font-mono font-bold text-emerald-700">{p.price || 0} ريال</td>
                              <td className="p-2.5 font-mono text-slate-600">{p.cost || 0} ريال</td>
                              <td className="p-2.5 font-mono font-bold text-blue-700">{p.stock || 0}</td>
                              <td className="p-2.5">
                                <Badge variant="outline" className={p.active !== 0 ? "text-emerald-700 bg-emerald-50" : "text-slate-500"}>
                                  {p.active !== 0 ? "نشط" : "موقف"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                          {(!inspectionData.samples?.products || inspectionData.samples.products.length === 0) && (
                            <tr><td colSpan={6} className="text-center py-4 text-slate-400">لا توجد أصناف منتجات في هذا الملف</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* Tab: Customers Sample */}
                  <TabsContent value="customers" className="mt-2 border rounded-2xl overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b sticky top-0">
                          <tr>
                            <th className="p-2.5">اسم العميل</th>
                            <th className="p-2.5">الهاتف</th>
                            <th className="p-2.5">الرصيد المالي</th>
                            <th className="p-2.5">نوع العميل</th>
                            <th className="p-2.5">العنوان</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inspectionData.samples?.customers?.map((c: any) => (
                            <tr key={c.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-slate-900">{c.name}</td>
                              <td className="p-2.5 font-mono text-slate-600">{c.phone || "---"}</td>
                              <td className="p-2.5 font-mono font-bold text-emerald-700">{c.balance || 0} ريال</td>
                              <td className="p-2.5">{c.customer_type === "company" ? "مؤسسة/شركة" : "فردي"}</td>
                              <td className="p-2.5 text-slate-600">{c.address || "---"}</td>
                            </tr>
                          ))}
                          {(!inspectionData.samples?.customers || inspectionData.samples.customers.length === 0) && (
                            <tr><td colSpan={5} className="text-center py-4 text-slate-400">لا توجد سجلات عملاء في هذا الملف</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* Tab: Suppliers Sample */}
                  <TabsContent value="suppliers" className="mt-2 border rounded-2xl overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b sticky top-0">
                          <tr>
                            <th className="p-2.5">اسم المورد / الشركة</th>
                            <th className="p-2.5">الهاتف</th>
                            <th className="p-2.5">الرصيد المستحق</th>
                            <th className="p-2.5">العنوان / الملاحظات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inspectionData.samples?.suppliers?.map((s: any) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-slate-900">{s.name}</td>
                              <td className="p-2.5 font-mono text-slate-600">{s.phone || "---"}</td>
                              <td className="p-2.5 font-mono font-bold text-amber-700">{s.balance || 0} ريال</td>
                              <td className="p-2.5 text-slate-600">{s.address || "---"}</td>
                            </tr>
                          ))}
                          {(!inspectionData.samples?.suppliers || inspectionData.samples.suppliers.length === 0) && (
                            <tr><td colSpan={4} className="text-center py-4 text-slate-400">لا توجد سجلات موردين في هذا الملف</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* Tab: Vouchers Sample */}
                  <TabsContent value="vouchers" className="mt-2 border rounded-2xl overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b sticky top-0">
                          <tr>
                            <th className="p-2.5">النوع</th>
                            <th className="p-2.5">المبلغ</th>
                            <th className="p-2.5">المستفيد / الحساب</th>
                            <th className="p-2.5">طريقة الدفع</th>
                            <th className="p-2.5">التاريخ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inspectionData.samples?.vouchers?.map((v: any) => (
                            <tr key={v.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold">
                                <Badge className={v.type === "receipt" ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}>
                                  {v.type === "receipt" ? "سند قبض" : "سند صرف"}
                                </Badge>
                              </td>
                              <td className="p-2.5 font-mono font-bold text-indigo-700">{v.amount} ريال</td>
                              <td className="p-2.5">{v.beneficiary || v.notes || "---"}</td>
                              <td className="p-2.5">{v.payment_method === "cash" ? "نقداً" : "تحويل/بنكي"}</td>
                              <td className="p-2.5 font-mono text-slate-500">{v.created_at || "---"}</td>
                            </tr>
                          ))}
                          {(!inspectionData.samples?.vouchers || inspectionData.samples.vouchers.length === 0) && (
                            <tr><td colSpan={5} className="text-center py-4 text-slate-400">لا توجد سندات مالية في هذا الملف</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* Tab: Journals Sample */}
                  <TabsContent value="journals" className="mt-2 border rounded-2xl overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b sticky top-0">
                          <tr>
                            <th className="p-2.5">رقم القيد</th>
                            <th className="p-2.5">التاريخ</th>
                            <th className="p-2.5">البيان العام</th>
                            <th className="p-2.5">إجمالي المدين</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inspectionData.samples?.journals?.map((j: any) => (
                            <tr key={j.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-mono font-bold text-indigo-700">#{j.entry_number || j.id}</td>
                              <td className="p-2.5 font-mono text-slate-600">{j.date || "---"}</td>
                              <td className="p-2.5 font-bold text-slate-900">{j.description || "---"}</td>
                              <td className="p-2.5 font-mono font-bold text-emerald-700">{j.total_debit || 0} ريال</td>
                            </tr>
                          ))}
                          {(!inspectionData.samples?.journals || inspectionData.samples.journals.length === 0) && (
                            <tr><td colSpan={4} className="text-center py-4 text-slate-400">لا توجد قيود يومية في هذا الملف</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

            </div>
          )}

          <DialogFooter className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInspectionModal(false)}
              className="w-full sm:w-auto text-xs font-bold"
            >
              إلغاء وإغلاق
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Button: Smart Merge */}
              <Button
                type="button"
                onClick={handleExecuteMerge}
                disabled={actionInProgress !== null}
                className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-10 px-4 gap-1.5 shadow-md rounded-xl"
              >
                <GitMerge className="w-4 h-4" />
                <span>{actionInProgress === "merge" ? "جاري الدمج..." : "✨ دمج واستيراد البيانات (Smart Merge)"}</span>
              </Button>

              {/* Button: Full Replace */}
              <Button
                type="button"
                onClick={() => {
                  if (confirm(`تحذير أمني هام:\nهل أنت متأكد من رغبتك في استبدال قاعدة البيانات الحالية بالكامل وتطبيق ملف (${inspectionData?.fileInfo?.name})؟\n\nسيتم حفظ نسخة احتياطية من الحالة الحالية تلقائياً أولاً.`)) {
                    handleExecuteFullRestore();
                  }
                }}
                disabled={actionInProgress !== null}
                className="flex-1 sm:flex-initial bg-amber-600 hover:bg-amber-700 text-white font-black text-xs h-10 px-4 gap-1.5 shadow-md rounded-xl"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{actionInProgress === "restore" ? "جاري الاستبدال..." : "🔄 استبدال شامل لقاعدة البيانات (Full Restore)"}</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL 2: Factory Reset Confirmation Modal ── */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="max-w-md w-full dir-rtl rounded-3xl p-6 font-sans border-2 border-red-600">
          <DialogHeader className="text-right space-y-2 border-b pb-3">
            <div className="flex items-center gap-2 text-red-600 font-black text-base">
              <AlertOctagon className="w-6 h-6" />
              <span>تأكيد تصفير ومحو بيانات قاعدة البيانات</span>
            </div>
            <DialogDescription className="text-xs text-red-700 font-bold leading-relaxed bg-red-50 p-3 rounded-2xl border border-red-200">
              ⚠️ تحذير شديد الخطورة: سيتم حذف كافة فواتير المبيعات، حركات المخزون، سندات الصرف والقبض، القيود اليومية، وسجلات العملاء والموردين بشكل نهائي. سيتم إنشاء نسخة احتياطية أمان تلقائياً قبل التصفير في مجلد النسخ.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteFactoryReset} className="space-y-4 pt-2">
            <div className="space-y-1.5 text-right">
              <label className="block text-xs font-black text-slate-800">
                للمتابعة وتأكيد العملية، يرجى كتابة كلمة <span className="text-red-600 font-black underline">تصفير</span> أدناه:
              </label>
              <Input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder='اكتب: تصفير'
                className="text-center font-black text-sm h-10 border-red-300 focus:border-red-600 bg-white"
              />
            </div>

            <DialogFooter className="pt-3 border-t flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowResetModal(false)}
                className="text-xs font-bold"
              >
                تراجع وإلغاء
              </Button>
              <Button
                type="submit"
                disabled={resetConfirmText.trim() !== "تصفير" || isResetting}
                className="bg-red-600 hover:bg-red-700 text-white font-black text-xs h-10 px-5 gap-1.5 shadow-lg rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? "جاري التصفير..." : "تأكيد محو وتصفير البيانات"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

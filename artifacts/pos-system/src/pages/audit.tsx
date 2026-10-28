import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery } from "@tanstack/react-query";
import { FileText, Clock, Eye, Laptop, Globe, Info, Search, Filter, ShieldCheck, Ticket, UserX, AlertCircle, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }

export default function AuditPage() {
  const { data: logs = [], isLoading } = useQuery<any[]>({ queryKey: ["audit-logs"], queryFn: () => apiGet("/api/audit-logs") });
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  // Get unique users and actions for the dropdown filters
  const uniqueUsers = Array.from(new Set(logs.map(l => l.user_name || "النظام"))).filter(Boolean);
  const uniqueActions = Array.from(new Set(logs.map(l => l.action))).filter(Boolean);

  // Apply filters
  const filteredLogs = logs.filter(l => {
    const matchesSearch = 
      (l.details || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.action || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.user_name || "النظام").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesUser = !userFilter || (l.user_name || "النظام") === userFilter;
    const matchesAction = !actionFilter || l.action === actionFilter;

    return matchesSearch && matchesUser && matchesAction;
  });

  const formatJson = (val: any) => {
    if (!val) return <span className="text-slate-400">لا توجد بيانات</span>;
    try {
      const parsed = typeof val === "string" ? JSON.parse(val) : val;
      return (
        <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono overflow-auto max-h-[220px] text-left" dir="ltr">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return (
        <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-auto max-h-[220px] text-left" dir="ltr">
          {val}
        </pre>
      );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-slate-700" />سجل العمليات والرقابة الأمنية (Audit Log)</h1>
          <p className="text-xs text-slate-500 mt-1">تتبع كافة العمليات والتحركات التي يقوم بها المستخدمون في النظام والاطلاع على تفاصيل الأجهزة وعناوين الـ IP</p>
        </div>

        {/* Filters Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <label className="text-xs font-bold text-slate-600 block mb-1 flex items-center gap-1"><Search className="w-3.5 h-3.5 text-slate-400" />البحث السريع</label>
            <Input 
              placeholder="ابحث بالعملية أو التفاصيل..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="h-9 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1 flex items-center gap-1"><Filter className="w-3.5 h-3.5 text-slate-400" />فلترة بالمستخدم</label>
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 h-9 text-xs"
            >
              <option value="">كل المستخدمين</option>
              {uniqueUsers.map((u: string) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1 flex items-center gap-1"><Filter className="w-3.5 h-3.5 text-slate-400" />فلترة بنوع العملية</label>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 h-9 text-xs"
            >
              <option value="">كل العمليات</option>
              {uniqueActions.map((a: string) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button 
              variant="outline" 
              onClick={() => { setSearchQuery(""); setUserFilter(""); setActionFilter(""); }}
              className="w-full h-9 text-xs"
            >
              إعادة تعيين الفلاتر
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-right p-3 font-semibold text-xs">التاريخ والوقت</th>
                    <th className="text-right p-3 font-semibold text-xs">المستخدم</th>
                    <th className="text-right p-3 font-semibold text-xs">نوع العملية</th>
                    <th className="text-right p-3 font-semibold text-xs">التفاصيل والوصف</th>
                    <th className="text-center p-3 font-semibold text-xs">IP / الجهاز</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {filteredLogs.map(l => (
                    <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-muted-foreground font-mono whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(l.created_at).toLocaleString("ar-SA")}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-700">{l.user_name ?? "النظام"}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {l.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 font-medium max-w-[280px] truncate" title={l.details}>
                        {l.details ?? "—"}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {l.ip || l.device ? (
                          <div className="flex flex-col items-center gap-0.5 text-[10px] text-slate-500 font-mono">
                            {l.ip && <span className="inline-flex items-center gap-0.5"><Globe className="w-3 h-3 text-slate-400" />{l.ip}</span>}
                            {l.device && <span className="inline-flex items-center gap-0.5"><Laptop className="w-3 h-3 text-slate-400 text-[10px]" />{l.device}</span>}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => setSelectedLog(l)}
                          className="inline-flex items-center justify-center p-1.5 rounded hover:bg-slate-100 text-blue-600 cursor-pointer"
                          title="تفاصيل العملية والبيانات"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-muted-foreground">
                        لا توجد عمليات مسجلة تطابق خيارات البحث الحالية
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Log Inspector Dialog */}
      <Dialog open={selectedLog !== null} onOpenChange={v => { if(!v) setSelectedLog(null); }}>
        <DialogContent dir="rtl" className="max-w-3xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-blue-700" />
              تفاصيل عملية التدقيق الأمني والرقابة
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border p-3 rounded-lg text-xs">
                <div>
                  <span className="font-bold text-slate-500 block mb-0.5">نوع العملية:</span>
                  <span className="text-slate-800 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-block">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block mb-0.5">المستخدم المسؤول:</span>
                  <span className="text-slate-800 font-bold">{selectedLog.user_name ?? "النظام"}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block mb-0.5">التاريخ والوقت:</span>
                  <span className="text-slate-800 font-mono">{new Date(selectedLog.created_at).toLocaleString("ar-SA")}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block mb-0.5">عنوان الـ IP والجهاز المستخدم:</span>
                  <span className="text-slate-800 font-mono inline-flex gap-2">
                    {selectedLog.ip ? `IP: ${selectedLog.ip}` : ""}
                    {selectedLog.device ? `| الجهاز: ${selectedLog.device}` : ""}
                    {!selectedLog.ip && !selectedLog.device ? "غير مسجل" : ""}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-600 block mb-1">تفاصيل وموجز الحركة:</span>
                <p className="p-3 bg-white border rounded-lg text-slate-700 leading-relaxed font-semibold">{selectedLog.details ?? "لا يوجد تفاصيل إضافية"}</p>
              </div>

              {selectedLog.reason && (
                <div>
                  <span className="font-bold text-slate-600 block mb-1 text-red-700">السبب المقدم للحركة / التعديل:</span>
                  <p className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 leading-relaxed font-bold">{selectedLog.reason}</p>
                </div>
              )}

              {/* Data Diff Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="font-bold text-slate-600 block mb-1 flex items-center gap-1">
                    <Info className="w-4 h-4 text-slate-400" />
                    البيانات قبل التغيير (البيانات السابقة):
                  </span>
                  {formatJson(selectedLog.old_data)}
                </div>
                <div>
                  <span className="font-bold text-slate-600 block mb-1 flex items-center gap-1">
                    <Info className="w-4 h-4 text-emerald-500" />
                    البيانات بعد التغيير (البيانات الجديدة):
                  </span>
                  {formatJson(selectedLog.new_data)}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

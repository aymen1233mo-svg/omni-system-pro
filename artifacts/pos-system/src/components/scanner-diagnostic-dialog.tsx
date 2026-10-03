import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bug, CheckCircle2, XCircle, Search, Copy, Trash2, Database, Terminal, ArrowRight, Zap } from "lucide-react";
import type { Product } from "@workspace/api-client-react";

export interface ScanDiagnosticLog {
  id: string;
  timestamp: string;
  rawCode: string;
  cleanCode: string;
  length: number;
  matched: boolean;
  matchedProduct?: {
    id: number;
    name: string;
    barcode: string | null;
    price: number;
    stock: number;
    active?: boolean;
  };
  details: string;
}

interface ScannerDiagnosticDialogProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ScanDiagnosticLog[];
  onClearLogs: () => void;
  products: Product[];
  onSimulateScan: (code: string) => void;
}

export function ScannerDiagnosticDialog({
  isOpen,
  onClose,
  logs,
  onClearLogs,
  products,
  onSimulateScan,
}: ScannerDiagnosticDialogProps) {
  const [testInput, setTestInput] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"logs" | "inventory">("logs");
  const [copied, setCopied] = useState(false);

  const handleTestScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim()) return;
    onSimulateScan(testInput.trim());
    setTestInput("");
  };

  const copyLogsToClipboard = () => {
    const text = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredProducts = products.filter((p) => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      String(p.number || "").includes(q) ||
      String(p.id).includes(q)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border-slate-700 text-white p-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-4 bg-slate-950 border-b border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                أداة تشخيص ومطابقة باركود نقطة البيع
                <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-400/40">
                  POS Scanner Diagnostic
                </Badge>
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                مراقبة مخرجات الكاميرا الخام وفحص تطابق الأكواد 12-13 رقماً مع قاعدة البيانات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "logs" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("logs")}
              className="text-xs h-8 gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5" />
              سجل الفحص المباشر ({logs.length})
            </Button>
            <Button
              variant={activeTab === "inventory" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("inventory")}
              className="text-xs h-8 gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              أكواد المخزون ({products.filter(p => p.barcode).length})
            </Button>
          </div>
        </DialogHeader>

        {/* Diagnostic Simulator Bar */}
        <form onSubmit={handleTestScan} className="bg-slate-950/60 p-3 border-b border-slate-800 flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>فحص تجريبي للرمز:</span>
          </div>
          <Input
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="أدخل باركود للتجربة (مثال: 768071007488 أو 0768071007488)..."
            className="h-8 bg-slate-900 border-slate-700 text-white font-mono text-xs"
            dir="ltr"
          />
          <Button type="submit" size="sm" className="h-8 bg-amber-600 hover:bg-amber-500 text-white text-xs shrink-0">
            اختبار المطابقة والإدراج
          </Button>
        </form>

        {/* Body Content */}
        <div className="flex-1 overflow-hidden p-4">
          {activeTab === "logs" ? (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  السجلات الملتقطة من الكاميرا / الماسح (مع المخرجات للكونسول Console):
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyLogsToClipboard}
                    className="h-7 text-[11px] gap-1 border-slate-700 hover:bg-slate-800"
                    disabled={logs.length === 0}
                  >
                    <Copy className="w-3 h-3" />
                    {copied ? "تم النسخ!" : "نسخ السجلات"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onClearLogs}
                    className="h-7 text-[11px] gap-1"
                    disabled={logs.length === 0}
                  >
                    <Trash2 className="w-3 h-3" />
                    مسح السجل
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2 text-center">
                    <Terminal className="w-8 h-8 text-slate-600" />
                    <p className="text-sm font-semibold">لا توجد عمليات مسح مسجلة بعد</p>
                    <p className="text-xs max-w-sm">
                      قم بتشغيل الكاميرا وتوجيه باركود (أو اكتب رمزاً في حقل الفحص التجريبي أعلاه) لمشاهدة تحليل التشخيص الدقيق
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-3 rounded-lg border text-xs transition-all ${
                          log.matched
                            ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                            : "bg-red-950/40 border-red-500/40 text-red-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            {log.matched ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                            )}
                            <span className="font-bold text-white text-sm" dir="ltr">
                              "{log.cleanCode}"
                            </span>
                            <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300">
                              طول الرمز: {log.length} خانة
                            </Badge>
                            {log.matched ? (
                              <Badge className="bg-emerald-600/30 text-emerald-300 border-emerald-500/50 text-[10px]">
                                تم التطابق وإضافته للسلة ✅
                              </Badge>
                            ) : (
                              <Badge className="bg-red-600/30 text-red-300 border-red-500/50 text-[10px]">
                                غير مسجل بالمخزون ❌
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-sans">{log.timestamp}</span>
                        </div>

                        <div className="text-[11px] text-slate-300 bg-black/40 p-2 rounded border border-white/5 space-y-1 font-sans">
                          <div>
                            <strong className="text-amber-300">النتيجة: </strong>
                            <span>{log.details}</span>
                          </div>
                          {log.matchedProduct && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 mt-1 border-t border-white/10 text-xs">
                              <div><span className="text-slate-400">الاسم:</span> <strong className="text-white">{log.matchedProduct.name}</strong></div>
                              <div><span className="text-slate-400">باركود الصنف:</span> <strong className="text-amber-200" dir="ltr">{log.matchedProduct.barcode || "—"}</strong></div>
                              <div><span className="text-slate-400">السعر:</span> <strong className="text-emerald-300">{log.matchedProduct.price}</strong></div>
                              <div><span className="text-slate-400">المخزون:</span> <strong className="text-sky-300">{log.matchedProduct.stock}</strong></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                  <Input
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="بحث في الأصناف والباركود المخزن..."
                    className="pr-9 h-8 bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
                <Badge variant="outline" className="text-xs text-slate-300 border-slate-700">
                  {filteredProducts.length} صنف
                </Badge>
              </div>

              <ScrollArea className="flex-1 rounded-lg border border-slate-800 bg-slate-950">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">رقم الصنف</th>
                      <th className="p-2.5">اسم المنتج</th>
                      <th className="p-2.5">الباركود المخزن</th>
                      <th className="p-2.5">طول الباركود</th>
                      <th className="p-2.5">السعر</th>
                      <th className="p-2.5">الحالة</th>
                      <th className="p-2.5 text-center">اختبار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-2.5 font-mono text-slate-400">{p.number || p.id}</td>
                        <td className="p-2.5 font-semibold text-white">{p.name}</td>
                        <td className="p-2.5 font-mono text-amber-300 font-bold" dir="ltr">
                          {p.barcode || <span className="text-slate-600 font-normal italic">لا يوجد باركود</span>}
                        </td>
                        <td className="p-2.5 text-slate-400">{p.barcode ? `${p.barcode.length} خانة` : "—"}</td>
                        <td className="p-2.5 text-emerald-400 font-bold">{p.price}</td>
                        <td className="p-2.5">
                          {p.active === false ? (
                            <Badge variant="destructive" className="text-[10px]">معطل</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">نشط</Badge>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {p.barcode && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                onSimulateScan(p.barcode!);
                                setActiveTab("logs");
                              }}
                              className="h-6 text-[11px] text-amber-300 hover:text-white hover:bg-amber-600/30 px-2"
                            >
                              فحص مطابقة
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

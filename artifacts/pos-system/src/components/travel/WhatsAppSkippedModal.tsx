import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  MessageCircle,
  Phone,
  Printer,
  User,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  X,
  Send,
} from "lucide-react";

export interface SkippedItem {
  id: number | string;
  name: string;
  phone: string;
  reason: string;
}

export interface SuccessItem {
  id: number | string;
  name: string;
  phone: string;
  docUrl?: string;
  fileName?: string;
  whatsappAppUri?: string;
  whatsappWebUri?: string;
}

interface WhatsAppSkippedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skippedList: SkippedItem[];
  successCount: number;
  successList?: SuccessItem[];
  totalCount?: number;
  onEditPassenger?: (passengerId: number | string) => void;
  onRetrySingle?: (passengerId: number | string) => void;
}

export const WhatsAppSkippedModal: React.FC<WhatsAppSkippedModalProps> = ({
  open,
  onOpenChange,
  skippedList = [],
  successCount = 0,
  successList = [],
  totalCount,
  onEditPassenger,
  onRetrySingle,
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "success" | "skipped">(
    skippedList.length > 0 && successCount === 0 ? "skipped" : "all"
  );
  const [copiedSummary, setCopiedSummary] = useState(false);

  const total = totalCount || (successCount + skippedList.length);
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 100;

  // Copy report summary text
  const handleCopySummary = () => {
    let text = `📊 *تقرير أتمتة الواتساب والمهام - أومني فلاي برو*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `• إجمالي السجلات المعالجة: ${total}\n`;
    text += `• المهام المكتملة بنجاح: ${successCount} (${successRate}%)\n`;
    text += `• المهام غير المكتملة/المتخطاة: ${skippedList.length}\n`;
    text += `• التاريخ: ${new Date().toLocaleDateString("ar-SA")}\n\n`;

    if (skippedList.length > 0) {
      text += `⚠️ *تفاصيل السجلات غير المكتملة:*\n`;
      skippedList.forEach((item, i) => {
        text += `${i + 1}. ${item.name} (${item.phone}): ${item.reason}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  // Print Report Handler
  const handlePrintReport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير أتمتة إرسال الواتساب والبطاقات الرسمية</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
          .header { border-bottom: 2px solid #047857; padding-bottom: 15px; margin-bottom: 20px; text-align: center; }
          .header h1 { margin: 0 0 5px 0; color: #047857; font-size: 22px; }
          .stats { display: flex; gap: 15px; margin-bottom: 20px; }
          .stat-box { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; }
          .stat-box.success { background: #f0fdf4; border-color: #86efac; color: #166534; }
          .stat-box.skipped { background: #fffbeb; border-color: #fde68a; color: #92400e; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right; }
          th { background: #f8fafc; font-weight: bold; }
          .badge-success { color: #166534; font-weight: bold; }
          .badge-danger { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير أتمتة مراسلات الواتساب وحفظ بطاقات المسافرين (PDF)</h1>
          <p>وكالة أومني فلاي لخدمات السفر والعمرة - تاريخ التقرير: ${new Date().toLocaleString("ar-SA")}</p>
        </div>
        <div class="stats">
          <div class="stat-box"><strong>إجمالي المسافرين:</strong> ${total}</div>
          <div class="stat-box success"><strong>المهام المكتملة بنجاح:</strong> ${successCount} (${successRate}%)</div>
          <div class="stat-box skipped"><strong>الأرقام غير المكتملة/المتخطاة:</strong> ${skippedList.length}</div>
        </div>
        ${
          skippedList.length > 0
            ? `
          <h3>سجلات الأرقام غير المكتملة وأسباب التخطي:</h3>
          <table>
            <thead>
              <tr><th>#</th><th>اسم المسافر</th><th>رقم الهاتف</th><th>السبب الدقيق للتخطي</th></tr>
            </thead>
            <tbody>
              ${skippedList
                .map(
                  (item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.name}</strong></td>
                  <td dir="ltr">${item.phone || "فارغ"}</td>
                  <td class="badge-danger">${item.reason}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `
            : `<p style="color: #166534; font-weight: bold;">✓ تم إرسال وتوثيق كافة رسائل وبطاقات المسافرين بنجاح 100%.</p>`
        }
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900">
                  تقرير المهام والأتمتة الشامل لمراسلات الواتساب والـ PDF
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  تفاصيل المهام المنجزة بنجاح والسجلات المتخطاة مع أسبابها وإمكانية تصحيحها فوراً
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySummary}
                className="h-8 text-xs font-bold gap-1 text-slate-700"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSummary ? "تم النسخ" : "نسخ الملخص"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintReport}
                className="h-8 text-xs font-bold gap-1 text-slate-700 hover:bg-slate-100"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                طباعة
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs text-slate-500 font-bold">إجمالي المسافرين</div>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">{total} سجل</div>
              <div className="text-[10px] text-slate-400 mt-0.5">تمت معالجتهم بالكامل</div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-800 font-bold">المهام المكتملة بنجاح</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-950 mt-1 font-mono">
                {successCount} <span className="text-xs font-normal text-emerald-700">({successRate}%)</span>
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">تم فتح المحادثات وحفظ ملفات الـ PDF ✓</div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-800 font-bold">السجلات غير المكتملة/المتخطاة</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-black text-amber-950 mt-1 font-mono">{skippedList.length} سجل</div>
              <div className="text-[10px] text-amber-700 mt-0.5">تم التخطي التلقائي لمواصلة بقية المسافرين</div>
            </div>
          </div>

          {/* Tab Filter Controls */}
          <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              جميع السجلات ({total})
            </button>
            <button
              onClick={() => setActiveTab("success")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === "success"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              المهام الناجحة ({successCount})
            </button>
            <button
              onClick={() => setActiveTab("skipped")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === "skipped"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              المتخطاة وغير المكتملة ({skippedList.length})
            </button>
          </div>

          {/* List Content */}
          <div className="space-y-2">
            {activeTab === "skipped" && (
              <div className="text-[11px] text-slate-600 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200/80 leading-relaxed">
                💡 <strong>معلومات تخطي السجلات:</strong> عندما يواجه النظام مسافراً برقم فارغ أو غير صالح، يتخطاه فوراً وينتقل تلقائياً للمسافر التالي لضمان عدم توقف العمل. يمكنك تعديل أرقامهم من الزر بالأسفل وإعادة إرسالهم مباشرة.
              </div>
            )}

            {/* Incomplete / Skipped Table */}
            {(activeTab === "all" || activeTab === "skipped") && skippedList.length > 0 && (
              <div className="border border-amber-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-amber-50/90 px-3.5 py-2 border-b border-amber-200 flex items-center justify-between text-xs font-bold text-amber-900">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>سجلات المهام غير المكتملة أو المتخطاة ({skippedList.length})</span>
                  </div>
                  <span className="text-[10px] text-amber-700">موضحة مع السبب الدقيق</span>
                </div>

                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">اسم المسافر</th>
                      <th className="py-2.5 px-3">رقم الهاتف المسجل</th>
                      <th className="py-2.5 px-3">السبب الدقيق للتخطي</th>
                      {onEditPassenger && <th className="py-2.5 px-3 text-center">الإجراء</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {skippedList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {item.name}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700" dir="ltr">
                          {item.phone && item.phone !== "فارغ" && item.phone !== "غير مسجل" ? (
                            item.phone
                          ) : (
                            <span className="text-rose-500 font-sans text-[11px] font-bold">غير مسجل / فارغ</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-rose-600 font-semibold text-[11px]">
                          {item.reason}
                        </td>
                        {onEditPassenger && (
                          <td className="py-2.5 px-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] font-bold border-amber-300 text-amber-900 hover:bg-amber-100 gap-1"
                              onClick={() => {
                                onOpenChange(false);
                                onEditPassenger(item.id);
                              }}
                            >
                              تصحيح الرقم
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Successful Tasks Table (when available or filtered) */}
            {(activeTab === "all" || activeTab === "success") && successCount > 0 && (
              <div className="border border-emerald-200 rounded-xl overflow-hidden shadow-sm bg-white mt-3">
                <div className="bg-emerald-50/90 px-3.5 py-2 border-b border-emerald-200 flex items-center justify-between text-xs font-bold text-emerald-900">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>المهام المكتملة والإرساليات الناجحة ({successCount})</span>
                  </div>
                  <span className="text-[10px] text-emerald-700">تم تجهيز المستندات والتوجيه للواتساب</span>
                </div>

                <div className="p-3 bg-emerald-50/30 text-xs text-emerald-900 flex items-center justify-between">
                  <span>تم إنجاز إرسال التنبيهات وتوليد ملفات الـ PDF الرسمية بنجاح لـ <strong>{successCount}</strong> مسافر.</span>
                  <span className="font-mono text-emerald-700 font-bold">حالة النظام: مكتمل ✓</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-slate-500">
            Omni System Pro - نظام أتمتة وتوثيق السفر ومراسلات الواتساب
          </div>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
          >
            إغلاق ومتابعة العمل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


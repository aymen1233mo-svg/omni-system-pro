import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useGetOrders, useDeleteOrder, getGetOrdersQueryKey } from "@workspace/api-client-react";
import type { Order } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { Trash2, Eye, Search, RotateCcw, Printer, Maximize2, FileDown } from "lucide-react";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { printA4Html } from "@/lib/printUtils";

export default function Orders() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { data: orders = [], isLoading } = useGetOrders({ startDate: startDate || undefined, endDate: endDate || undefined });
  const deleteMutation = useDeleteOrder();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportTitle, setReportTitle] = useState("");

  const buildOrderHtml = (order: Order) => {
    const itemsHtml = order.items?.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="text-align: right; font-weight: bold;">${item.productName}</td>
        <td>${item.quantity}</td>
        <td style="font-family: monospace;">${item.price?.toFixed(2) || "0.00"}</td>
        <td style="font-family: monospace; font-weight: bold;">${item.total.toFixed(2)} YER</td>
      </tr>
    `).join("");

    return `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 25px; border: 1px solid #cbd5e1; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 15px;">
          <h2 style="margin: 0; color: #0369a1;">فاتورة مبيعات نقاط البيع POS</h2>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">رقم الفاتورة: ${order.invoiceNumber}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 15px; background: #f8fafc; padding: 10px; border-radius: 6px;">
          <div><strong>التاريخ والوقت:</strong> ${new Date(order.createdAt).toLocaleString("ar-SA")}</div>
          <div><strong>الكاشير المسجل:</strong> ${order.userName || "النظام"}</div>
          <div><strong>طريقة الدفع:</strong> ${pmLabel(order.paymentMethod)}</div>
          <div><strong>العميل:</strong> ${order.customerName || "عميل نقدي عام"}</div>
        </div>

        <table>
          <thead>
            <tr style="background: #e0f2fe; color: #0369a1;">
              <th>#</th>
              <th style="text-align: right;">الصنف</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || "<tr><td colspan='5'>لا توجد أصناف</td></tr>"}
          </tbody>
        </table>

        <div style="margin-top: 15px; border-top: 2px solid #0284c7; padding-top: 10px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>المجموع الفرعي:</span><span style="font-mono">${(order.subtotal ?? 0).toFixed(2)} YER</span></div>
          ${(order.discount ?? 0) > 0 ? `<div style="display: flex; justify-content: space-between; color: #dc2626; margin-bottom: 4px;"><span>الخصم:</span><span>-${(order.discount ?? 0).toFixed(2)} YER</span></div>` : ""}
          ${(order.tax ?? 0) > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>الضريبة:</span><span>${(order.tax ?? 0).toFixed(2)} YER</span></div>` : ""}
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; color: #0284c7; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px;"><span>الإجمالي النهائي:</span><span>${order.total.toFixed(2)} YER</span></div>
        </div>
      </div>
    `;
  };

  const handlePreviewOrder = (order: Order) => {
    const html = buildOrderHtml(order);
    setReportHtml(html);
    setReportTitle(`معاينة فاتورة مبيعات #${order.invoiceNumber}`);
    setReportViewerOpen(true);
  };

  const handlePrintOrderDirect = (order: Order) => {
    const html = buildOrderHtml(order);
    printA4Html(html, `فاتورة_مبيعات_${order.invoiceNumber}`);
  };

  const handleExportOrderPdf = (order: Order) => {
    const html = buildOrderHtml(order);
    setReportHtml(html);
    setReportTitle(`فاتورة_مبيعات_${order.invoiceNumber}`);
    setReportViewerOpen(true);
  };

  const handleDelete = (order: Order) => {
    if (!confirm(`حذف الفاتورة ${order.invoiceNumber}؟`)) return;
    deleteMutation.mutate({ id: order.id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetOrdersQueryKey() }),
      onError: () => toast({ variant: "destructive", title: "فشل في الحذف" })
    });
  };

  const pmLabel = (m: string) => {
    if (m === "cash" || m === "نقدي") return "نقداً";
    if (m === "card" || m === "شبكة") return "شبكة";
    if (m === "credit" || m === "آجل") return "آجل (حساب/وجبة)";
    if (m === "split" || m === "mixed") return "مختلط";
    return m || "نقداً";
  };

  const getCustomerOrEmpName = (o: Order) => {
    if (o.customerName) return o.customerName;
    if (o.note && o.note.includes("وجبة موظف")) return o.note;
    return "عميل نقدي عام";
  };

  const buildOrdersSummaryHtml = () => {
    const rowsHtml = orders.map((o, idx) => `
      <tr>
        <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">${idx + 1}</td>
        <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">${o.invoiceNumber}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${new Date(o.createdAt).toLocaleString("ar-SA")}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${o.userName || "-"}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${getCustomerOrEmpName(o)}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${pmLabel(o.paymentMethod)}</td>
        <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold;">${o.total.toFixed(2)}</td>
      </tr>
    `).join("");
    const totalSum = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    return `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 20px;">
        <h2 style="text-align:center; color:#0f172a; margin-bottom:16px;">كشف فواتير المبيعات المركزية — Omni System Pro ERP</h2>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:8px; border:1px solid #cbd5e1;">#</th>
              <th style="padding:8px; border:1px solid #cbd5e1;">رقم الفاتورة</th>
              <th style="padding:8px; border:1px solid #cbd5e1;">التاريخ والوقت</th>
              <th style="padding:8px; border:1px solid #cbd5e1;">الكاشير</th>
              <th style="padding:8px; border:1px solid #cbd5e1;">العميل / الموظف</th>
              <th style="padding:8px; border:1px solid #cbd5e1;">طريقة الدفع</th>
              <th style="padding:8px; border:1px solid #cbd5e1;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background:#e2e8f0; font-weight:bold;">
              <td colspan="6" style="padding:8px; border:1px solid #cbd5e1; text-align:left;">إجمالي المبيعات (${orders.length} فاتورة):</td>
              <td style="padding:8px; border:1px solid #cbd5e1;">${totalSum.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">فواتير المبيعات المركزية ونقاط البيع</h1>
          <div className="flex gap-2 items-center flex-wrap">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" placeholder="من" />
            <span className="text-muted-foreground">-</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" placeholder="إلى" />
            <Button variant="outline" size="sm" className="gap-1.5 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" onClick={() => { setReportHtml(buildOrdersSummaryHtml()); setReportTitle("معاينة كشف فواتير المبيعات"); setReportViewerOpen(true); }}>
              <Maximize2 className="w-4 h-4" /> معاينة بشاشة كاملة
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printA4Html(buildOrdersSummaryHtml(), "كشف_فواتير_المبيعات")}>
              <Printer className="w-4 h-4" /> طباعة
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" onClick={() => { setReportHtml(buildOrdersSummaryHtml()); setReportTitle("كشف_فواتير_المبيعات_PDF"); setReportViewerOpen(true); }}>
              <FileDown className="w-4 h-4" /> توليد PDF
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-right p-3 font-semibold">رقم الفاتورة</th>
                  <th className="text-right p-3 font-semibold">التاريخ والوقت</th>
                  <th className="text-right p-3 font-semibold">الكاشير</th>
                  <th className="text-right p-3 font-semibold">العميل / الموظف</th>
                  <th className="text-right p-3 font-semibold">طريقة الدفع</th>
                  <th className="text-left p-3 font-semibold">الإجمالي</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono font-bold text-primary">{order.invoiceNumber}</td>
                    <td className="p-3 text-xs">{new Date(order.createdAt).toLocaleString("ar-SA")}</td>
                    <td className="p-3">{order.userName}</td>
                    <td className="p-3 text-xs font-semibold">{getCustomerOrEmpName(order)}</td>
                    <td className="p-3"><Badge variant="outline">{pmLabel(order.paymentMethod)}</Badge></td>
                    <td className="p-3 text-left font-bold text-amber-600">{order.total.toFixed(2)}</td>
                    <td className="p-3">
                      <div className="flex gap-1.5 justify-end items-center flex-wrap">
                        <button onClick={() => setViewOrder(order)} className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-slate-100" title="تفاصيل الفاتورة"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handlePreviewOrder(order)} className="text-blue-600 hover:text-blue-700 p-1 rounded bg-blue-50 hover:bg-blue-100" title="معاينة بشاشة كاملة"><Maximize2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handlePrintOrderDirect(order)} className="text-emerald-600 hover:text-emerald-700 p-1 rounded bg-emerald-50 hover:bg-emerald-100" title="طباعة الفاتورة"><Printer className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleExportOrderPdf(order)} className="text-purple-600 hover:text-purple-700 p-1 rounded bg-purple-50 hover:bg-purple-100" title="توليد ملف PDF"><FileDown className="w-3.5 h-3.5" /></button>
                        <Link href={`/returns?invoice=${encodeURIComponent(order.invoiceNumber)}&orderId=${order.id}`} className="text-blue-600 hover:text-blue-700 font-semibold text-xs flex items-center gap-1 bg-blue-50 px-2 py-1 rounded" title="إرجاع صنف أو الفاتورة كاملة">
                          <RotateCcw className="w-3.5 h-3.5" />إرجاع
                        </Link>
                        <button onClick={() => handleDelete(order)} className="text-muted-foreground hover:text-red-600 p-1" title="حذف الفاتورة"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">لا توجد فواتير</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!viewOrder} onOpenChange={() => setViewOrder(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تفاصيل الفاتورة {viewOrder?.invoiceNumber}</DialogTitle></DialogHeader>
          {viewOrder && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><span className="font-medium text-foreground">التاريخ: </span>{new Date(viewOrder.createdAt).toLocaleString("ar-SA")}</div>
                <div><span className="font-medium text-foreground">الكاشير: </span>{viewOrder.userName}</div>
                <div><span className="font-medium text-foreground">طريقة الدفع: </span>{pmLabel(viewOrder.paymentMethod)}</div>
                {viewOrder.customerName && <div><span className="font-medium text-foreground">العميل: </span>{viewOrder.customerName}</div>}
              </div>
              <table className="w-full">
                <thead><tr className="border-b"><th className="text-right py-1">الصنف</th><th className="text-center py-1">ك</th><th className="text-left py-1">الإجمالي</th></tr></thead>
                <tbody>
                  {viewOrder.items?.map((item, i) => (
                    <tr key={i} className="border-b border-dashed">
                      <td className="py-1">{item.productName}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-left">{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1 border-t pt-2">
                <div className="flex justify-between"><span>المجموع الفرعي</span><span>{(viewOrder.subtotal ?? 0).toFixed(2)}</span></div>
                {(viewOrder.discount ?? 0) > 0 && <div className="flex justify-between text-red-500"><span>خصم</span><span>-{(viewOrder.discount ?? 0).toFixed(2)}</span></div>}
                {(viewOrder.tax ?? 0) > 0 && <div className="flex justify-between"><span>ضريبة</span><span>{(viewOrder.tax ?? 0).toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-1"><span>الإجمالي</span><span className="text-amber-600">{viewOrder.total.toFixed(2)}</span></div>
              </div>

              <DialogFooter className="gap-2 flex-wrap pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => setViewOrder(null)}>إغلاق</Button>
                <Button
                  size="sm"
                  onClick={() => handlePreviewOrder(viewOrder)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5"
                >
                  <Maximize2 className="w-4 h-4" />
                  معاينة بشاشة كاملة
                </Button>
                <Button
                  size="sm"
                  onClick={() => handlePrintOrderDirect(viewOrder)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  طباعة
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleExportOrderPdf(viewOrder)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1.5"
                >
                  <FileDown className="w-4 h-4" />
                  توليد PDF
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReportViewerModal
        isOpen={reportViewerOpen}
        onClose={() => setReportViewerOpen(false)}
        htmlContent={reportHtml}
        title={reportTitle}
      />
    </AdminLayout>
  );
}

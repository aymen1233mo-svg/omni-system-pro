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
import { printA4Html, generateWarehouseInvoiceA4Html } from "@/lib/printUtils";

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
    const formattedInvoice = {
      invoice_number: order.invoiceNumber,
      invoice_no: order.invoiceNumber,
      invoice_date: order.createdAt ? String(order.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
      invoice_time: order.createdAt ? new Date(order.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "",
      customer_name: order.customerName || "عميل نقدي عام",
      payment_type: order.paymentMethod || "cash",
      payment_method: order.paymentMethod || "cash",
      subtotal: order.subtotal || order.total,
      discount_amount: order.discount || 0,
      tax_amount: order.tax || 0,
      net_amount: order.total,
      currency: "YER",
      items: (order.items || []).map((it) => ({
        product_name: it.productName,
        quantity: it.quantity,
        price: it.price,
        total: it.total,
      })),
    };
    return generateWarehouseInvoiceA4Html(formattedInvoice);
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

  const statusBadge = (s?: string) => {
    if (s === "returned") {
      return <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 font-semibold">مرتجع بالكامل</Badge>;
    }
    if (s === "partially_returned") {
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 font-semibold">مرتجع جزئياً</Badge>;
    }
    if (s === "cancelled") {
      return <Badge className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200">ملغاة</Badge>;
    }
    return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-medium">مكتملة</Badge>;
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
                  <th className="text-center p-3 font-semibold">الحالة</th>
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
                    <td className="p-3 text-center">{statusBadge(order.status)}</td>
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
                <div><span className="font-medium text-foreground">حالة الفاتورة: </span>{statusBadge(viewOrder.status)}</div>
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

import { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useGetSalesReport, useGetPrintersList } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Printer, Download, TrendingUp, ShoppingBag, Users, Tag, Maximize2, FileDown, Eye, RotateCcw } from "lucide-react";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { saveA4PdfToFile } from "@/lib/printUtils";

const COLORS = ["#1e3a5f", "#3b82f6", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444", "#06b6d4"];

type Tab = "sales" | "cashier" | "warehouse_sales" | "product" | "category" | "payment" | "purchases" | "inventory" | "expenses" | "shifts" | "tax" | "waste";

const TAB_LABELS: Record<Tab, string> = {
  sales: "المبيعات اليومية",
  cashier: "مبيعات نقطة المبيعات (الكاشير)",
  warehouse_sales: "مبيعات فواتير المبيعات المخزنية",
  product: "بالمنتج",
  category: "بالفئة",
  payment: "بطريقة الدفع",
  purchases: "المشتريات والموردون",
  inventory: "تقييم المخزون",
  expenses: "المصروفات التشغيلية",
  shifts: "المناوبات وتصفيات الصندوق",
  tax: "الإقرار الضريبي (VAT)",
  waste: "الهدر والتالف",
};

function fetchWithAuth<T>(url: string): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${r.status}`);
    }
    return r.json();
  });
}

function fmt(n: number) { return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function Reports() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localToday = `${year}-${month}-${day}`;
  const localStartOfMonth = `${year}-${month}-01`;

  const [startDate, setStartDate] = useState(localStartOfMonth);
  const [endDate, setEndDate] = useState(localToday);

  const setTodayFilter = () => {
    setStartDate(localToday);
    setEndDate(localToday);
  };
  const setMonthFilter = () => {
    setStartDate(localStartOfMonth);
    setEndDate(localToday);
  };
  const setAllTimeFilter = () => {
    setStartDate("2026-01-01");
    setEndDate("2030-12-31");
  };
  const [groupBy, setGroupBy] = useState<"day" | "month" | "year">("day");
  const [tab, setTab] = useState<Tab>("sales");
  const [showPrintDlg, setShowPrintDlg] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState("__window__");
  const [printPaperFormat, setPrintPaperFormat] = useState<"80mm" | "a4">("a4");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerHtml, setViewerHtml] = useState("");
  const [viewerTitle, setViewerTitle] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const getReportHtmlContent = () => {
    if (printRef.current) {
      return printRef.current.innerHTML;
    }
    return `<div style="text-align: center; padding: 20px;"><h3>تقرير ${TAB_LABELS[tab]}</h3><p>الفترة من ${startDate} إلى ${endDate}</p></div>`;
  };

  const handleFullscreenPreview = () => {
    setViewerHtml(getReportHtmlContent());
    setViewerTitle(`معاينة تقرير ${TAB_LABELS[tab]} (${startDate} إلى ${endDate})`);
    setViewerOpen(true);
  };

  const handleExportPdf = () => {
    setViewerHtml(getReportHtmlContent());
    setViewerTitle(`تقرير_${TAB_LABELS[tab]}_${startDate}_${endDate}`);
    setViewerOpen(true);
  };

  const dateParams = `?startDate=${startDate}&endDate=${endDate}`;
  const { data: rawSalesRows = [], isLoading: isSalesLoading } = useGetSalesReport({ startDate, endDate, groupBy });
  const salesRows = Array.isArray(rawSalesRows) ? rawSalesRows : [];

  const { data: rawCashierRows = [] } = useQuery<any[]>({ queryKey: ["reports-cashier", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/by-cashier${dateParams}`) });
  const cashierRows = Array.isArray(rawCashierRows) ? rawCashierRows : [];

  const { data: rawWarehouseSalesRows = [] } = useQuery<any[]>({ queryKey: ["reports-warehouse-sales", startDate, endDate], queryFn: () => fetchWithAuth(`/api/warehouse-invoices`) });
  const warehouseSalesRows = Array.isArray(rawWarehouseSalesRows) ? rawWarehouseSalesRows : [];

  const { data: rawProductRows = [] } = useQuery<any[]>({ queryKey: ["reports-product", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/by-product${dateParams}`) });
  const productRows = Array.isArray(rawProductRows) ? rawProductRows : [];

  const { data: rawCategoryRows = [] } = useQuery<any[]>({ queryKey: ["reports-category", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/by-category${dateParams}`) });
  const categoryRows = Array.isArray(rawCategoryRows) ? rawCategoryRows : [];

  const { data: rawPaymentRows = [] } = useQuery<any[]>({ queryKey: ["reports-payment", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/by-payment${dateParams}`) });
  const paymentRows = Array.isArray(rawPaymentRows) ? rawPaymentRows : [];
  const { data: settings } = useQuery<any>({ queryKey: ["settings"], queryFn: () => fetchWithAuth("/api/settings") });
  const { data: printerSettings } = useQuery<any>({ queryKey: ["printerSettings"], queryFn: () => fetchWithAuth("/api/printer-settings") });

  const businessName = settings?.businessName || "اسم النشاط التجاري";
  const currency = settings?.currency || "ريال";
  
  const { data: purchasesData } = useQuery<any>({ queryKey: ["reports-purchases", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/purchases${dateParams}`) });
  const { data: inventoryData } = useQuery<any>({ queryKey: ["reports-inventory"], queryFn: () => fetchWithAuth(`/api/reports/inventory`) });
  const { data: expensesData } = useQuery<any>({ queryKey: ["reports-expenses", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/expenses${dateParams}`) });
  const { data: shiftsData } = useQuery<any>({ queryKey: ["reports-shifts", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/shifts${dateParams}`) });
  const { data: taxData } = useQuery<any>({ queryKey: ["reports-tax", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/tax${dateParams}`) });
  const { data: wasteData } = useQuery<any>({ queryKey: ["reports-waste", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/waste${dateParams}`) });

  const { data: printers = [] } = useGetPrintersList();

  const totalNetSales = (salesRows || []).reduce((s, r) => s + r.total, 0);
  const totalGrossSales = (salesRows || []).reduce((s, r) => s + (r.gross_total ?? r.total), 0);
  const totalReturnsAmount = (salesRows || []).reduce((s, r) => s + (r.returnsTotal ?? 0), 0);
  const totalOrders = (salesRows || []).reduce((s, r) => s + r.orders, 0);
  const totalDiscount = (salesRows || []).reduce((s, r) => s + ((r as any).discount ?? 0), 0);
  const totalTax = (salesRows || []).reduce((s, r) => s + ((r as any).tax ?? 0), 0);

  // Category totals
  const categoryTotalOrders = (categoryRows || []).reduce((s, r: any) => s + (r.orderCount || 0), 0);
  const categoryTotalQty = (categoryRows || []).reduce((s, r: any) => s + (r.totalQty || 0), 0);
  const categoryTotalRevenue = (categoryRows || []).reduce((s, r: any) => s + (r.totalRevenue || 0), 0);

  // Cashier totals
  const cashierTotalOrders = (cashierRows || []).reduce((s, r: any) => s + (r.orders || 0), 0);
  const cashierGrossTotal = (cashierRows || []).reduce((s, r: any) => s + (r.grossTotal ?? r.total), 0);
  const cashierTotalReturns = (cashierRows || []).reduce((s, r: any) => s + (r.returnsTotal || 0), 0);
  const cashierNetTotal = (cashierRows || []).reduce((s, r: any) => s + (r.total || 0), 0);
  const cashierTotalDiscount = (cashierRows || []).reduce((s, r: any) => s + (r.discount || 0), 0);
  const cashierTotalTax = (cashierRows || []).reduce((s, r: any) => s + (r.tax || 0), 0);

  // Payment totals
  const paymentTotalOrders = (paymentRows || []).reduce((s, r: any) => s + (r.orders || 0), 0);
  const paymentGrossTotal = (paymentRows || []).reduce((s, r: any) => s + (r.grossTotal ?? r.total), 0);
  const paymentReturnsTotal = (paymentRows || []).reduce((s, r: any) => s + (r.returnsTotal || 0), 0);
  const paymentNetTotal = (paymentRows || []).reduce((s, r: any) => s + (r.total || 0), 0);

  // Product totals
  const productTotalQty = (productRows || []).reduce((s, r: any) => s + (r.totalQty || 0), 0);
  const productTotalOrders = (productRows || []).reduce((s, r: any) => s + (r.orderCount || 0), 0);
  const productTotalRevenue = (productRows || []).reduce((s, r: any) => s + (r.totalRevenue || 0), 0);
  const productTotalProfit = (productRows || []).reduce((s, r: any) => s + (r.totalProfit || 0), 0);

  const handlePrint = () => {
    const styleId = "__report-dynamic-print__";
    document.getElementById(styleId)?.remove();

    if (printPaperFormat === "80mm") {
      const ps = printerSettings;
      const pw = ps?.paperWidth ?? 80;
      const lm = ps?.leftMargin ?? 1.5;
      const rm = ps?.rightMargin ?? 1.5;
      const tm = ps?.topMargin ?? 1;
      const bm = ps?.bottomMargin ?? 1;
      const fs = ps?.fontSize ?? 10;
      const printableWidth = pw === 58 ? 48 : (pw - 8);

      const el = document.createElement("style");
      el.id = styleId;
      el.textContent = `
        @page { size: ${pw}mm auto; margin: 0; }
        .hidden-print-container, #report-print-area {
          width: ${printableWidth}mm !important;
          margin: 0 auto !important;
          padding: ${tm}mm ${rm}mm ${bm}mm ${lm}mm !important;
          box-sizing: border-box !important;
          font-size: ${fs}px !important;
        }
        #report-print-area table {
          font-size: ${Math.max(8, fs - 1)}px !important;
          width: 100% !important;
          table-layout: auto !important;
        }
        #report-print-area th, #report-print-area td {
          padding: 3px 2px !important;
          word-break: break-word !important;
        }
        #report-print-area h1 { font-size: ${fs + 3}px !important; margin-bottom: 2px !important; }
        #report-print-area h2 { font-size: ${fs + 1}px !important; margin-bottom: 2px !important; }
        #report-print-area p { font-size: ${fs - 1}px !important; }
      `;
      document.head.appendChild(el);
    } else {
      const el = document.createElement("style");
      el.id = styleId;
      el.textContent = `
        @page { size: A4 portrait; margin: 10mm; }
        .hidden-print-container, #report-print-area {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }
      `;
      document.head.appendChild(el);
    }

    window.print();
    setShowPrintDlg(false);
    setTimeout(() => {
      document.getElementById(styleId)?.remove();
    }, 1000);
  };

  const paymentLabel = (m: string) => m === "cash" ? "نقداً" : m === "card" ? "شبكة" : m === "mixed" ? "مختلط" : m;

  return (
    <AdminLayout>
      {/* Hidden print area */}
      <div className="hidden-print-container" ref={printRef}>
        {printPaperFormat === "80mm" ? (
          <div id="report-print-area" style={{ fontFamily: "Tahoma, Arial, sans-serif", direction: "rtl", padding: "4px", width: "100%", color: "#000" }}>
            {/* Thermal Receipt Format */}
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <h1 style={{ fontSize: "16px", fontWeight: "900", margin: "0 0 4px 0" }}>{businessName}</h1>
              <h2 style={{ fontSize: "12px", fontWeight: "bold", margin: "0 0 2px 0" }}>تقرير المبيعات: {TAB_LABELS[tab]}</h2>
              <p style={{ fontSize: "10px", margin: "0 0 4px 0", color: "#333" }}>الفترة: {startDate} إلى {endDate}</p>
              <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
            </div>

            {tab === "sales" && (
              <div style={{ fontSize: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderBottom: "1px dashed #000", paddingBottom: "2px" }}>
                  <span>الفترة</span>
                  <span>الفواتير</span>
                  <span>الصافي</span>
                </div>
                {salesRows.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
                    <span>{r.period}</span>
                    <span>{r.orders}</span>
                    <span style={{ fontWeight: "bold" }}>{fmt(r.total)}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                  <span>الإجمالي الكلي</span>
                  <span>{totalOrders}</span>
                  <span>{fmt(totalNetSales)} {currency}</span>
                </div>
              </div>
            )}

            {tab === "cashier" && (
              <div style={{ fontSize: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderBottom: "1px dashed #000", paddingBottom: "2px" }}>
                  <span>اسم الكاشير</span>
                  <span>إجمالي المبيعات</span>
                </div>
                {cashierRows.map((r: any, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
                    <span>{r.userName}</span>
                    <span style={{ fontWeight: "bold" }}>{fmt(r.total)}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                  <span>الإجمالي الكلي</span>
                  <span>{fmt(cashierNetTotal)} {currency}</span>
                </div>
              </div>
            )}

            {tab === "category" && (
              <div style={{ fontSize: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderBottom: "1px dashed #000", paddingBottom: "2px" }}>
                  <span>الفئة / القسم</span>
                  <span>الكمية</span>
                  <span>إجمالي المبيعات</span>
                </div>
                {categoryRows.map((cat: any, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
                    <span style={{ fontWeight: "bold" }}>{cat.categoryName}</span>
                    <span>{cat.totalQty}</span>
                    <span style={{ fontWeight: "bold" }}>{fmt(cat.totalRevenue)}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12px" }}>
                  <span>الإجمالي الكلي</span>
                  <span>{categoryTotalQty}</span>
                  <span>{fmt(categoryTotalRevenue)} {currency}</span>
                </div>
              </div>
            )}

            {tab === "product" && (
              <div style={{ fontSize: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderBottom: "1px dashed #000", paddingBottom: "2px" }}>
                  <span>اسم المنتج</span>
                  <span>الكمية</span>
                  <span>إجمالي المبيعات</span>
                </div>
                {productRows.map((r: any, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", margin: "4px 0", borderBottom: "1px dotted #ccc", paddingBottom: "2px" }}>
                    <span style={{ fontWeight: "bold", maxWidth: "130px", wordBreak: "break-word" }}>{r.productName}</span>
                    <span>{r.totalQty}</span>
                    <span style={{ fontWeight: "bold" }}>{fmt(r.totalRevenue)}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12px" }}>
                  <span>الإجمالي الكلي</span>
                  <span>{productTotalQty}</span>
                  <span>{fmt(productTotalRevenue)} {currency}</span>
                </div>
              </div>
            )}

            {/* Default for other tabs */}
            {!["sales", "cashier", "category", "product"].includes(tab) && (
              <div style={{ fontSize: "10px", textAlign: "center", padding: "10px" }}>
                <p>التقرير: {TAB_LABELS[tab]}</p>
                <p>يرجى طباعة هذا التقرير التفصيلي بحجم ورق A4 للحصول على كامل الأعمدة والبيانات بالشكل السليم.</p>
              </div>
            )}

            <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ textAlign: "center", fontSize: "9px", color: "#555" }}>
              <p>نظام أومني سيستم برو لإدارة المبيعات والمستودعات</p>
              <p>{new Date().toLocaleDateString("ar-YE")} {new Date().toLocaleTimeString("ar-YE")}</p>
            </div>
          </div>
        ) : (
          <div id="report-print-area" style={{ fontFamily: "Tahoma, Arial, sans-serif", direction: "rtl", padding: "20px", maxWidth: "900px", margin: "0 auto", color: "#000" }}>
            
            {/* Header at top of page */}
            <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "12px", marginBottom: "16px" }}>
              <h1 style={{ fontSize: "22px", fontWeight: "900", margin: "0 0 6px 0", color: "#000" }}>{businessName}</h1>
              <h2 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 4px 0", color: "#222" }}>
                تقارير المبيعات التفصيلية — {TAB_LABELS[tab]}
              </h2>
              <p style={{ fontSize: "12px", color: "#333", margin: "0", fontWeight: "bold" }}>
                الفترة: من <strong>{startDate}</strong> إلى <strong>{endDate}</strong>
              </p>
            </div>

            {tab === "sales" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>الفترة</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الفواتير</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>إجمالي المبيعات</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left", color: "#e11d48" }}>المرتجعات</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left", color: "#059669" }}>صافي المبيعات</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الضريبة</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الخصم</th>
                </tr></thead>
                <tbody>
                  {salesRows.map((r, i) => <tr key={`sales-row-${r.period}-${i}`}>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{r.period}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{r.orders}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt(r.gross_total ?? r.total)}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", color: "#e11d48" }}>{(r.returnsTotal || 0) > 0 ? `-${fmt(r.returnsTotal)}` : "0.00"}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold", color: "#059669" }}>{fmt(r.total)}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt((r as any).tax ?? 0)}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt((r as any).discount ?? 0)}</td>
                  </tr>)}
                </tbody>
                <tfoot><tr style={{ background: "#f8fafc", fontWeight: "bold" }}>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>الإجمالي</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>{totalOrders}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(totalGrossSales)}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left", color: "#e11d48" }}>{totalReturnsAmount > 0 ? `-${fmt(totalReturnsAmount)}` : "0.00"}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left", color: "#059669" }}>{fmt(totalNetSales)}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(totalTax)}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(totalDiscount)}</td>
                </tr></tfoot>
              </table>
            )}

            {tab === "cashier" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>الكاشير</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الفواتير</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>إجمالي المبيعات</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left", color: "#e11d48" }}>المرتجعات</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left", color: "#059669" }}>صافي المبيعات</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الخصم</th>
                </tr></thead>
                <tbody>
                  {cashierRows.map((r: any, i) => <tr key={`cashier-row-${r.userId || ''}-${r.userName || ''}-${i}`}>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{r.userName}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{r.orders}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt(r.grossTotal ?? r.total)}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", color: "#e11d48" }}>{(r.returnsTotal || 0) > 0 ? `-${fmt(r.returnsTotal)}` : "0.00"}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold", color: "#059669" }}>{fmt(r.total)}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt(r.discount)}</td>
                  </tr>)}
                </tbody>
                {cashierRows.length > 0 && (
                  <tfoot><tr style={{ background: "#f8fafc", fontWeight: "bold" }}>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>الإجمالي</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>{cashierTotalOrders}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(cashierGrossTotal)}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left", color: "#e11d48" }}>{cashierTotalReturns > 0 ? `-${fmt(cashierTotalReturns)}` : "0.00"}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left", color: "#059669" }}>{fmt(cashierNetTotal)}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(cashierTotalDiscount)}</td>
                  </tr></tfoot>
                )}
              </table>
            )}

            {tab === "product" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "right" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#000", fontWeight: "bold" }}>
                    <th style={{ border: "1px solid #64748b", padding: "10px", textAlign: "right" }}>اسم المنتج</th>
                    <th style={{ border: "1px solid #64748b", padding: "10px", textAlign: "center" }}>عدد الكميه المباعه</th>
                    <th style={{ border: "1px solid #64748b", padding: "10px", textAlign: "left" }}>المبلغ ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((r: any, i: number) => (
                    <tr key={`product-row-${r.productId || ''}-${r.productName || ''}-${i}`} style={{ background: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px", fontWeight: "bold" }}>{r.productName}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "center" }}>{r.totalQty}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px", textAlign: "left", fontWeight: "bold" }}>{fmt(r.totalRevenue)}</td>
                    </tr>
                  ))}
                  {productRows.length === 0 && (
                    <tr><td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "16px", textAlign: "center", color: "#666" }}>لا توجد مبيعات للمنتجات في هذه الفترة</td></tr>
                  )}
                </tbody>
                {productRows.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#e2e8f0", fontWeight: "bold", fontSize: "14px" }}>
                      <td style={{ border: "1px solid #64748b", padding: "10px", textAlign: "right" }}>الإجمالي الكلي</td>
                      <td style={{ border: "1px solid #64748b", padding: "10px", textAlign: "center" }}>{productTotalQty}</td>
                      <td style={{ border: "1px solid #64748b", padding: "10px", textAlign: "left" }}>{fmt(productTotalRevenue)} {currency}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {tab === "category" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* Category Sales Summary (ملخص مبيعات الأقسام) */}
                <div style={{ marginBottom: "20px", border: "1.5px solid #cbd5e1", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ background: "#0f172a", color: "#fff", padding: "8px 12px", fontWeight: "bold", fontSize: "14px" }}>
                    📊 ملخص مبيعات الأقسام والفئات (Category Summary)
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "right" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", fontWeight: "bold" }}>
                        <th style={{ border: "1px solid #cbd5e1", padding: "10px" }}>اسم القسم أو المجموعة</th>
                        <th style={{ border: "1px solid #cbd5e1", padding: "10px", textAlign: "left" }}>إجمالي مبلغ مبيعات القسم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(categoryRows || []).map((cat: any, idx: number) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f1f5f9" }}>
                          <td style={{ border: "1px solid #cbd5e1", padding: "10px", fontWeight: "bold" }}>{cat.categoryName}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "10px", textAlign: "left", fontWeight: "bold", color: "#0d9488" }}>{fmt(cat.totalRevenue)} {currency}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#e2e8f0", fontWeight: "bold" }}>
                        <td style={{ border: "1px solid #cbd5e1", padding: "10px" }}>الإجمالي الكلي</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "10px", textAlign: "left", color: "#0f766e" }}>{fmt(categoryTotalRevenue)} {currency}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {categoryRows.map((cat: any, catIdx: number) => {
                  const items = cat.items || [];
                  return (
                    <div key={`cat-block-${cat.categoryId || ''}-${cat.categoryName || ''}-${catIdx}`} style={{ border: "1.5px solid #475569", borderRadius: "6px", overflow: "hidden", marginBottom: "12px" }}>
                      {/* Category Header Bar */}
                      <div style={{ background: "#1e293b", color: "#ffffff", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold", fontSize: "14px" }}>
                        <span>📂 قسم / فئة المنتج: {cat.categoryName}</span>
                        <span>إجمالي المبيعات: {fmt(cat.totalRevenue)} {currency} | الكمية المباعة: {cat.totalQty} | الفواتير: {cat.orderCount}</span>
                      </div>

                      {/* Detailed Product Sub-Table */}
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "right" }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", color: "#000", fontWeight: "bold" }}>
                            <th style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center", width: "30px" }}>#</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "right" }}>اسم المنتج</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "right" }}>قسم / فئة المنتج</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>سعر الوحدة</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>عدد المبيعات (الكمية المباعة)</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>عدد الفواتير</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "left" }}>إجمالي المبيعات ({currency})</th>
                            <th style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "left" }}>إجمالي الربح ({currency})</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item: any, itemIdx: number) => (
                            <tr key={`cat-item-${cat.categoryName || ''}-${item.productId || ''}-${item.productName || ''}-${itemIdx}`} style={{ background: itemIdx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                              <td style={{ border: "1px solid #e2e8f0", padding: "5px", textAlign: "center" }}>{itemIdx + 1}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: "5px", fontWeight: "bold" }}>{item.productName}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: "5px" }}>{item.categoryName || cat.categoryName}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: "5px", textAlign: "center" }}>{fmt(item.unitPrice ?? (item.totalQty > 0 ? item.totalRevenue / item.totalQty : 0))}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: "5px", textAlign: "center", fontWeight: "bold" }}>{item.totalQty}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: "5px", textAlign: "center" }}>{item.orderCount}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: "5px", textAlign: "left", fontWeight: "bold" }}>{fmt(item.totalRevenue)}</td>
                              <td style={{ border: "1px solid #e2e8f0", padding: "5px", textAlign: "left", color: "#16a34a", fontWeight: "bold" }}>{fmt(item.totalProfit)}</td>
                            </tr>
                          ))}
                          {items.length === 0 && (
                            <tr><td colSpan={8} style={{ border: "1px solid #e2e8f0", padding: "10px", textAlign: "center", color: "#888" }}>لا توجد تفاصيل منتجات لهذه الفئة</td></tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#e2e8f0", fontWeight: "bold", fontSize: "12px" }}>
                            <td colSpan={4} style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "right" }}>إجمالي فئة ({cat.categoryName})</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>{cat.totalQty}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "center" }}>{cat.orderCount}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "left" }}>{fmt(cat.totalRevenue)} {currency}</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "6px", textAlign: "left", color: "#16a34a" }}>
                              {fmt((items || []).reduce((s: number, it: any) => s + (it.totalProfit || 0), 0))} {currency}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}

                {/* Grand Total Footer for Category Report */}
                {categoryRows.length > 0 && (
                  <div style={{ background: "#0f172a", color: "#ffffff", padding: "12px 16px", borderRadius: "6px", border: "2px solid #000", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold", fontSize: "15px", marginTop: "10px" }}>
                    <span>🏆 إجمالي المبيعات الكلي (جميع الفئات والأقسام)</span>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <span>الفواتير: {categoryTotalOrders}</span>
                      <span>الكمية: {categoryTotalQty}</span>
                      <span style={{ color: "#fbbf24", fontSize: "16px" }}>المبلغ الكلي: {fmt(categoryTotalRevenue)} {currency}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "payment" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>طريقة الدفع</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الفواتير</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>إجمالي</th>
                </tr></thead>
                <tbody>
                  {paymentRows.map((r: any, i) => <tr key={`payment-row-${r.paymentMethod || i}`}>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{paymentLabel(r.paymentMethod)}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{r.orders}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(r.total)}</td>
                  </tr>)}
                </tbody>
                {paymentRows.length > 0 && (
                  <tfoot><tr style={{ background: "#f8fafc", fontWeight: "bold" }}>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>الإجمالي</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>{paymentTotalOrders}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(paymentNetTotal)}</td>
                  </tr></tfoot>
                )}
              </table>
            )}

            {tab === "warehouse_sales" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>رقم الفاتورة</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>التاريخ</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>العميل</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>طريقة الدفع</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الصافي ({currency})</th>
                </tr></thead>
                <tbody>
                  {(Array.isArray(warehouseSalesRows) ? warehouseSalesRows : []).filter((inv: any) => {
                    const d = (inv.invoice_date || inv.created_at || "").slice(0, 10);
                    return (!startDate || d >= startDate) && (!endDate || d <= endDate);
                  }).map((inv: any, i: number) => (
                    <tr key={`wh-print-${inv.id || i}`}>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", fontWeight: "bold" }}>{inv.invoice_number || inv.id}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{(inv.invoice_date || inv.created_at || "").slice(0, 10)}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{inv.customer_name || "عميل نقدي"}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{inv.payment_method === "credit" ? "آجل" : inv.payment_method === "card" ? "شبكة" : "نقداً"}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(inv.net_amount ?? inv.total_amount ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "purchases" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>رقم الفاتورة</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>المورد</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>التاريخ</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الإجمالي</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>المدفوع</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>المتبقي</th>
                </tr></thead>
                <tbody>
                  {(purchasesData?.rows || []).map((r: any, i: number) => (
                    <tr key={`purch-print-${i}`}>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", fontWeight: "bold" }}>{r.invoiceNumber}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{r.supplierName}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{r.invoiceDate}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(r.total)}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt(r.paidAmount)}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt(r.remainingAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "inventory" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>اسم الصنف</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>الفئة</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الرصيد الحالي</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>التكلفة الفردية</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>إجمالي التقييم</th>
                </tr></thead>
                <tbody>
                  {(inventoryData?.products || []).map((p: any, i: number) => (
                    <tr key={`inv-print-${i}`}>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", fontWeight: "bold" }}>{p.name}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{p.categoryName || "-"}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{p.stock}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt(p.cost)}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(p.totalCostValuation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "expenses" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>تصنيف المصروف</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>عدد السجلات</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>إجمالي المبلغ</th>
                </tr></thead>
                <tbody>
                  {(expensesData?.categories || []).map((c: any, i: number) => (
                    <tr key={`exp-print-${i}`}>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", fontWeight: "bold" }}>{c.category}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{c.count}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(c.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "shifts" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>الكاشير</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الافتتاح</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>المبيعات النقدية</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>المبيعات الشبكة</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>المتوقع</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الفعلي</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الفارق</th>
                </tr></thead>
                <tbody>
                  {(shiftsData?.shifts || []).map((s: any, i: number) => (
                    <tr key={`shift-print-${i}`}>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", fontWeight: "bold" }}>{s.cashierName || "غير معروف"}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{fmt(s.opening_balance)}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{fmt(s.cash_sales)}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{fmt(s.card_sales)}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{fmt(s.expected_cash)}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center", fontWeight: "bold" }}>{fmt(s.actual_cash)}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(s.variance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "tax" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>بيان الإقرار الضريبي</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>القيمة ({currency})</th>
                </tr></thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", fontWeight: "bold" }}>المبيعات الخاضعة للضريبة</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "left" }}>{fmt(taxData?.taxableSales || 0)}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", fontWeight: "bold" }}>ضريبة المخرجات (المبيعات)</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(taxData?.outputTax || 0)}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", fontWeight: "bold" }}>المشتريات الخاضعة للضريبة</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "left" }}>{fmt(taxData?.taxablePurchases || 0)}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", fontWeight: "bold" }}>ضريبة المدخلات (المشتريات)</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(taxData?.inputTax || 0)}</td>
                  </tr>
                  <tr style={{ background: "#f8fafc" }}>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", fontWeight: "bold" }}>صافي الضريبة المستحقة للسداد</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(taxData?.netTaxPayable || 0)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {tab === "waste" && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>المنتج</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الكمية التالفة</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>التكلفة</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>السبب</th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>التاريخ</th>
                </tr></thead>
                <tbody>
                  {(wasteData?.records || []).map((w: any, i: number) => (
                    <tr key={`waste-print-${i}`}>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", fontWeight: "bold" }}>{w.productName || "منتج تالف"}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{w.quantity}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(w.cost)}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{w.reason || "تالف/منتهي الصلاحية"}</td>
                      <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{w.waste_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ borderTop: "1.5px dashed #94a3b8", marginTop: "20px", paddingTop: "10px", textAlign: "center", fontSize: "11px", color: "#475569" }}>
              <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>نظام أومني سيستم برو لإدارة المبيعات والمستودعات</p>
              <p style={{ margin: 0 }}>{new Date().toLocaleDateString("ar-YE")} {new Date().toLocaleTimeString("ar-YE")}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-2xl font-bold">تقارير تفصيلية</h1>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border">
              <Button type="button" variant="ghost" size="sm" onClick={setTodayFilter} className="h-7 px-2 text-xs font-bold">اليوم</Button>
              <Button type="button" variant="ghost" size="sm" onClick={setMonthFilter} className="h-7 px-2 text-xs font-bold">الشهر</Button>
              <Button type="button" variant="ghost" size="sm" onClick={setAllTimeFilter} className="h-7 px-2 text-xs font-bold">الكل</Button>
            </div>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36 text-sm" />
            <span className="text-muted-foreground text-sm">إلى</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36 text-sm" />
            <Button variant="outline" size="sm" className="gap-1.5 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" onClick={handleFullscreenPreview}>
              <Maximize2 className="w-4 h-4" />
              معاينة بشاشة كاملة
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPrintDlg(true)}>
              <Printer className="w-4 h-4" />
              طباعة التقرير
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" onClick={handleExportPdf}>
              <FileDown className="w-4 h-4" />
              توليد ملف PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50" 
              onClick={() => {
                let headers: string[] = [];
                let rows: (string | number)[][] = [];

                if (tab === "sales") {
                  headers = ["الفترة", "عدد الفواتير", "الإجمالي", "الضريبة", "الخصم"];
                  rows = salesRows.map(r => [r.period, r.orders, r.total, (r as any).tax ?? 0, (r as any).discount ?? 0]);
                } else if (tab === "cashier") {
                  headers = ["اسم الكاشير", "عدد الفواتير", "إجمالي المبيعات"];
                  rows = cashierRows.map(r => [r.cashierName || r.username || "غير محدد", r.orders, r.total]);
                } else if (tab === "product") {
                  headers = ["اسم المنتج", "الفئة/القسم", "سعر الوحدة", "الكمية المباعة", "عدد الفواتير", "إجمالي الإيراد", "إجمالي الربح"];
                  rows = productRows.map((r: any) => [
                    r.productName || r.name,
                    r.categoryName || "-",
                    r.unitPrice ?? (r.totalQty > 0 ? r.totalRevenue / r.totalQty : 0),
                    r.totalQty || r.quantity || 0,
                    r.orderCount || r.orders || 0,
                    r.totalRevenue || r.total || 0,
                    r.totalProfit || 0
                  ]);
                } else if (tab === "category") {
                  headers = ["اسم الفئة/القسم", "اسم المنتج", "سعر الوحدة", "الكمية المباعة", "عدد الفواتير", "إجمالي المبلغ", "إجمالي الربح"];
                  rows = [];
                  categoryRows.forEach((cat: any) => {
                    const items = cat.items || [];
                    items.forEach((item: any) => {
                      rows.push([
                        cat.categoryName || cat.name,
                        item.productName,
                        item.unitPrice ?? (item.totalQty > 0 ? item.totalRevenue / item.totalQty : 0),
                        item.totalQty,
                        item.orderCount,
                        item.totalRevenue,
                        item.totalProfit
                      ]);
                    });
                    rows.push([
                      `إجمالي فئة (${cat.categoryName || cat.name})`,
                      "-",
                      "-",
                      cat.totalQty,
                      cat.orderCount,
                      cat.totalRevenue,
                      (items || []).reduce((s: number, it: any) => s + (it.totalProfit || 0), 0)
                    ]);
                  });
                  rows.push([
                    "إجمالي المبيعات الكلي (جميع الفئات)",
                    "-",
                    "-",
                    categoryTotalQty,
                    categoryTotalOrders,
                    categoryTotalRevenue,
                    "-"
                  ]);
                } else if (tab === "payment") {
                  headers = ["طريقة الدفع", "عدد العمليات", "الإجمالي"];
                  rows = paymentRows.map(r => [paymentLabel(r.method), r.count, r.total]);
                } else if (tab === "purchases") {
                  headers = ["رقم الفاتورة", "المورد", "التاريخ", "الإجمالي", "المدفوع", "المتبقي"];
                  rows = (purchasesData?.rows || []).map((r: any) => [r.invoiceNumber, r.supplierName, r.invoiceDate, r.total, r.paidAmount, r.remainingAmount]);
                } else if (tab === "inventory") {
                  headers = ["اسم الصنف", "الفئة", "الرصيد الحالي", "التكلفة الفردية", "إجمالي التقييم"];
                  rows = (inventoryData?.products || []).map((p: any) => [p.name, p.categoryName || "-", p.stock, p.cost, p.totalCostValuation]);
                } else if (tab === "expenses") {
                  headers = ["تصنيف المصروف", "عدد السجلات", "إجمالي المبلغ"];
                  rows = (expensesData?.categories || []).map((c: any) => [c.category, c.count, c.totalAmount]);
                } else if (tab === "shifts") {
                  headers = ["اسم الكاشير", "افتتاح الصندوق", "المبيعات النقدية", "المبيعات الشبكة", "المتوقع", "الفعلي", "الفارق"];
                  rows = (shiftsData?.shifts || []).map((s: any) => [s.cashierName || "-", s.opening_balance, s.cash_sales, s.card_sales, s.expected_cash, s.actual_cash, s.variance]);
                } else if (tab === "tax") {
                  headers = ["بيان الإقرار الضريبي", "القيمة الإجمالية"];
                  rows = [
                    ["المبيعات الخاضعة للضريبة", taxData?.taxableSales || 0],
                    ["ضريبة المخرجات (15%)", taxData?.outputTax || 0],
                    ["المشتريات الخاضعة للضريبة", taxData?.taxablePurchases || 0],
                    ["ضريبة المدخلات (15%)", taxData?.inputTax || 0],
                    ["صافي الضريبة المستحقة للسداد", taxData?.netTaxPayable || 0]
                  ];
                } else if (tab === "waste") {
                  headers = ["اسم المنتج", "الكمية التالفة", "التكلفة الإجمالية", "السبب", "التاريخ"];
                  rows = (wasteData?.records || []).map((w: any) => [w.productName, w.quantity, w.cost, w.reason, w.waste_date]);
                }

                const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `report-${tab}-${startDate}-to-${endDate}.csv`);
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                  URL.revokeObjectURL(url);
                  document.body.removeChild(link);
                }, 1000);
              }}
            >
              <Download className="w-4 h-4" />
              تصدير CSV
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border border-emerald-200 bg-linear-to-b from-white to-emerald-50/20 hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl shadow-xs"><TrendingUp className="w-5 h-5 stroke-[2.5]" /></div>
              <div>
                <p className="text-[11px] text-muted-foreground font-black tracking-wide">صافي المبيعات (بعد المرتجع)</p>
                <p className="text-xl font-black text-emerald-700 font-mono tracking-tight mt-0.5">{fmt(totalNetSales)} <span className="text-[11px] font-normal text-emerald-600/80 ms-0.5">{currency}</span></p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200 bg-linear-to-b from-white to-slate-50/20 hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl shadow-xs"><TrendingUp className="w-5 h-5 stroke-[2.5]" /></div>
              <div>
                <p className="text-[11px] text-muted-foreground font-black tracking-wide">إجمالي المبيعات (قبل الخصم)</p>
                <p className="text-xl font-black text-slate-800 font-mono tracking-tight mt-0.5">{fmt(totalGrossSales)} <span className="text-[11px] font-normal text-slate-500/80 ms-0.5">{currency}</span></p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-rose-200 bg-linear-to-b from-white to-rose-50/20 hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl shadow-xs"><RotateCcw className="w-5 h-5 stroke-[2.5]" /></div>
              <div>
                <p className="text-[11px] text-muted-foreground font-black tracking-wide">إجمالي المرتجعات</p>
                <p className="text-xl font-black text-rose-700 font-mono tracking-tight mt-0.5">{totalReturnsAmount > 0 ? `-${fmt(totalReturnsAmount)}` : "0.00"} <span className="text-[11px] font-normal text-rose-600/80 ms-0.5">{currency}</span></p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-indigo-200 bg-linear-to-b from-white to-indigo-50/20 hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl shadow-xs"><ShoppingBag className="w-5 h-5 stroke-[2.5]" /></div>
              <div>
                <p className="text-[11px] text-muted-foreground font-black tracking-wide">عدد الفواتير</p>
                <p className="text-xl font-black text-indigo-950 font-mono tracking-tight mt-0.5">{totalOrders.toLocaleString("ar-SA")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-green-200 bg-linear-to-b from-white to-green-50/20 hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="p-2.5 bg-green-500/10 text-green-600 rounded-xl shadow-xs"><Tag className="w-5 h-5 stroke-[2.5]" /></div>
              <div>
                <p className="text-[11px] text-muted-foreground font-black tracking-wide">إجمالي الضريبة</p>
                <p className="text-xl font-black text-green-700 font-mono tracking-tight mt-0.5">{fmt(totalTax)} <span className="text-[11px] font-normal text-green-600/80 ms-0.5">{currency}</span></p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border flex-wrap">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Tab: Sales */}
        {tab === "sales" && (
          <div className="space-y-4">
            <div className="flex gap-1 border rounded-lg overflow-hidden w-fit">
              {(["day","month","year"] as const).map(g => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === g ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {g === "day" ? "يومي" : g === "month" ? "شهري" : "سنوي"}
                </button>
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">مبيعات حسب الفترة (صافي المبيعات)</CardTitle></CardHeader>
              <CardContent className="h-64">
                {isSalesLoading ? <div className="flex items-center justify-center h-full text-muted-foreground text-sm">جاري التحميل...</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesRows} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [fmt(v), "صافي المبيعات"]} />
                      <Bar dataKey="total" name="صافي المبيعات" fill="#1e3a5f" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">تفصيل البيانات</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">الفترة</th>
                      <th className="text-center p-3 font-semibold">الفواتير</th>
                      <th className="text-left p-3 font-semibold">إجمالي المبيعات</th>
                      <th className="text-left p-3 font-semibold text-rose-600">المرتجعات</th>
                      <th className="text-left p-3 font-semibold text-emerald-600">صافي المبيعات</th>
                      <th className="text-left p-3 font-semibold">الضريبة</th>
                      <th className="text-left p-3 font-semibold">الخصم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {salesRows.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{r.period}</td>
                        <td className="p-3 text-center">{r.orders}</td>
                        <td className="p-3 text-left font-semibold text-slate-800">{fmt(r.gross_total ?? r.total)}</td>
                        <td className="p-3 text-left font-semibold text-rose-600">{(r.returnsTotal || 0) > 0 ? `-${fmt(r.returnsTotal)}` : "0.00"}</td>
                        <td className="p-3 text-left font-bold text-emerald-600">{fmt(r.total)}</td>
                        <td className="p-3 text-left text-green-600">{fmt((r as any).tax ?? 0)}</td>
                        <td className="p-3 text-left text-red-500">{fmt((r as any).discount ?? 0)}</td>
                      </tr>
                    ))}
                    {salesRows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">لا توجد بيانات</td></tr>}
                  </tbody>
                  {salesRows.length > 0 && (
                    <tfoot className="bg-muted/50 border-t font-bold">
                      <tr>
                        <td className="p-3">الإجمالي</td>
                        <td className="p-3 text-center">{totalOrders}</td>
                        <td className="p-3 text-left text-slate-800">{fmt(totalGrossSales)}</td>
                        <td className="p-3 text-left text-rose-600">{totalReturnsAmount > 0 ? `-${fmt(totalReturnsAmount)}` : "0.00"}</td>
                        <td className="p-3 text-left text-emerald-600">{fmt(totalNetSales)}</td>
                        <td className="p-3 text-left text-green-600">{fmt(totalTax)}</td>
                        <td className="p-3 text-left text-red-500">{fmt(totalDiscount)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: By Cashier */}
        {tab === "cashier" && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">مبيعات حسب الكاشير (نقطة المبيعات)</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashierRows} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="userName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [fmt(v), "المبيعات"]} />
                    <Bar dataKey="total" name="المبيعات" fill="#1e3a5f" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">المستخدم / الكاشير</th>
                      <th className="text-left p-3 font-semibold">إجمالي المبيعات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cashierRows.map((r: any, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{r.userName?.charAt(0)}</div>
                          <div>
                            <div>{r.userName}</div>
                          </div>
                        </td>
                        <td className="p-3 text-left font-bold text-emerald-600">{fmt(r.total)}</td>
                      </tr>
                    ))}
                    {cashierRows.length === 0 && <tr><td colSpan={2} className="py-10 text-center text-muted-foreground">لا توجد بيانات</td></tr>}
                  </tbody>
                  {cashierRows.length > 0 && (
                    <tfoot className="bg-muted/50 border-t font-bold">
                      <tr>
                        <td className="p-3">الإجمالي</td>
                        <td className="p-3 text-left text-emerald-600">{fmt(cashierNetTotal)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Warehouse Sales Invoices (Separated from Cashier) */}
        {tab === "warehouse_sales" && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">تقرير مبيعات فواتير المبيعات المخزنية (منفصل تماماً عن نقاط البيع والكاشير)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">رقم الفاتورة</th>
                      <th className="text-right p-3 font-semibold">العميل</th>
                      <th className="text-right p-3 font-semibold">المستودع / الفرع</th>
                      <th className="text-right p-3 font-semibold">التاريخ</th>
                      <th className="text-left p-3 font-semibold">المبلغ الإجمالي</th>
                      <th className="text-left p-3 font-semibold">الخصم</th>
                      <th className="text-left p-3 font-semibold text-emerald-600">الصافي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {warehouseSalesRows.map((inv: any, i: number) => (
                      <tr key={inv.id || i} className="hover:bg-muted/30">
                        <td className="p-3 font-mono font-bold text-blue-600">{inv.invoice_number || inv.invoiceNumber}</td>
                        <td className="p-3 font-semibold">{inv.customer_name || inv.customerName || "عميل نقدي"}</td>
                        <td className="p-3 text-muted-foreground">{inv.warehouse_name || inv.branch_name || "المخزن الرئيسي"}</td>
                        <td className="p-3 font-mono text-xs">{inv.created_at || inv.date}</td>
                        <td className="p-3 text-left font-mono">{fmt(inv.subtotal ?? inv.total)}</td>
                        <td className="p-3 text-left font-mono text-red-500">{fmt(inv.discount ?? 0)}</td>
                        <td className="p-3 text-left font-mono font-bold text-emerald-600">{fmt(inv.total)}</td>
                      </tr>
                    ))}
                    {warehouseSalesRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">لا توجد فواتير مبيعات مخزنية مسجلة</td>
                      </tr>
                    )}
                  </tbody>
                  {warehouseSalesRows.length > 0 && (
                    <tfoot className="bg-muted/50 border-t font-bold">
                      <tr>
                        <td className="p-3" colSpan={4}>الإجمالي ({warehouseSalesRows.length} فاتورة)</td>
                        <td className="p-3 text-left font-mono">{fmt(warehouseSalesRows.reduce((s, r) => s + Number(r.subtotal ?? r.total ?? 0), 0))}</td>
                        <td className="p-3 text-left font-mono text-red-500">{fmt(warehouseSalesRows.reduce((s, r) => s + Number(r.discount ?? 0), 0))}</td>
                        <td className="p-3 text-left font-mono text-emerald-600">{fmt(warehouseSalesRows.reduce((s, r) => s + Number(r.total ?? 0), 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: By Product */}
        {tab === "product" && (
          <div className="space-y-4">
            {/* Header Banner */}
            <div className="bg-slate-900 text-white p-4 rounded-xl shadow border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-xl font-black text-amber-400">{businessName}</h2>
                <p className="text-sm font-bold text-slate-200">تقارير المبيعات التفصيلية (حسب المنتجات)</p>
              </div>
              <div className="text-xs bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300">
                الفترة من <span className="text-amber-300 font-mono font-bold">{startDate}</span> إلى <span className="text-amber-300 font-mono font-bold">{endDate}</span>
              </div>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base font-bold">أكثر المنتجات مبيعاً (بالكمية)</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productRows.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="productName" width={115} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [v, "الكمية"]} />
                    <Bar dataKey="totalQty" name="الكمية" fill="#1e3a5f" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border shadow-xs">
              <CardHeader className="bg-slate-50 border-b py-3">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center justify-between">
                  <span>تفاصيل مبيعات جميع المنتجات ({productRows.length} منتج)</span>
                  <span className="text-sm text-amber-700 bg-amber-50 px-3 py-1 rounded-md border border-amber-200 font-black">
                    الإجمالي الكلي: {fmt(productTotalRevenue)} {currency}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-100 border-b text-slate-900 font-bold">
                    <tr>
                      <th className="text-center p-3 w-12 border-l">#</th>
                      <th className="text-right p-3 border-l">اسم المنتج</th>
                      <th className="text-right p-3 border-l">الفئة / القسم</th>
                      <th className="text-center p-3 border-l">سعر الوحدة</th>
                      <th className="text-center p-3 border-l">الكمية المباعة</th>
                      <th className="text-center p-3 border-l">عدد الفواتير</th>
                      <th className="text-left p-3 border-l">إجمالي الإيراد ({currency})</th>
                      <th className="text-left p-3">إجمالي الربح ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {productRows.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-center text-slate-500 font-mono text-xs border-l font-bold">{i + 1}</td>
                        <td className="p-3 font-bold text-slate-900 border-l">{r.productName}</td>
                        <td className="p-3 text-slate-600 border-l">{r.categoryName ?? "-"}</td>
                        <td className="p-3 text-center font-mono border-l">{fmt(r.unitPrice ?? (r.totalQty > 0 ? r.totalRevenue / r.totalQty : 0))}</td>
                        <td className="p-3 text-center font-bold text-slate-900 border-l">{r.totalQty}</td>
                        <td className="p-3 text-center text-slate-700 border-l">{r.orderCount}</td>
                        <td className="p-3 text-left font-bold text-amber-700 border-l">{fmt(r.totalRevenue)}</td>
                        <td className="p-3 text-left font-bold text-emerald-600">{fmt(r.totalProfit)}</td>
                      </tr>
                    ))}
                    {productRows.length === 0 && (
                      <tr><td colSpan={8} className="py-10 text-center text-slate-500">لا توجد مبيعات للمنتجات في هذه الفترة</td></tr>
                    )}
                  </tbody>
                  {productRows.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-sm">
                      <tr>
                        <td colSpan={4} className="p-3">إجمالي المبيعات الكلي (جميع المنتجات)</td>
                        <td className="p-3 text-center text-amber-300 text-base">{productTotalQty}</td>
                        <td className="p-3 text-center">{productTotalOrders}</td>
                        <td className="p-3 text-left text-amber-400 text-base">{fmt(productTotalRevenue)} {currency}</td>
                        <td className="p-3 text-left text-emerald-400 text-base">{fmt(productTotalProfit)} {currency}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: By Category */}
        {tab === "category" && (
          <div className="space-y-5">
            {/* Header Banner */}
            <div className="bg-slate-900 text-white p-4 rounded-xl shadow border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-xl font-black text-amber-400">{businessName}</h2>
                <p className="text-sm font-bold text-slate-200">تقارير المبيعات التفصيلية (حسب الفئة والقسم)</p>
              </div>
              <div className="text-xs bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300">
                الفترة من <span className="text-amber-300 font-mono font-bold">{startDate}</span> إلى <span className="text-amber-300 font-mono font-bold">{endDate}</span>
              </div>
            </div>

            {/* Category Summary Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base font-bold">توزيع المبيعات حسب الفئة</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryRows} dataKey="totalRevenue" nameKey="categoryName" cx="50%" cy="50%" outerRadius={90} label={(entry: any) => `${entry.categoryName} (${(entry.percent * 100).toFixed(0)}%)`}>
                        {categoryRows.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [fmt(v), "الإيراد"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base font-bold">الكميات المباعة حسب الفئة</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryRows} margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="categoryName" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="totalQty" name="الكمية" fill="#f59e0b" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Category Sales Summary Card (ملخص مبيعات الأقسام) */}
            <Card className="border shadow-sm">
              <CardHeader className="bg-slate-900 text-white py-3">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span>📊 ملخص مبيعات الأقسام والفئات (Category Sales Summary)</span>
                  <span className="text-sm font-black text-amber-300">
                    المبلغ الكلي لجميع الفئات: {fmt(categoryTotalRevenue)} {currency}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-100 border-b text-slate-800 font-bold">
                    <tr>
                      <th className="p-3 border-l">اسم الفئة / القسم</th>
                      <th className="p-3 border-l text-center">الكمية المباعة</th>
                      <th className="p-3 border-l text-center">عدد الفواتير</th>
                      <th className="p-3 text-left">إجمالي المبيعات ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categoryRows.map((cat: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-l font-bold text-slate-900">{cat.categoryName}</td>
                        <td className="p-3 border-l text-center font-bold text-slate-700">{cat.totalQty}</td>
                        <td className="p-3 border-l text-center text-slate-600">{cat.orderCount}</td>
                        <td className="p-3 text-left font-black text-teal-600 dark:text-teal-400">{fmt(cat.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-200/80 text-slate-900 font-bold border-t">
                    <tr>
                      <td className="p-3">الإجمالي الكلي</td>
                      <td className="p-3 text-center">{categoryTotalQty}</td>
                      <td className="p-3 text-center">{categoryTotalOrders}</td>
                      <td className="p-3 text-left text-teal-800 text-base">{fmt(categoryTotalRevenue)} {currency}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            {/* Detailed Category Sections with Product Breakdown under each Category */}
            <div className="space-y-6">
              {categoryRows.map((cat: any, catIdx: number) => {
                const items = cat.items || [];
                const catProfit = (items || []).reduce((s: number, it: any) => s + (it.totalProfit || 0), 0);
                return (
                  <Card key={catIdx} className="border-2 border-slate-300 shadow-xs overflow-hidden">
                    {/* Category Header Bar */}
                    <div className="bg-slate-900 text-white p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full" style={{ background: COLORS[catIdx % COLORS.length] }} />
                        <h3 className="text-base font-black text-amber-300">اسم الفئة / القسم: {cat.categoryName}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-200 flex-wrap">
                        <span className="bg-slate-800 px-2.5 py-1 rounded border border-slate-700">عدد الفواتير: <strong className="text-white">{cat.orderCount}</strong></span>
                        <span className="bg-slate-800 px-2.5 py-1 rounded border border-slate-700">إجمالي الكمية: <strong className="text-white">{cat.totalQty}</strong></span>
                        <span className="bg-amber-500/20 text-amber-300 px-3 py-1 rounded border border-amber-400/40 text-sm font-black">
                          إجمالي مبيعات الفئة: {fmt(cat.totalRevenue)} {currency}
                        </span>
                      </div>
                    </div>

                    {/* Product Sub-Table for this Category */}
                    <CardContent className="p-0 overflow-x-auto">
                      <table className="w-full text-sm text-right">
                        <thead className="bg-slate-100 border-b text-slate-800 font-bold">
                          <tr>
                            <th className="p-2.5 text-center w-10 border-l">#</th>
                            <th className="p-2.5 border-l">اسم المنتج</th>
                            <th className="p-2.5 border-l">قسم / فئة المنتج</th>
                            <th className="p-2.5 text-center border-l">سعر الوحدة</th>
                            <th className="p-2.5 text-center border-l">عدد المبيعات (الكمية المباعة)</th>
                            <th className="p-2.5 text-center border-l">عدد الفواتير</th>
                            <th className="p-2.5 text-left border-l">إجمالي المبيعات ({currency})</th>
                            <th className="p-2.5 text-left">إجمالي الربح ({currency})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {items.map((item: any, itemIdx: number) => (
                            <tr key={itemIdx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 text-center text-slate-500 font-mono text-xs border-l font-bold">{itemIdx + 1}</td>
                              <td className="p-2.5 font-bold text-slate-900 border-l">{item.productName}</td>
                              <td className="p-2.5 text-slate-600 border-l">{item.categoryName || cat.categoryName}</td>
                              <td className="p-2.5 text-center font-mono border-l">{fmt(item.unitPrice ?? (item.totalQty > 0 ? item.totalRevenue / item.totalQty : 0))}</td>
                              <td className="p-2.5 text-center font-bold text-slate-900 border-l">{item.totalQty}</td>
                              <td className="p-2.5 text-center text-slate-600 border-l">{item.orderCount}</td>
                              <td className="p-2.5 text-left font-bold text-amber-700 border-l">{fmt(item.totalRevenue)}</td>
                              <td className="p-2.5 text-left font-bold text-emerald-600">{fmt(item.totalProfit)}</td>
                            </tr>
                          ))}
                          {items.length === 0 && (
                            <tr><td colSpan={8} className="py-6 text-center text-slate-500 text-xs">لا توجد منتجات مسجلة لهذه الفئة في هذه الفترة</td></tr>
                          )}
                        </tbody>
                        <tfoot className="bg-slate-200/80 text-slate-900 font-bold text-xs border-t border-slate-300">
                          <tr>
                            <td colSpan={4} className="p-2.5">إجمالي قسم / فئة ({cat.categoryName})</td>
                            <td className="p-2.5 text-center font-bold">{cat.totalQty}</td>
                            <td className="p-2.5 text-center">{cat.orderCount}</td>
                            <td className="p-2.5 text-left font-bold text-amber-800">{fmt(cat.totalRevenue)} {currency}</td>
                            <td className="p-2.5 text-left font-bold text-emerald-700">{fmt(catProfit)} {currency}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </CardContent>
                  </Card>
                );
              })}

              {categoryRows.length === 0 && (
                <div className="py-12 text-center text-slate-500 bg-white rounded-xl border">لا توجد بيانات للفئات في هذه الفترة</div>
              )}

              {/* Grand Total Footer for Category Report */}
              {categoryRows.length > 0 && (
                <div className="bg-slate-950 text-white p-4 rounded-xl border-2 border-slate-800 shadow-md flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏆</span>
                    <span className="font-black text-base">إجمالي المبيعات الكلي (جميع الفئات والأقسام)</span>
                  </div>
                  <div className="flex items-center gap-5 text-sm font-bold flex-wrap">
                    <span className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">إجمالي الفواتير: <strong className="text-amber-300">{categoryTotalOrders}</strong></span>
                    <span className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">إجمالي الكميات: <strong className="text-amber-300">{categoryTotalQty}</strong></span>
                    <span className="bg-amber-500 text-slate-950 px-4 py-1.5 rounded-lg font-black text-base shadow-xs">
                      المبلغ الكلي: {fmt(categoryTotalRevenue)} {currency}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: By Payment */}
        {tab === "payment" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">توزيع طرق الدفع</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentRows} dataKey="total" nameKey="paymentMethod" cx="50%" cy="50%" outerRadius={90}
                        label={(entry: any) => `${paymentLabel(entry.paymentMethod)} (${(entry.percent * 100).toFixed(0)}%)`}>
                        {paymentRows.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [fmt(v), "الإجمالي"]} labelFormatter={paymentLabel} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 gap-3 content-start">
                {paymentRows.map((r: any, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-3 h-8 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">{paymentLabel(r.paymentMethod)}</p>
                        <p className="text-xl font-bold text-emerald-600">{fmt(r.total)} {currency}</p>
                        {r.returnsTotal > 0 && (
                          <p className="text-xs text-rose-600 font-semibold">
                            (إجمالي المقبوضات: {fmt(r.grossTotal)} | المرتجع: -{fmt(r.returnsTotal)})
                          </p>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-muted-foreground font-semibold">عدد العمليات</p>
                        <p className="text-lg font-bold text-slate-800">{r.orders}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {paymentRows.length === 0 && <p className="text-center text-muted-foreground py-10">لا توجد بيانات</p>}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Purchases */}
        {tab === "purchases" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">إجمالي المشتريات</p>
                <p className="text-xl font-bold text-blue-600">{fmt(purchasesData?.totals?.totalPurchases || 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">المدفوع للموردين</p>
                <p className="text-xl font-bold text-emerald-600">{fmt(purchasesData?.totals?.totalPaid || 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">المتبقي (التزامات الموردين)</p>
                <p className="text-xl font-bold text-rose-600">{fmt(purchasesData?.totals?.totalRemaining || 0)}</p>
              </CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">فواتير المشتريات خلال الفترة</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">رقم الفاتورة</th>
                      <th className="text-right p-3 font-semibold">المورد</th>
                      <th className="text-center p-3 font-semibold">التاريخ</th>
                      <th className="text-left p-3 font-semibold">الإجمالي</th>
                      <th className="text-left p-3 font-semibold">المدفوع</th>
                      <th className="text-left p-3 font-semibold">المتبقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(purchasesData?.rows || []).map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{r.invoiceNumber}</td>
                        <td className="p-3 font-semibold">{r.supplierName}</td>
                        <td className="p-3 text-center">{r.invoiceDate}</td>
                        <td className="p-3 text-left font-bold">{fmt(r.total)}</td>
                        <td className="p-3 text-left text-emerald-600">{fmt(r.paidAmount)}</td>
                        <td className="p-3 text-left text-rose-500 font-bold">{fmt(r.remainingAmount)}</td>
                      </tr>
                    ))}
                    {(!purchasesData?.rows || purchasesData.rows.length === 0) && (
                      <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">لا توجد فواتير مشتريات للفترة المحددة</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Inventory */}
        {tab === "inventory" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">إجمالي الأصناف</p>
                <p className="text-xl font-bold">{inventoryData?.totals?.totalItems || 0}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">إجمالي عدد الوحدات بالمخزن</p>
                <p className="text-xl font-bold text-blue-600">{fmt(inventoryData?.totals?.totalStockUnits || 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">تقييم المخزون والتكلفة</p>
                <p className="text-xl font-bold text-amber-600">{fmt(inventoryData?.totals?.totalCostValuation || 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">أصناف قريبة من النفاد</p>
                <p className="text-xl font-bold text-rose-600">{inventoryData?.totals?.lowStockCount || 0}</p>
              </CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">سجل المخزون والتقييم المالي</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">الصنف</th>
                      <th className="text-right p-3 font-semibold">الفئة</th>
                      <th className="text-center p-3 font-semibold">الرصيد الحالي</th>
                      <th className="text-left p-3 font-semibold">التكلفة الفردية</th>
                      <th className="text-left p-3 font-semibold">إجمالي التقييم (التكلفة)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(inventoryData?.products || []).map((p: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold">{p.name}</td>
                        <td className="p-3 text-muted-foreground">{p.categoryName || "-"}</td>
                        <td className={`p-3 text-center font-bold ${p.stock <= p.minStock ? "text-rose-600" : ""}`}>{p.stock}</td>
                        <td className="p-3 text-left">{fmt(p.cost)}</td>
                        <td className="p-3 text-left font-bold text-amber-600">{fmt(p.totalCostValuation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Expenses */}
        {tab === "expenses" && (
          <div className="space-y-4">
            <Card><CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">إجمالي المصروفات التشغيلية للفترة</p>
                <p className="text-2xl font-bold text-rose-600">{fmt(expensesData?.totalExpense || 0)} ر.س</p>
              </div>
            </CardContent></Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">توزيع المصروفات حسب التصنيف</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-right p-3 font-semibold">التصنيف</th>
                        <th className="text-center p-3 font-semibold">العدد</th>
                        <th className="text-left p-3 font-semibold">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(expensesData?.categories || []).map((c: any, i: number) => (
                        <tr key={i}>
                          <td className="p-3 font-semibold">{c.category}</td>
                          <td className="p-3 text-center">{c.count}</td>
                          <td className="p-3 text-left font-bold text-rose-600">{fmt(c.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">آخر قيود المصروفات</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-right p-2 font-semibold">التصنيف</th>
                        <th className="text-left p-2 font-semibold">المبلغ</th>
                        <th className="text-center p-2 font-semibold">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(expensesData?.details || []).slice(0, 10).map((d: any, i: number) => (
                        <tr key={i}>
                          <td className="p-2">{d.category} - {d.notes || ""}</td>
                          <td className="p-2 text-left font-bold text-rose-600">{fmt(d.amount)}</td>
                          <td className="p-2 text-center text-muted-foreground">{d.expense_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Tab: Shifts */}
        {tab === "shifts" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">إجمالي النقدية المحصلة بالمناوبات</p>
                <p className="text-xl font-bold text-emerald-600">{fmt(shiftsData?.totalCashSales || 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">صافي فروقات الجرد والتصفية</p>
                <p className={`text-xl font-bold ${(shiftsData?.totalVariance || 0) < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {fmt(shiftsData?.totalVariance || 0)}
                </p>
              </CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">سجل إغلاق المناوبات والصناديق</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">الكاشير</th>
                      <th className="text-center p-3 font-semibold">الافتتاح</th>
                      <th className="text-center p-3 font-semibold">المبيعات النقدية</th>
                      <th className="text-center p-3 font-semibold">المبيعات الشبكة</th>
                      <th className="text-center p-3 font-semibold">المحسوب متوقع</th>
                      <th className="text-center p-3 font-semibold">الفردي الفعلي</th>
                      <th className="text-left p-3 font-semibold">الفرق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(shiftsData?.shifts || []).map((s: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold">{s.cashierName || "غير معروف"}</td>
                        <td className="p-3 text-center">{fmt(s.opening_balance)}</td>
                        <td className="p-3 text-center text-emerald-600 font-bold">{fmt(s.cash_sales)}</td>
                        <td className="p-3 text-center text-blue-600">{fmt(s.card_sales)}</td>
                        <td className="p-3 text-center">{fmt(s.expected_cash)}</td>
                        <td className="p-3 text-center font-bold">{fmt(s.actual_cash)}</td>
                        <td className={`p-3 text-left font-bold ${s.variance < 0 ? "text-rose-600" : s.variance > 0 ? "text-emerald-600" : ""}`}>
                          {fmt(s.variance)}
                        </td>
                      </tr>
                    ))}
                    {(!shiftsData?.shifts || shiftsData.shifts.length === 0) && (
                      <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">لا توجد سجلات مناوبات إغلاق للفترة المحددة</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Tax / VAT */}
        {tab === "tax" && (
          <div className="space-y-4">
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader><CardTitle className="text-base text-amber-900">ملخص الإقرار الضريبي للقيمة المضافة (ZATCA 15%)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-lg border space-y-1">
                    <p className="text-xs text-muted-foreground">ضريبة المخرجات (المبيعات)</p>
                    <p className="text-2xl font-bold text-emerald-600">{fmt(taxData?.outputTax || 0)} ر.س</p>
                    <p className="text-xs text-muted-foreground">المبيعات الخاضعة: {fmt(taxData?.taxableSales || 0)} ر.س</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg border space-y-1">
                    <p className="text-xs text-muted-foreground">ضريبة المدخلات (المشتريات)</p>
                    <p className="text-2xl font-bold text-blue-600">{fmt(taxData?.inputTax || 0)} ر.س</p>
                    <p className="text-xs text-muted-foreground">المشتريات الخاضعة: {fmt(taxData?.taxablePurchases || 0)} ر.س</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg border space-y-1">
                    <p className="text-xs text-muted-foreground">صافي الضريبة المستحقة للسداد</p>
                    <p className="text-2xl font-bold text-amber-600">{fmt(taxData?.netTaxPayable || 0)} ر.س</p>
                    <p className="text-xs text-muted-foreground">(الفرق بين مخرجات ومدخلات الضريبة)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Waste */}
        {tab === "waste" && (
          <div className="space-y-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">إجمالي تكلفة الهدر والتالف للفترة</p>
              <p className="text-2xl font-bold text-rose-600">{fmt(wasteData?.totalCost || 0)} ر.س</p>
            </CardContent></Card>
            <Card>
              <CardHeader><CardTitle className="text-base">سجل تفاصيل الهدر والتالف</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">المنتج</th>
                      <th className="text-center p-3 font-semibold">الكمية التالفة</th>
                      <th className="text-left p-3 font-semibold">التكلفة</th>
                      <th className="text-right p-3 font-semibold">السبب</th>
                      <th className="text-center p-3 font-semibold">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(wasteData?.records || []).map((w: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold">{w.productName || "منتج تالف"}</td>
                        <td className="p-3 text-center font-bold text-rose-600">{w.quantity}</td>
                        <td className="p-3 text-left font-bold">{fmt(w.cost)}</td>
                        <td className="p-3">{w.reason || "تالف/منتهي الصلاحية"}</td>
                        <td className="p-3 text-center text-muted-foreground">{w.waste_date}</td>
                      </tr>
                    ))}
                    {(!wasteData?.records || wasteData.records.length === 0) && (
                      <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">لا توجد سجلات هدر تالف في هذه الفترة</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Print dialog */}
      <Dialog open={showPrintDlg} onOpenChange={setShowPrintDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Printer className="w-5 h-5" /> طباعة التقرير</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">التقرير: <strong>{TAB_LABELS[tab]}</strong></p>
            <p className="text-sm text-muted-foreground">الفترة: {startDate} — {endDate}</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">حجم الورق والطابعة</label>
              <Select value={printPaperFormat} onValueChange={(v: any) => setPrintPaperFormat(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر حجم الورق..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">طابعة حرارية (مقاس 80mm متزن)</SelectItem>
                  <SelectItem value="a4">طابعة قياسية (مقاس A4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">اختر الطابعة</label>
              <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر طابعة..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__window__">طابعة افتراضية (نافذة الطباعة)</SelectItem>
                  {(Array.isArray(printers) ? printers : []).map((p: any, idx: number) => {
                    const pName = typeof p === "string" ? p.trim() : String(p?.name || "").trim();
                    if (!pName) return null;
                    const isDef = typeof p === "object" && p !== null && Boolean(p.isDefault);
                    return (
                      <SelectItem key={`printer-${pName}-${idx}`} value={pName}>
                        {pName} {isDef ? "(افتراضية)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {printers.length === 0 && (
                <p className="text-xs text-muted-foreground">لم يتم الكشف عن طابعات متصلة — سيتم استخدام نافذة الطباعة</p>
              )}
            </div>
            <div className="flex gap-2 pt-1 flex-wrap">
              <Button className="flex-1 gap-1.5" onClick={handlePrint}>
                <Printer className="w-4 h-4" /> طباعة
              </Button>
              <Button variant="outline" className="gap-1.5 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" onClick={() => { setShowPrintDlg(false); handleFullscreenPreview(); }}>
                <Maximize2 className="w-4 h-4" /> معاينة كاملة
              </Button>
              <Button variant="outline" className="gap-1.5 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" onClick={() => { setShowPrintDlg(false); handleExportPdf(); }}>
                <FileDown className="w-4 h-4" /> PDF
              </Button>
              <Button variant="outline" onClick={() => setShowPrintDlg(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ReportViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        htmlContent={viewerHtml}
        title={viewerTitle}
      />
    </AdminLayout>
  );
}

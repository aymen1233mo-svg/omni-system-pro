import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import {
  FileCheck2,
  QrCode,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Eye,
  CheckCircle2,
  Code2,
  FileText,
  AlertCircle,
  Percent,
  Download,
  Coins,
  ArrowUpDown,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ZatcaInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_tax_number: string;
  tax_treatment: "commission_only" | "full_principal_value";
  ticket_or_hotel_value: number;
  agency_commission: number;
  taxable_base: number;
  vat_rate_pct: number;
  vat_amount: number;
  grand_total: number;
  zatca_uuid: string;
  zatca_hash: string;
  zatca_status: string;
  qr_code_tlv: string;
}

interface FxRate {
  id: number;
  currency_code: string;
  currency_name: string;
  buy_rate: number;
  sell_rate: number;
  official_mid_rate: number;
  is_base_currency: number;
  updated_at: string;
}

export default function TravelZatcaCompliance() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"invoices" | "fx_revaluation">("invoices");

  const [invoices, setInvoices] = useState<ZatcaInvoice[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ZatcaInvoice | null>(null);
  const [xmlPreview, setXmlPreview] = useState<string | null>(null);

  // New Invoice Generator State
  const [newInvModal, setNewInvModal] = useState(false);
  const [invForm, setInvForm] = useState({
    invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    customer_name: "مجموعة الفنار التجارية المحدودة",
    customer_tax_number: "310988776600003",
    tax_treatment: "commission_only" as "commission_only" | "full_principal_value",
    ticket_or_hotel_value: 5000,
    agency_commission: 350
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [resInv, resFx] = await Promise.all([
        fetch("/api/travel/zatca/invoices").then(r => r.json()),
        fetch("/api/travel/fx-rates").then(r => r.json())
      ]);
      if (resInv.success) {
        setInvoices(resInv.data);
        if (resInv.data.length > 0 && !selectedInvoice) {
          setSelectedInvoice(resInv.data[0]);
        }
      }
      if (resFx.success) setFxRates(resFx.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/travel/zatca/generate-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invForm)
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم إنشاء وختم الفاتورة إلكترونياً", description: data.message });
        setNewInvModal(false);
        loadData();
      }
    } catch (e) {
      toast({ title: "خطأ", description: "تعذر توليد الفاتورة", variant: "destructive" });
    }
  };

  const handleRevalueFx = async () => {
    try {
      const res = await fetch("/api/travel/fx/revaluate", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تمت إعادة تقييم العملات الأجنبية", description: data.message });
        loadData();
      }
    } catch (e) {
      toast({ title: "خطأ", description: "فشلت إعادة التقييم", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-emerald-950 border border-teal-800/40 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-xl">
                  <FileCheck2 className="w-6 h-6" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">الفوترة الإلكترونية ZATCA المرحلة الثانية وتقييم العملات الأجنبية FX</h1>
                  <p className="text-slate-400 text-sm">
                    الختم الرقمي والتشفير UBL 2.1 XML، معالجة ضريبة عمولة الوكالة فقط vs القيمة الإجمالية، وحساب فروق أسعار الصرف IAS 21
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/travel-dashboard">
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition shadow-md cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  الرجوع للواجهة الرئيسية
                </button>
              </Link>
              <button
                onClick={() => setNewInvModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                إصدار فاتورة ضريبية ZATCA
              </button>
            </div>
          </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "invoices"
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            فواتير ZATCA والختم الرقمي والتشفير ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab("fx_revaluation")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "fx_revaluation"
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Coins className="w-4 h-4" />
            تقييم العملات الأجنبية وفروق الصرف (FX Revaluation)
          </button>
        </div>
      </div>

      {/* TAB 1: ZATCA Invoices */}
      {activeTab === "invoices" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Invoices List */}
          <div className="lg:col-span-7 space-y-3">
            {invoices.map((inv) => {
              const isSelected = selectedInvoice?.id === inv.id;
              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className={`cursor-pointer rounded-2xl border p-5 transition space-y-3 ${
                    isSelected
                      ? "bg-teal-50/50 dark:bg-teal-950/20 border-teal-500 shadow-md ring-2 ring-teal-500/20"
                      : "bg-card border-border hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{inv.invoice_number}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          inv.tax_treatment === "commission_only"
                            ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                        }`}>
                          {inv.tax_treatment === "commission_only" ? "ضريبة عمولة فقط" : "ضريبة كامل القيمة"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">{inv.customer_name}</p>
                    </div>

                    <span className="text-xs bg-emerald-500/10 text-emerald-600 font-bold px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ZATCA Cleared
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-muted/40 p-3 rounded-xl text-xs text-center font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">قيمة التذكرة/الفندق</span>
                      <span className="font-bold">{inv.ticket_or_hotel_value.toLocaleString()} ريال</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">وعاء الضريبة الخاضع</span>
                      <span className="font-bold text-teal-600">{inv.taxable_base.toLocaleString()} ريال</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">ضريبة 15% VAT</span>
                      <span className="font-bold text-rose-600">{inv.vat_amount} ريال</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span className="truncate max-w-[280px]">UUID: {inv.zatca_uuid}</span>
                    <span className="font-bold text-foreground">الإجمالي: {inv.grand_total.toLocaleString()} ريال</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Invoice Security Passport & TLV QR Code */}
          <div className="lg:col-span-5 space-y-4">
            {selectedInvoice ? (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-lg space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-teal-500" />
                    جواز الاعتماد الرقمي للفاتورة (ZATCA Phase 2)
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {selectedInvoice.invoice_number}
                  </p>
                </div>

                {/* QR Code TLV Box */}
                <div className="bg-slate-950 border border-teal-500/30 rounded-2xl p-4 text-center space-y-3">
                  <div className="w-32 h-32 mx-auto bg-white p-2 rounded-xl flex items-center justify-center shadow-inner">
                    <QrCode className="w-28 h-28 text-slate-900" />
                  </div>
                  <div className="text-[11px] font-mono text-teal-400 break-all bg-slate-900 p-2.5 rounded-lg text-left">
                    <span className="text-slate-500 block mb-0.5 font-sans">TLV Base64 ZATCA Encoded String:</span>
                    {selectedInvoice.qr_code_tlv}
                  </div>
                </div>

                {/* Cryptographic Details */}
                <div className="space-y-2 text-xs">
                  <div className="bg-muted/40 p-3 rounded-xl space-y-1 font-mono">
                    <span className="text-muted-foreground block text-[10px]">Cryptographic SHA-256 Invoice Hash:</span>
                    <span className="text-teal-600 dark:text-teal-400 break-all text-[11px]">{selectedInvoice.zatca_hash}</span>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-xl space-y-1 font-mono">
                    <span className="text-muted-foreground block text-[10px]">ZATCA Globally Unique UUID:</span>
                    <span className="text-foreground text-[11px]">{selectedInvoice.zatca_uuid}</span>
                  </div>
                </div>

                {/* Legal Clarification on Travel Tax Treatment */}
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-500/20 rounded-xl text-xs space-y-1 text-blue-900 dark:text-blue-200">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    المعالجة الضريبية لوكالات السفر بالمملكة:
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {selectedInvoice.tax_treatment === "commission_only"
                      ? "تطبيق ضريبة 15% على قيمة أتعاب وعمولة الوكالة فقط باعتبار الوكالة وسيطاً، ومبلغ التذكرة لا يخضع لضريبة إضافية."
                      : "تطبيق ضريبة 15% على إجمالي قيمة الخدمة باعتبار الوكالة المورد الرئيسي والمسؤول المباشر."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground">
                <FileCheck2 className="w-10 h-10 mx-auto text-muted-foreground/40 stroke-1" />
                <h4 className="font-bold text-sm mt-2">اختر فاتورة لعرض تفاصيل الختم الرقمي</h4>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Multi-Currency & Real-Time FX Revaluation */}
      {activeTab === "fx_revaluation" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Coins className="w-4 h-4 text-teal-500" />
                  أسعار صرف العملات الأجنبية وتقييم الذمم (IAS 21 FX Revaluation)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  حساب الأرباح والخسائر غير المحققة لجميع الذمم الدائنة لموردي الطيران والفنادق العالمية
                </p>
              </div>

              <button
                onClick={handleRevalueFx}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition"
              >
                <ArrowUpDown className="w-4 h-4" />
                إعادة تقييم الذمم الأجنبية وترحيل قيد فروق الصرف
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {fxRates.map((fx) => (
                <div key={fx.id} className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-lg bg-teal-950 text-teal-400 font-bold flex items-center justify-center text-xs border border-teal-800/40">
                      {fx.currency_code}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">{fx.currency_name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">سعر الشراء</span>
                      <span className="font-bold font-mono">{fx.buy_rate}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">سعر البيع</span>
                      <span className="font-bold font-mono">{fx.sell_rate}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex justify-between">
                    <span>السعر الرسمي الوسطي:</span>
                    <span className="font-bold text-foreground font-mono">{fx.official_mid_rate} SAR</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {newInvModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base border-b border-border pb-2">إصدار فاتورة ضريبية إلكترونية ZATCA</h3>
            <form onSubmit={handleGenerateInvoice} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">اسم العميل:</label>
                <input
                  type="text"
                  required
                  value={invForm.customer_name}
                  onChange={e => setInvForm(p => ({ ...p, customer_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">الرقم الضريبي للعميل (VAT No):</label>
                <input
                  type="text"
                  required
                  value={invForm.customer_tax_number}
                  onChange={e => setInvForm(p => ({ ...p, customer_tax_number: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">المعالجة الضريبية:</label>
                <select
                  value={invForm.tax_treatment}
                  onChange={e => setInvForm(p => ({ ...p, tax_treatment: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-medium"
                >
                  <option value="commission_only">ضريبة عمولة الوكالة فقط (Commission 15% VAT)</option>
                  <option value="full_principal_value">ضريبة القيمة الإجمالية للخدمة (Principal 15% VAT)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">قيمة التذكرة/الفندق:</label>
                  <input
                    type="number"
                    value={invForm.ticket_or_hotel_value}
                    onChange={e => setInvForm(p => ({ ...p, ticket_or_hotel_value: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">عمولة الوكالة:</label>
                  <input
                    type="number"
                    value={invForm.agency_commission}
                    onChange={e => setInvForm(p => ({ ...p, agency_commission: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow transition"
                >
                  إصدار وختم الفاتورة
                </button>
                <button
                  type="button"
                  onClick={() => setNewInvModal(false)}
                  className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}

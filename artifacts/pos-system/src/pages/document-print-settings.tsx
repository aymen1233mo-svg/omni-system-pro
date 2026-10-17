import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Save, FileText, Building, Receipt, Users, ShieldCheck, Upload, Eye, 
  Truck, ShoppingBag, Palette, Printer, Sparkles, Check, RefreshCw
} from "lucide-react";
import { 
  printA4Html, 
  generateWarehouseInvoiceA4Html, 
  generatePurchaseInvoiceA4Html, 
  generateVoucherStyle2A4Html, 
  generateStatementA4Html, 
  generateJournalVoucherA4Html,
  hexToRgba
} from "@/lib/printUtils";
import { ReportViewerModal } from "@/components/ReportViewerModal";

const PRESET_COLORS = [
  { name: "الأزرق الملكي", hex: "#2563eb", bgClass: "bg-blue-600" },
  { name: "العنابي الفاخر", hex: "#881337", bgClass: "bg-rose-900" },
  { name: "الأخضر الزمردي", hex: "#059669", bgClass: "bg-emerald-600" },
  { name: "الكحلي الداكن", hex: "#1e3a8a", bgClass: "bg-blue-900" },
  { name: "الأحمر القرمزي", hex: "#dc2626", bgClass: "bg-red-600" },
  { name: "البنفسجي الملكي", hex: "#7c3aed", bgClass: "bg-purple-600" },
  { name: "الكهرماني الذهبي", hex: "#d97706", bgClass: "bg-amber-600" },
  { name: "الفيروزي / تيل", hex: "#0f766e", bgClass: "bg-teal-700" },
  { name: "الرمادي الفحمي", hex: "#334155", bgClass: "bg-slate-700" },
];

export default function DocumentPrintSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<"header" | "sales_invoice" | "purchase_invoice" | "voucher" | "customer_statement" | "employee_statement" | "journal_voucher">("header");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalHtml, setModalHtml] = useState("");
  const [modalTitle, setModalTitle] = useState("");

  const [form, setForm] = useState<any>({
    companyName: "OmniSystem Pro",
    companySubtitle: "نظام نقاط البيع وإدارة الموارد",
    address: "عدن/المعلا",
    phone: "774106282",
    taxNumber: "",
    logoUrl: "/omnisystem-logo.png",
    customerHeaderText: "كشف حساب عميل معتمد",
    customerFooterText: "شكراً لتعاملكم معنا - يُرجى مراجعة الحسابات خلال 15 يوماً",
    supplierHeaderText: "كشف حساب مورد معتمد",
    supplierFooterText: "الرصيد المبين أعلاه خاضع للمطابقة والتدقيق المحاسبي.",
    employeeHeaderText: "كشف حساب ومسير رواتب موظف",
    employeeFooterText: "إدارة الموارد البشرية - التوقيع والاعتماد",
    voucherReceiptTitle: "سند قبض",
    voucherPaymentTitle: "سند صرف",
    voucherJournalTitle: "سند قيد يومية",
    voucherFooterText: "المحاسب _______ المدير _______ المستلم _______",
    invoiceHeaderText: "فاتورة مبيعات ضريبية",
    invoiceFooterText: "شكراً لتعاملكم معنا — نتطلع لخدمتكم دائماً",
    reportHeaderText: "تقرير عام شامل",
    reportFooterText: "طبع بواسطة نظام OmniSystem Pro",
    accentColor: "#2563eb",
    headerRightText1: "معمل عبدالاسلام للخبز العربي",
    headerRightText2: "عدن/المعلا",
    headerRightText3: "774106282",
    headerLeftText1: "قيس",
    headerLeftText2: "عدن/المعلا",
    headerLeftText3: "771845734",
    showLogo: true,
    showTaxNumber: true,
    showBranchInfo: true,
    showSignatureBoxes: true,
    showStampBox: true,
  });

  useEffect(() => {
    fetch("/api/document-print-settings")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setForm((prev: any) => ({ ...prev, ...data }));
          try {
            localStorage.setItem("pos_doc_print_settings", JSON.stringify(data));
          } catch {}
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setSaving(true);
    const token = localStorage.getItem("pos_token") || "";
    fetch("/api/document-print-settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(form),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || data?.message || `خطأ في الخادم (${res.status})`);
        }
        return data;
      })
      .then((data) => {
        setSaving(false);
        if (data && !data.error) {
          setForm((prev: any) => ({ ...prev, ...data }));
          try {
            localStorage.setItem("pos_doc_print_settings", JSON.stringify(data));
          } catch {}
          window.dispatchEvent(new CustomEvent("doc-print-settings-updated", { detail: data }));
          qc.invalidateQueries({ queryKey: ["document-print-settings"] });
          qc.invalidateQueries({ queryKey: ["settings"] });
          toast({ title: "تم حفظ وتطبيق الهوية البصرية، اللون الرئيسي وكافة نصوص المطبوعات فوراً على النظام ✅" });
        } else {
          toast({ variant: "destructive", title: "فشل الحفظ", description: data?.error || "خطأ غير معروف" });
        }
      })
      .catch((err) => {
        setSaving(false);
        console.error("Save error:", err);
        toast({ 
          variant: "destructive", 
          title: "فشل الاتصال بالخادم", 
          description: err.message || "تأكد من الاتصال بالخادم" 
        });
      });
  };

  const setField = (field: string, val: any) => {
    setForm((prev: any) => ({ ...prev, [field]: val }));
  };

  // Generate real sample documents for live preview
  const generateSampleSalesInvoice = () => {
    return generateWarehouseInvoiceA4Html({
      invoice_no: "INV-2026-0842",
      date: new Date().toISOString().slice(0, 10),
      payment_type: "cash",
      customer_name: "شركة الأفق للاستيراد والتوزيع",
      customer_account_code: "11400102",
      currency: "YER",
      items: [
        { product_name: "خبز عربي ممتاز (كيس جامبو)", product_code: "PRD-001", quantity: 50, price: 120, total: 6000 },
        { product_name: "روتي فرنسي محمص خاص", product_code: "PRD-004", quantity: 30, price: 150, total: 4500 },
        { product_name: "كعك يمني بالسمن البلدي", product_code: "PRD-009", quantity: 15, price: 400, total: 6000 },
      ],
      subtotal: 16500,
      discount_amount: 500,
      tax_amount: 0,
      net_amount: 16000,
    }, form);
  };

  const generateSamplePurchaseInvoice = () => {
    return generatePurchaseInvoiceA4Html({
      invoice_number: "PUR-2026-0319",
      date: new Date().toISOString().slice(0, 10),
      payment_type: "credit",
      supplier_name: "مؤسسة مطاحن صوامع الغلال الكبرى",
      supplier_code: "SUP-21104",
      currency: "YER",
      items: [
        { product_name: "دقيق قمح استرالي فاخر 50 كجم", item_code: "RAW-101", quantity: 200, price: 28000, total: 5600000 },
        { product_name: "خميرة فورية تركية أصلية كرتون", item_code: "RAW-105", quantity: 25, price: 18500, total: 462500 },
        { product_name: "سمسم بلدي منقى درجة أولى", item_code: "RAW-112", quantity: 10, price: 32000, total: 320000 },
      ],
      subtotal: 6382500,
      discount: 32500,
      total: 6350000,
    }, form);
  };

  const generateSampleVoucher = (type: "receipt" | "payment") => {
    return generateVoucherStyle2A4Html({
      type,
      voucherNumber: type === "receipt" ? "REC-1049" : "PAY-2081",
      date: new Date().toISOString().slice(0, 10),
      partyName: type === "receipt" ? "مؤسسة الوحدة للتجارة العامة" : "المورد / شركة البركة للزيوت النباتية",
      amount: type === "receipt" ? 250000 : 180000,
      currency: "YER",
      paymentMethod: "cash",
      notes: type === "receipt" ? "دفعة نقدية مسددة تحت حساب فواتير مبيعات سابقة" : "سداد دفعة من قيمة شحنة الزيوت المستلمة بموجب الفاتورة",
      safeName: "الصندوق الرئيسي - المعلا",
      settings: form
    });
  };

  const generateSampleCustomerStatement = () => {
    return generateStatementA4Html({
      partyType: "customer",
      party: { id: 104, code: "CUST-104", name: "مجموعة هائل سعيد أنعم وشركاه", phone: "771234567" },
      startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      previousBalance: 120000,
      currentBalance: 460000,
      currency: "YER",
      transactions: [
        { date: "2026-09-05", type_name: "فاتورة مبيعات", description: "مبيعات مخزنية آجلة فاتورة #INV-1021", debit: 380000, credit: 0, runningBalance: 500000, currency: "YER" },
        { date: "2026-09-15", type_name: "سند قبض", description: "سداد نقدي في الصندوق الرئيسي سند #REC-98", debit: 0, credit: 200000, runningBalance: 300000, currency: "YER" },
        { date: "2026-09-28", type_name: "فاتورة مبيعات", description: "طلبية منتجات مخابز خاصة فاتورة #INV-1088", debit: 160000, credit: 0, runningBalance: 460000, currency: "YER" },
      ],
      settings: form
    });
  };

  const generateSampleEmployeeStatement = () => {
    return generateStatementA4Html({
      partyType: "employee",
      party: { 
        id: 12, 
        name: "إبراهيم محمد صالح الشاوش", 
        employee_number: "EMP-1012", 
        position: "مشرف خط إنتاج ومسؤول جودة", 
        department_name: "إدارة التشغيل والمخابز",
        basic_salary: 320000,
        phone: "777654321",
        hire_date: "2024-01-15",
        active: 1
      },
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      previousBalance: 0,
      currentBalance: 310000,
      currency: "YER",
      transactions: [
        { date: "2026-09-01", type: "استحقاق راتب شهري", description: "مسير راتب شهر سبتمبر 2026", debit: 0, credit: 320000, runningBalance: 320000 },
        { date: "2026-09-12", type: "سلفة نقدية", description: "سلفة على الراتب سند صرف #PAY-112", debit: 30000, credit: 0, runningBalance: 290000 },
        { date: "2026-09-25", type: "مكافأة تميز", description: "بدل إنتاجية إضافية للأعياد", debit: 0, credit: 20000, runningBalance: 310000 },
      ],
      settings: form
    });
  };

  const generateSampleJournalVoucher = () => {
    return generateJournalVoucherA4Html({
      voucherNumber: "JV-2026-0512",
      date: new Date().toISOString().slice(0, 10),
      userName: "المحاسب المالي العام",
      description: "قيد إقفال وتوزيع إيرادات ومصروفات الإنتاج اليومي للمخابز",
      currency: "YER",
      referenceNo: "REF-9921",
      lines: [
        { account_code: "11100", account_name: "الصندوق الرئيسي", description: "توريد مبيعات نقدية", debit: 450000, credit: 0, currency: "YER" },
        { account_code: "41101", account_name: "إيراد مبيعات المخبوزات", description: "إثبات مبيعات الوردية الصباحية", debit: 0, credit: 450000, currency: "YER" },
        { account_code: "51102", account_name: "مصروفات مستلزمات تشغيل", description: "شراء ملح وسولار ومستلزمات", debit: 65000, credit: 0, currency: "YER" },
        { account_code: "11100", account_name: "الصندوق الرئيسي", description: "صرف نقدي من الصندوق", debit: 0, credit: 65000, currency: "YER" },
      ],
      settings: form
    });
  };

  const openFullscreenPreview = (type: string) => {
    let html = "";
    let title = "";
    if (type === "sales_invoice") {
      html = generateSampleSalesInvoice();
      title = "معاينة فاتورة مبيعات مخزنية A4";
    } else if (type === "purchase_invoice") {
      html = generateSamplePurchaseInvoice();
      title = "معاينة فاتورة مشتريات وربط مخزني ومحاسبي A4";
    } else if (type === "receipt_voucher") {
      html = generateSampleVoucher("receipt");
      title = "معاينة سند قبض مالي معتمد A4";
    } else if (type === "payment_voucher") {
      html = generateSampleVoucher("payment");
      title = "معاينة سند صرف مالي معتمد A4";
    } else if (type === "customer_statement") {
      html = generateSampleCustomerStatement();
      title = "معاينة كشف حساب عميل معتمد A4";
    } else if (type === "employee_statement") {
      html = generateSampleEmployeeStatement();
      title = "معاينة كشف حساب ومسير رواتب موظف A4";
    } else if (type === "journal_voucher") {
      html = generateSampleJournalVoucher();
      title = "معاينة سند قيد يومية محاسبي A4";
    }

    setModalHtml(html);
    setModalTitle(title);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>جاري تحميل إعدادات الهوية والمطبوعات...</span>
        </div>
      </AdminLayout>
    );
  }

  const currentAccent = form.accentColor || "#2563eb";

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-16" dir="rtl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border shadow-xs">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-xl text-white shadow-xs" style={{ backgroundColor: currentAccent }}>
                <FileText className="w-6 h-6" />
              </span>
              إدارة تخصيص النصوص، الصور، كشوفات الحسابات والسندات
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              تحكم كامل في ترويسات ومحتويات وتذييلات الفواتير، كشوفات عملاء وموظفين، والسندات وتطبيقها فوراً على النظام.
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="gap-2 text-white font-bold px-7 py-5 text-base shadow-sm cursor-pointer hover:opacity-90 transition-all"
            style={{ backgroundColor: currentAccent }}
          >
            <Save className="w-5 h-5" />
            {saving ? "جاري الحفظ..." : "حفظ التغييرات وتطبيقها فوراً"}
          </Button>
        </div>

        {/* Live Interactive Multi-Tab Visual Preview */}
        <Card className="border shadow-xs overflow-hidden rounded-2xl">
          <CardHeader className="bg-slate-50/90 py-3.5 px-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <Eye className="w-4 h-4" style={{ color: currentAccent }} />
                معاينة حية ومباشرة لشكل الترويسة، الألوان والشعار وتأثيرها على كافة وثائق النظام
              </CardTitle>
              <CardDescription className="text-xs">
                انقر على التبويبات بالأسفل لمشاهدة كيف ينعكس اللون الرئيسي ونصوص الترويسة فوراً على كل نوع مستند
              </CardDescription>
            </div>

            {/* Preview Document Tabs */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => setActivePreviewTab("header")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activePreviewTab === "header" 
                    ? "bg-white text-slate-900 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                الترويسة العامة
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab("sales_invoice")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activePreviewTab === "sales_invoice" 
                    ? "bg-white text-slate-900 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                فاتورة مبيعات
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab("purchase_invoice")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activePreviewTab === "purchase_invoice" 
                    ? "bg-white text-slate-900 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                فاتورة مشتريات
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab("voucher")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activePreviewTab === "voucher" 
                    ? "bg-white text-slate-900 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                سندات قبض وصرف
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab("customer_statement")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activePreviewTab === "customer_statement" 
                    ? "bg-white text-slate-900 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                كشف حساب عملاء
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab("employee_statement")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activePreviewTab === "employee_statement" 
                    ? "bg-white text-slate-900 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                كشف حساب موظف
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab("journal_voucher")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activePreviewTab === "journal_voucher" 
                    ? "bg-white text-slate-900 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                سند قيد
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-5 bg-slate-50/50">
            {/* Tab 1: Header Banner Preview */}
            {activePreviewTab === "header" && (
              <div
                className="rounded-xl border-2 p-5 bg-white shadow-xs transition-all"
                style={{ borderColor: currentAccent }}
              >
                <div
                  className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b-2"
                  style={{ borderBottomColor: currentAccent }}
                >
                  {/* Right Column */}
                  <div className="text-right space-y-0.5 flex-1">
                    <div className="text-lg font-black" style={{ color: currentAccent }}>
                      {form.headerRightText1 || form.companyName || "اسم النشاط التجاري"}
                    </div>
                    {form.companySubtitle && (
                      <div className="text-xs font-semibold text-slate-600">{form.companySubtitle}</div>
                    )}
                    {(form.headerRightText2 || form.address) && (
                      <div className="text-xs text-slate-700">{form.headerRightText2 || form.address}</div>
                    )}
                    {(form.headerRightText3 || form.phone) && (
                      <div className="text-xs font-mono text-slate-700">{form.headerRightText3 || form.phone}</div>
                    )}
                    {form.showTaxNumber && form.taxNumber && (
                      <div className="text-[11px] font-mono text-slate-500">الرقم الضريبي: {form.taxNumber}</div>
                    )}
                  </div>

                  {/* Center Logo & Title Badge */}
                  <div className="flex flex-col items-center justify-center gap-2 px-4">
                    {form.showLogo !== false && form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="الشعار"
                        className="h-16 w-auto max-w-[140px] object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/omnisystem-logo.png"; }}
                      />
                    ) : null}
                    <span
                      className="px-4 py-1 rounded-full text-xs font-black text-white shadow-xs"
                      style={{ backgroundColor: currentAccent }}
                    >
                      {form.customerHeaderText || "كشف حساب عميل معتمد"} / {form.voucherReceiptTitle || "سند قبض"}
                    </span>
                  </div>

                  {/* Left Column */}
                  <div className="text-left space-y-0.5 flex-1" dir="ltr">
                    <div className="text-lg font-black" style={{ color: currentAccent }}>
                      {form.headerLeftText1 || form.companyName || "OmniSystem Pro"}
                    </div>
                    {form.headerLeftText2 && (
                      <div className="text-xs text-slate-700">{form.headerLeftText2}</div>
                    )}
                    {form.headerLeftText3 && (
                      <div className="text-xs font-mono text-slate-700">{form.headerLeftText3}</div>
                    )}
                    <div className="text-[11px] text-slate-400 font-mono">{new Date().toLocaleDateString("en-GB")}</div>
                  </div>
                </div>

                <div className="pt-3 mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border">
                  <span><strong>تذييل الفواتير:</strong> {form.invoiceFooterText || "شكراً لتعاملكم معنا"}</span>
                  <span><strong>تذييل السندات:</strong> {form.voucherFooterText || "المحاسب _______ المدير _______"}</span>
                  <span><strong>تذييل الكشوفات:</strong> {form.customerFooterText || "يرجى مطابقة الحساب"}</span>
                </div>
              </div>
            )}

            {/* Tab 2: Sales Invoice Live Preview */}
            {activePreviewTab === "sales_invoice" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4" style={{ color: currentAccent }} />
                    معاينة فاتورة المبيعات المخزنية (نقد / آجل) باللون والهوية المعتمدة
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openFullscreenPreview("sales_invoice")}
                    className="gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    استعراض وطباعة تجريبية A4
                  </Button>
                </div>
                <div className="rounded-xl border overflow-hidden shadow-xs bg-white p-2">
                  <iframe
                    title="Sales Invoice Preview"
                    srcDoc={generateSampleSalesInvoice()}
                    className="w-full h-[380px] border-0 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Purchase Invoice Live Preview */}
            {activePreviewTab === "purchase_invoice" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Truck className="w-4 h-4" style={{ color: currentAccent }} />
                    معاينة فاتورة المشتريات والربط المخزني والمحاسبي باللون والهوية المعتمدة
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openFullscreenPreview("purchase_invoice")}
                    className="gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    استعراض وطباعة تجريبية A4
                  </Button>
                </div>
                <div className="rounded-xl border overflow-hidden shadow-xs bg-white p-2">
                  <iframe
                    title="Purchase Invoice Preview"
                    srcDoc={generateSamplePurchaseInvoice()}
                    className="w-full h-[380px] border-0 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}

            {/* Tab 4: Vouchers Live Preview */}
            {activePreviewTab === "voucher" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4" style={{ color: currentAccent }} />
                    معاينة سندات القبض والصرف الرسمية مع التلوين الديناميكي لكافة الخانات والحقول
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openFullscreenPreview("receipt_voucher")}
                      className="gap-1.5 text-xs font-bold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      طباعة سند قبض
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openFullscreenPreview("payment_voucher")}
                      className="gap-1.5 text-xs font-bold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      طباعة سند صرف
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border overflow-hidden shadow-xs bg-white p-2">
                  <iframe
                    title="Voucher Preview"
                    srcDoc={generateSampleVoucher("receipt")}
                    className="w-full h-[380px] border-0 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}

            {/* Tab 5: Customer Statement Live Preview */}
            {activePreviewTab === "customer_statement" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4" style={{ color: currentAccent }} />
                    معاينة كشف حساب العملاء والموردين باللون الرئيسي والترويسة
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openFullscreenPreview("customer_statement")}
                    className="gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    استعراض وطباعة كشف حساب
                  </Button>
                </div>
                <div className="rounded-xl border overflow-hidden shadow-xs bg-white p-2">
                  <iframe
                    title="Customer Statement Preview"
                    srcDoc={generateSampleCustomerStatement()}
                    className="w-full h-[380px] border-0 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}

            {/* Tab 6: Employee Statement Live Preview */}
            {activePreviewTab === "employee_statement" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" style={{ color: currentAccent }} />
                    معاينة كشف حساب ومسير رواتب الموظفين مع بطاقات المؤشرات المالية
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openFullscreenPreview("employee_statement")}
                    className="gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    استعراض مسير الموظف
                  </Button>
                </div>
                <div className="rounded-xl border overflow-hidden shadow-xs bg-white p-2">
                  <iframe
                    title="Employee Statement Preview"
                    srcDoc={generateSampleEmployeeStatement()}
                    className="w-full h-[380px] border-0 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}

            {/* Tab 7: Journal Voucher Live Preview */}
            {activePreviewTab === "journal_voucher" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" style={{ color: currentAccent }} />
                    معاينة سند قيد اليومية والقيود المحاسبية باللون المعتمد
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openFullscreenPreview("journal_voucher")}
                    className="gap-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    استعراض سند القيد
                  </Button>
                </div>
                <div className="rounded-xl border overflow-hidden shadow-xs bg-white p-2">
                  <iframe
                    title="Journal Voucher Preview"
                    srcDoc={generateSampleJournalVoucher()}
                    className="w-full h-[380px] border-0 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accent Color Section with Preset Swatches */}
        <Card className="border shadow-xs overflow-hidden rounded-2xl">
          <CardHeader className="bg-slate-50/70 pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <Palette className="w-5 h-5" style={{ color: currentAccent }} />
              تحديد اللون الرئيسي للتقارير والسندات وكشوفات الحسابات والفواتير (Accent Color)
            </CardTitle>
            <CardDescription className="text-xs">
              يؤثر هذا اللون مباشرة على ترويسة وهوية فاتورة المبيعات المخزنية (نقد / آجل)، وفواتير المشتريات، وسندات القبض والصرف، وسندات القيد، وكافة كشوفات الحسابات
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border bg-white">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-800 block">اللون النشط الحالي:</label>
                <div className="flex items-center gap-3">
                  <Input 
                    type="color" 
                    value={form.accentColor || "#2563eb"} 
                    onChange={(e) => setField("accentColor", e.target.value)} 
                    className="w-14 h-11 p-1 rounded-lg cursor-pointer border-2" 
                    style={{ borderColor: currentAccent }}
                  />
                  <Input 
                    value={form.accentColor || "#2563eb"} 
                    onChange={(e) => setField("accentColor", e.target.value)} 
                    className="w-36 font-mono font-bold text-center text-sm" 
                  />
                  <div 
                    className="px-4 py-2 rounded-lg text-white font-bold text-xs shadow-xs"
                    style={{ backgroundColor: currentAccent }}
                  >
                    معاينة اللون المختار
                  </div>
                </div>
              </div>

              {/* Preset Color Swatches */}
              <div className="space-y-1.5 flex-1 max-w-lg">
                <label className="text-xs font-black text-slate-700 block">ألوان كلاسيكية معتمدة بنقرة واحدة:</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => {
                    const isSelected = form.accentColor?.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setField("accentColor", c.hex)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                          isSelected 
                            ? "ring-2 ring-offset-1 text-white shadow-xs font-black" 
                            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                        style={{ 
                          backgroundColor: isSelected ? c.hex : undefined,
                          borderColor: isSelected ? c.hex : undefined
                        }}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full ${c.bgClass} inline-block border border-white/50 shrink-0`} />
                        <span>{c.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* General Company & Branding */}
          <Card className="border shadow-xs rounded-2xl">
            <CardHeader className="bg-slate-50/50 pb-4 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <Building className="w-5 h-5" style={{ color: currentAccent }} />
                هوية المؤسسة والترويسة العامة
              </CardTitle>
              <CardDescription className="text-xs">الاسم والشعار والألوان المستخدمة في جميع التقارير والسندات والفواتير</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 border p-3.5 rounded-xl bg-slate-50/60">
                  <label className="text-xs font-bold text-slate-700 mb-1 block">بيانات الترويسة اليمنى (عربي)</label>
                  <Input placeholder="السطر الأول (مثال: معمل عبدالاسلام للخبز)" value={form.headerRightText1 || ""} onChange={(e) => setField("headerRightText1", e.target.value)} className="text-xs" />
                  <Input placeholder="السطر الثاني (مثال: عدن/المعلا)" value={form.headerRightText2 || ""} onChange={(e) => setField("headerRightText2", e.target.value)} className="text-xs" />
                  <Input placeholder="السطر الثالث (مثال: رقم هاتف)" value={form.headerRightText3 || ""} onChange={(e) => setField("headerRightText3", e.target.value)} className="text-xs" />
                </div>
                <div className="space-y-2 border p-3.5 rounded-xl bg-slate-50/60">
                  <label className="text-xs font-bold text-slate-700 mb-1 block">بيانات الترويسة اليسرى (عربي/إنجليزي)</label>
                  <Input placeholder="السطر الأول (مثال: قيس)" value={form.headerLeftText1 || ""} onChange={(e) => setField("headerLeftText1", e.target.value)} className="text-xs" />
                  <Input placeholder="السطر الثاني (مثال: عدن/المعلا)" value={form.headerLeftText2 || ""} onChange={(e) => setField("headerLeftText2", e.target.value)} className="text-xs" />
                  <Input placeholder="السطر الثالث (مثال: رقم هاتف)" value={form.headerLeftText3 || ""} onChange={(e) => setField("headerLeftText3", e.target.value)} className="text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">اسم المؤسسة / الشركة (الافتراضي)</label>
                  <Input value={form.companyName || ""} onChange={(e) => setField("companyName", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">العنوان الفرعي / الوصف</label>
                  <Input value={form.companySubtitle || ""} onChange={(e) => setField("companySubtitle", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">العنوان التفصيلي</label>
                  <Input value={form.address || ""} onChange={(e) => setField("address", e.target.value)} className="text-xs" placeholder="المدينة / الشارع" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">رقم الهاتف للتواصل</label>
                  <Input value={form.phone || ""} onChange={(e) => setField("phone", e.target.value)} className="text-xs" placeholder="77xxxxxxx" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">الرقم الضريبي</label>
                  <Input value={form.taxNumber || ""} onChange={(e) => setField("taxNumber", e.target.value)} className="text-xs" placeholder="الرقم الضريبي (إن وجد)" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>شعار كشف الحساب والسندات والطباعة</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-300">متاح للرفع والتعديل</span>
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border rounded-xl bg-slate-50/50">
                  <div className="border rounded-lg p-2 bg-white flex items-center justify-center w-28 h-18 shrink-0 shadow-xs overflow-hidden">
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="الشعار المعتمد"
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/omnisystem-logo.png"; }}
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400">بدون شعار</span>
                    )}
                  </div>
                  <div className="space-y-2 flex-1">
                    <p className="text-xs font-bold text-slate-800">شعار الطباعة والوثائق الرسمية المعتمد</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      اختر ملف صورة للشعار من الجهاز لطباعته في ترويسة التقارير، الفواتير، كشوفات الحسابات والسندات.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="cursor-pointer">
                        <Input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setField("logoUrl", reader.result as string);
                                setField("showLogo", true);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <Button type="button" variant="outline" size="sm" asChild className="gap-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-300 cursor-pointer">
                          <span>
                            <Upload className="w-3.5 h-3.5 ml-1" />
                            رفع شعار جديد
                          </span>
                        </Button>
                      </label>
                      {form.logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-600 hover:bg-red-50 cursor-pointer"
                          onClick={() => { setField("logoUrl", ""); setField("showLogo", false); }}
                        >
                          إزالة الشعار
                        </Button>
                      )}
                      {!form.logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                          onClick={() => { setField("logoUrl", "/omnisystem-logo.png"); setField("showLogo", true); }}
                        >
                          استعادة الشعار الافتراضي
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vouchers & Sales Invoices Customization */}
          <Card className="border shadow-xs rounded-2xl">
            <CardHeader className="bg-slate-50/50 pb-4 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <Receipt className="w-5 h-5" style={{ color: currentAccent }} />
                تخصيص السندات المالية وفواتير المبيعات
              </CardTitle>
              <CardDescription className="text-xs">عناوين وتذييلات سندات القبض والصرف والقيود المحاسبية وفواتير المبيعات</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">عنوان سند القبض</label>
                  <Input value={form.voucherReceiptTitle || ""} onChange={(e) => setField("voucherReceiptTitle", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">عنوان سند الصرف</label>
                  <Input value={form.voucherPaymentTitle || ""} onChange={(e) => setField("voucherPaymentTitle", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">عنوان سند القيد</label>
                  <Input value={form.voucherJournalTitle || ""} onChange={(e) => setField("voucherJournalTitle", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">تذييل السندات (التواقيع والأختام والملاحظات)</label>
                <Textarea value={form.voucherFooterText || ""} onChange={(e) => setField("voucherFooterText", e.target.value)} rows={2} />
              </div>

              <div className="pt-3 border-t space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4" style={{ color: currentAccent }} />
                  تخصيص فواتير المبيعات المخزنية والفواتير الضريبية
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">عنوان الفاتورة في الطباعة</label>
                  <Input value={form.invoiceHeaderText || ""} onChange={(e) => setField("invoiceHeaderText", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">تذييل الفواتير وعبارة الشكر</label>
                  <Textarea value={form.invoiceFooterText || ""} onChange={(e) => setField("invoiceFooterText", e.target.value)} rows={2} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Statements Customization */}
          <Card className="border shadow-xs rounded-2xl">
            <CardHeader className="bg-slate-50/50 pb-4 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <Users className="w-5 h-5" style={{ color: currentAccent }} />
                تخصيص كشوفات حساب العملاء والموردين
              </CardTitle>
              <CardDescription className="text-xs">النصوص الافتتاحية والختامية لكشوفات حساب العملاء والموردين</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">ترويسة كشف حساب العملاء</label>
                <Input value={form.customerHeaderText || ""} onChange={(e) => setField("customerHeaderText", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">ملاحظات وتذييل كشف حساب العملاء</label>
                <Textarea value={form.customerFooterText || ""} onChange={(e) => setField("customerFooterText", e.target.value)} rows={2} />
              </div>
              <div className="pt-3 border-t space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Truck className="w-4 h-4" style={{ color: currentAccent }} />
                  كشوفات حساب الموردين
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">ترويسة كشف حساب الموردين</label>
                  <Input value={form.supplierHeaderText || ""} onChange={(e) => setField("supplierHeaderText", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">ملاحظات وتذييل كشف حساب الموردين</label>
                  <Textarea value={form.supplierFooterText || ""} onChange={(e) => setField("supplierFooterText", e.target.value)} rows={2} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee Statements Customization */}
          <Card className="border shadow-xs rounded-2xl">
            <CardHeader className="bg-slate-50/50 pb-4 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <ShieldCheck className="w-5 h-5" style={{ color: currentAccent }} />
                تخصيص كشوفات ومسيرات رواتب الموظفين
              </CardTitle>
              <CardDescription className="text-xs">النصوص والاعتمادات لمسيرات الرواتب وكشوفات الموظفين</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">ترويسة كشف حساب/مسير الموظفين</label>
                <Input value={form.employeeHeaderText || ""} onChange={(e) => setField("employeeHeaderText", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">تذييل مسيرات الرواتب وكشوفات الموظفين</label>
                <Textarea value={form.employeeFooterText || ""} onChange={(e) => setField("employeeFooterText", e.target.value)} rows={2} />
              </div>

              <div className="pt-3 border-t space-y-2">
                <label className="text-xs font-bold text-slate-700 block">خيارات الإظهار في المطبوعات الرسمية</label>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border bg-slate-50 hover:bg-slate-100">
                    <input type="checkbox" checked={form.showLogo !== false} onChange={(e) => setField("showLogo", e.target.checked)} />
                    <span className="font-bold">إظهار الشعار في الترويسة</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border bg-slate-50 hover:bg-slate-100">
                    <input type="checkbox" checked={form.showTaxNumber !== false} onChange={(e) => setField("showTaxNumber", e.target.checked)} />
                    <span className="font-bold">إظهار الرقم الضريبي</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border bg-slate-50 hover:bg-slate-100">
                    <input type="checkbox" checked={form.showSignatureBoxes !== false} onChange={(e) => setField("showSignatureBoxes", e.target.checked)} />
                    <span className="font-bold">إظهار خانات التوقيع</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border bg-slate-50 hover:bg-slate-100">
                    <input type="checkbox" checked={form.showStampBox !== false} onChange={(e) => setField("showStampBox", e.target.checked)} />
                    <span className="font-bold">إظهار خانة الختم الرسمي</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* General Reports Customization */}
        <Card className="border shadow-xs rounded-2xl">
          <CardHeader className="bg-slate-50/50 pb-4 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <FileText className="w-5 h-5" style={{ color: currentAccent }} />
              تخصيص التقارير العامة والإدارية الشاملة
            </CardTitle>
            <CardDescription className="text-xs">الترويسة والتذييل الموحد لجميع التقارير في النظام</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">ترويسة التقارير العامة</label>
              <Input value={form.reportHeaderText || ""} onChange={(e) => setField("reportHeaderText", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">تذييل التقارير العامة</label>
              <Input value={form.reportFooterText || ""} onChange={(e) => setField("reportFooterText", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Floating Save Action Bar */}
        <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-sm p-4 rounded-2xl border shadow-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <Sparkles className="w-4 h-4" style={{ color: currentAccent }} />
            <span>عند الحفظ، سيتم تحديث الهوية واللون الرئيسي فوراً في كافة السندات، الفواتير، الكشوفات والتقارير.</span>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="gap-2 text-white font-bold px-8 py-2.5 text-sm shadow-md cursor-pointer hover:opacity-90"
            style={{ backgroundColor: currentAccent }}
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ والتطبيق..." : "حفظ التغييرات وتطبيقها فوراً"}
          </Button>
        </div>
      </div>

      {/* Fullscreen Report & Print Viewer Modal */}
      <ReportViewerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        htmlContent={modalHtml}
      />
    </AdminLayout>
  );
}

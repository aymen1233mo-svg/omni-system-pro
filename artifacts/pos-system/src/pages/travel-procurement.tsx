import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ShoppingBag,
  Plus,
  Search,
  Users,
  Printer,
  FileText,
  DollarSign,
  CheckCircle2,
  Building2,
  CreditCard,
  Layers,
  ClipboardList,
  FileCheck,
  Wallet,
  BarChart3,
  Eye,
  Trash2,
  Edit,
  ArrowRightLeft,
  Calendar,
  Sparkles,
  ShieldCheck,
  Tag,
  Clock,
  TrendingUp,
  X,
  Plane,
  Hotel,
  Bus,
  Coins,
  FileCheck2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Format numbers
const fmt = (num: number) => (num || 0).toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function TravelProcurementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Tab State - read from URL query param ?tab=...
  const [activeTab, setActiveTab] = useState<string>("invoices");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [location]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const newUrl = `/travel-procurement?tab=${newTab}`;
    setLocation(newUrl);
  };

  const [search, setSearch] = useState("");

  // Full-Screen Report Viewer State
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportTitle, setReportTitle] = useState("");

  // Full-Screen Dialogs States
  const [openRequestModal, setOpenRequestModal] = useState(false);
  const [openRfqModal, setOpenRfqModal] = useState(false);
  const [openOrderModal, setOpenOrderModal] = useState(false);
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [openContractModal, setOpenContractModal] = useState(false);

  // Selected items for view/actions
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // ─────────────────────────────────────────────
  // Mock / Initial Data States for Full Procurement Workflow
  // ─────────────────────────────────────────────

  // 1. Requests State (طلبات الشراء PRs)
  const [requestsList, setRequestsList] = useState<any[]>([
    {
      id: 1,
      pr_number: "PR-2026-001",
      supplier_name: "شركة الخطوط السعودية (Saudia)",
      service_category: "تذاكر طيران",
      description: "طلب توريد 20 تذكرة طيران الرياض - جدة - الرياض لموسم العمرة",
      requested_by: "قسم المبيعات السياحية",
      estimated_cost: 18000,
      target_date: "2026-09-15",
      status: "معتمد",
      created_at: "2026-09-01"
    },
    {
      id: 2,
      pr_number: "PR-2026-002",
      supplier_name: "سلسلة فنادق دار التوحيد مكة",
      service_category: "غرف واجنيح فنادق",
      description: "حجز كتلة 15 جناح فاخر لإقامة مجموعة كبار الشخصيات VIP",
      requested_by: "إدارة الحجوزات والفنادق",
      estimated_cost: 45000,
      target_date: "2026-09-20",
      status: "معلق",
      created_at: "2026-09-03"
    },
    {
      id: 3,
      pr_number: "PR-2026-003",
      supplier_name: "شركة النقل الجماعي (سابتكو)",
      service_category: "نقل بري ولوجستيات",
      description: "استئجار 3 حافلات VIP لنقل حجاج الداخل من المطار إلى الفندق",
      requested_by: "قسم النقل واللوجستيات",
      estimated_cost: 12000,
      target_date: "2026-09-18",
      status: "قيد المراجعة",
      created_at: "2026-09-04"
    }
  ]);

  // Form for New Request
  const [requestForm, setRequestForm] = useState({
    supplier_name: "شركة الخطوط السعودية (Saudia)",
    service_category: "تذاكر طيران",
    description: "طلب توريد خدمات حجز سياحي",
    requested_by: "إدارة العمليات",
    estimated_cost: 15000,
    target_date: new Date().toISOString().slice(0, 10),
    notes: ""
  });

  // 2. RFQs & Price Comparisons State (مقارنة الأسعار)
  const [rfqsList, setRfqsList] = useState<any[]>([
    {
      id: 1,
      rfq_number: "RFQ-2026-101",
      title: "مناقصة توريد تذاكر رحلات خط الرياض - القاهرة لموسم الإجازات",
      services: "تذاكر طيران درجات مختلفة",
      suppliers_compared: [
        { name: "الخطوط السعودية", price: 25000, commission: "7%", terms: "سداد بعد 30 يوم" },
        { name: "مصر للطيران", price: 23500, commission: "5%", terms: "سداد فور الإصدار" },
        { name: "طيران طيران أديل", price: 21000, commission: "3%", terms: "نقداً" }
      ],
      recommended_supplier: "مصر للطيران (أفضل توازن بين السعر والعمولة والائتمان)",
      status: "مكتمل ومفاوض",
      created_at: "2026-09-02"
    },
    {
      id: 2,
      rfq_number: "RFQ-2026-102",
      title: "مقارنة أسعار كتل غرف فنادق المدينة المنورة لشهر رجب",
      services: "فنادق 5 نجوم المركزية",
      suppliers_compared: [
        { name: "فندق أنوار الموفنبيك", price: 60000, commission: "10%", terms: "دفعة مقدمة 20%" },
        { name: "فندق بولمان زمزم", price: 58000, commission: "8%", terms: "دفعة مقدمة 30%" }
      ],
      recommended_supplier: "فندق أنوار الموفنبيك",
      status: "جاري المفاضلة",
      created_at: "2026-09-05"
    }
  ]);

  const [rfqForm, setRfqForm] = useState({
    title: "",
    services: "تذاكر طيران وفنادق",
    supp1_name: "الخطوط السعودية",
    supp1_price: 20000,
    supp1_comm: "7%",
    supp2_name: "طيران ناس (Flynas)",
    supp2_price: 18500,
    supp2_comm: "5%",
    recommended_supplier: "طيران ناس (Flynas)",
    notes: ""
  });

  // 3. Purchase Orders State (أوامر الشراء POs)
  const [ordersList, setOrdersList] = useState<any[]>([
    {
      id: 1,
      po_number: "PO-2026-301",
      supplier_name: "شركة طيران ناس (Flynas)",
      service_category: "تذاكر طيران",
      total_cost: 32000,
      expected_selling_price: 39000,
      delivery_date: "2026-09-25",
      status: "صادر ومؤكد",
      notes: "أمر شراء تذاكر مجموعة العائلات إلى جدة",
      created_at: "2026-09-02"
    },
    {
      id: 2,
      po_number: "PO-2026-302",
      supplier_name: "فندق هيلتون مكة للمعارض",
      service_category: "حجوزات فنادق",
      total_cost: 50000,
      expected_selling_price: 62000,
      delivery_date: "2026-09-30",
      status: "معتمد ومرحل",
      notes: "أمر شراء كتل غرف لعمرة منتصف العام",
      created_at: "2026-09-04"
    }
  ]);

  const [orderForm, setOrderForm] = useState({
    supplier_name: "شركة الخطوط السعودية (Saudia)",
    service_category: "تذاكر طيران",
    total_cost: 15000,
    expected_selling_price: 19000,
    delivery_date: new Date().toISOString().slice(0, 10),
    notes: "أمر شراء خدمات وتذاكر"
  });

  // 4. Procurement Invoices State (فواتير المشتريات Invoices)
  const { data: serverInvoices = [], isLoading: isLoadingInvoices } = useQuery({
    queryKey: ["/api/travel/procurement/invoices"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/travel/procurement/invoices");
        if (res.ok) return await res.json();
      } catch (e) {}
      return [];
    }
  });

  // Combined Invoices State
  const [localInvoices, setLocalInvoices] = useState<any[]>([
    {
      id: 1,
      pi_number: "PI-2026-501",
      supplier_name: "شركة الخطوط السعودية (Saudia)",
      supplier_invoice_ref: "SDA-INV-8899",
      pi_date: "2026-09-04",
      payment_method: "bank",
      cost_subtotal: 10000,
      fees_subtotal: 0,
      selling_subtotal: 13000,
      net_profit: 3000,
      status: "مرحلة ومكتملة"
    },
    {
      id: 2,
      pi_number: "PI-2026-502",
      supplier_name: "شركة Bupa العربية للتأمين",
      supplier_invoice_ref: "BUPA-INS-4412",
      pi_date: "2026-09-05",
      payment_method: "cash",
      cost_subtotal: 8500,
      fees_subtotal: 500,
      selling_subtotal: 11000,
      net_profit: 2000,
      status: "مرحلة ومكتملة"
    }
  ]);

  const allProcurementInvoices = [...serverInvoices, ...localInvoices];

  // Invoice Items
  const [invSupplierName, setInvSupplierName] = useState("شركة الخطوط السعودية (Saudia)");
  const [supplierRef, setSupplierRef] = useState("SDA-INV-8899");
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [invNotes, setInvNotes] = useState("");
  const [items, setItems] = useState<any[]>([
    {
      service_type: "flight",
      description: "باقة 10 تذاكر طيران خط الرياض - دبي",
      cost_price: 10000,
      fees: 0,
      selling_price: 13000
    }
  ]);

  const addItem = () => {
    setItems([
      ...items,
      {
        service_type: "hotel",
        description: "شراء كتلة غرف فنادق مكة لشهر رمضان",
        cost_price: 15000,
        fees: 500,
        selling_price: 20000
      }
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const totalCost = (items || []).reduce((sum, i) => sum + Number(i.cost_price || 0), 0);
  const totalFees = (items || []).reduce((sum, i) => sum + Number(i.fees || 0), 0);
  const totalSelling = (items || []).reduce((sum, i) => sum + Number(i.selling_price || 0), 0);
  const expectedProfit = totalSelling - (totalCost + totalFees);

  // 5. Payments & Settlements State (سندات دفع الموردين)
  const [paymentsList, setPaymentsList] = useState<any[]>([
    {
      id: 1,
      pv_number: "PV-2026-701",
      supplier_name: "شركة الخطوط السعودية (Saudia)",
      amount: 15000,
      payment_method: "bank",
      safe_or_bank: "البنك الأهلي السعودي - حساب المشتريات",
      voucher_date: "2026-09-03",
      notes: "سداد دفعة آجل من فاتورة شراء تذاكر الرحلات الجوية",
      user_name: "المحاسب الرئيسي"
    },
    {
      id: 2,
      pv_number: "PV-2026-702",
      supplier_name: "سلسلة فنادق دار التوحيد مكة",
      amount: 25000,
      payment_method: "cash",
      safe_or_bank: "الصندوق الرئيسي - الخزينة",
      voucher_date: "2026-09-05",
      notes: "دفعة مقدمة تحت الحساب لتأكيد كتلة غرف العمرة",
      user_name: "أمين الصندوق"
    }
  ]);

  const [paymentForm, setPaymentForm] = useState({
    supplier_name: "شركة الخطوط السعودية (Saudia)",
    amount: 10000,
    payment_method: "bank",
    safe_or_bank: "البنك الأهلي السعودي",
    voucher_date: new Date().toISOString().slice(0, 10),
    notes: "سداد دفعة حساب للمورد"
  });

  // 6. Contracts State (عقود الموردين وتحليلات الأسعار)
  const [contractsList, setContractsList] = useState<any[]>([
    {
      id: 1,
      contract_number: "CNT-2026-801",
      supplier_name: "شركة الخطوط السعودية (Saudia GSA)",
      contract_type: "عقد وكالة وتجميع تذاكر",
      credit_limit: 500000,
      commission_rate: "7.5%",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      status: "ساري ونشط",
      terms: "الحصول على خصم عمولة 7.5% عند تجاوز مشتريات 1,000,000 ريال سنوياً"
    },
    {
      id: 2,
      contract_number: "CNT-2026-802",
      supplier_name: "مجموعة فنادق إعمار مكة والمدنية",
      contract_type: "عقد حجز كتل غرف Allotments",
      credit_limit: 300000,
      commission_rate: "12%",
      start_date: "2026-03-01",
      end_date: "2026-11-30",
      status: "ساري ونشط",
      terms: "تخصيص 30 غرفة يومية مع خيار الإلغاء قبل 72 ساعة بدون غرامة"
    }
  ]);

  const [contractForm, setContractForm] = useState({
    supplier_name: "شركة الخطوط السعودية (Saudia)",
    contract_type: "عقد وكالة خدمات سياحية",
    credit_limit: 250000,
    commission_rate: "8%",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    terms: "الشروط والأحكام الخاصة بالاتفاقية وتسهيلات السداد"
  });

  // ─────────────────────────────────────────────
  // Action Handlers & Full Screen Report Previews
  // ─────────────────────────────────────────────

  // Create Request Handler
  const handleSaveRequest = () => {
    const newPr = {
      id: Date.now(),
      pr_number: `PR-2026-${String(requestsList.length + 1).padStart(3, "0")}`,
      ...requestForm,
      status: "معتمد",
      created_at: new Date().toISOString().slice(0, 10)
    };
    setRequestsList([newPr, ...requestsList]);
    setOpenRequestModal(false);
    toast({ title: "نجاح", description: "تم إنشاء طلب الشراء الحجز بنجاح ✅" });
  };

  // Preview Request
  const handlePreviewRequest = (pr: any) => {
    const html = `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 30px; border: 2px solid #0d9488; border-radius: 12px; background: #fff;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0d9488; padding-bottom: 15px;">
          <div>
            <h1 style="margin: 0; color: #0f766e; font-size: 22px;">طلب شراء وحجز خدمات سياحية (PR)</h1>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 13px;">رقم الطلب: ${pr.pr_number}</p>
          </div>
          <div style="text-align: left;">
            <div style="font-weight: bold; font-size: 13px;">تاريخ الطلب: ${pr.created_at}</div>
            <div style="font-size: 12px; color: #64748b;">طالب الخدمة: ${pr.requested_by}</div>
          </div>
        </div>

        <div style="margin: 25px 0; font-size: 14px; line-height: 2; background: #f0fdf4; padding: 15px; border-radius: 8px;">
          <p><strong>المورد المقترح:</strong> ${pr.supplier_name}</p>
          <p><strong>فئة الخدمة:</strong> ${pr.service_category}</p>
          <p><strong>تفاصيل البيان المطلوبة:</strong> ${pr.description}</p>
          <p><strong>التكلفة التقديرية:</strong> <span style="font-size: 18px; font-weight: bold; color: #0f766e;">${fmt(pr.estimated_cost)} ريال سعودي</span></p>
          <p><strong>تاريخ التوريد المستهدف:</strong> ${pr.target_date}</p>
          <p><strong>حالة الاعتماد:</strong> <span style="font-weight: bold; color: #15803d;">${pr.status}</span></p>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 13px;">
          <div>
            <div>توقيع مقدم الطلب</div>
            <div style="margin-top: 35px;">.................................</div>
          </div>
          <div>
            <div>اعتماد مدير المشتريات</div>
            <div style="margin-top: 35px;">.................................</div>
          </div>
        </div>
      </div>
    `;
    setReportHtml(html);
    setReportTitle(`معاينة طلب شراء - ${pr.pr_number}`);
    setReportViewerOpen(true);
  };

  // Convert Request to PO
  const handleConvertPrToPo = (pr: any) => {
    const newPo = {
      id: Date.now(),
      po_number: `PO-2026-${String(ordersList.length + 1).padStart(3, "0")}`,
      supplier_name: pr.supplier_name,
      service_category: pr.service_category,
      total_cost: pr.estimated_cost,
      expected_selling_price: Math.round(pr.estimated_cost * 1.25),
      delivery_date: pr.target_date,
      status: "صادر ومؤكد",
      notes: `تم التوليد التلقائي من طلب الشراء ${pr.pr_number}`,
      created_at: new Date().toISOString().slice(0, 10)
    };
    setOrdersList([newPo, ...ordersList]);
    toast({ title: "تم التحويل", description: "تم تحويل طلب الشراء إلى أمر شراء رسمي (PO) بنجاح ✅" });
    handleTabChange("orders");
  };

  // Save RFQ
  const handleSaveRfq = () => {
    const newRfq = {
      id: Date.now(),
      rfq_number: `RFQ-2026-${String(rfqsList.length + 1).padStart(3, "0")}`,
      title: rfqForm.title || "مقارنة ومفاضلة أسعار موردين",
      services: rfqForm.services,
      suppliers_compared: [
        { name: rfqForm.supp1_name, price: Number(rfqForm.supp1_price), commission: rfqForm.supp1_comm, terms: "سداد بعد 15 يوم" },
        { name: rfqForm.supp2_name, price: Number(rfqForm.supp2_price), commission: rfqForm.supp2_comm, terms: "نقداً" }
      ],
      recommended_supplier: rfqForm.recommended_supplier,
      status: "مكتمل ومفاوض",
      created_at: new Date().toISOString().slice(0, 10)
    };
    setRfqsList([newRfq, ...rfqsList]);
    setOpenRfqModal(false);
    toast({ title: "نجاح", description: "تم حفظ مناقصة ومقارنة الأسعار بنجاح ✅" });
  };

  // Preview RFQ
  const handlePreviewRfq = (rfq: any) => {
    const suppRows = rfq.suppliers_compared?.map((s: any, idx: number) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-weight: bold;">${s.name}</td>
        <td style="font-family: monospace; font-weight: bold; color: #0d9488;">${fmt(s.price)} ريال</td>
        <td>${s.commission}</td>
        <td>${s.terms}</td>
      </tr>
    `).join("");

    const html = `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 25px; border: 2px solid #0f766e; border-radius: 12px; background: #fff;">
        <div style="text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 15px;">
          <h1 style="margin: 0; color: #0f766e;">جدول مقارنة ومفاضلة أسعار الموردين (RFQ)</h1>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">رقم الملف: ${rfq.rfq_number} | العنوان: ${rfq.title}</p>
        </div>

        <p><strong>نوع الخدمات المطلوب تدبيرها:</strong> ${rfq.services}</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; text-align: center;">
          <thead>
            <tr style="background-color: #ccfbf1; color: #0f766e;">
              <th>#</th>
              <th>اسم الشركة / المورد</th>
              <th>التكلفة المعروضة</th>
              <th>نسبة العمولة / الخصم</th>
              <th>تسهيلات شروط السداد</th>
            </tr>
          </thead>
          <tbody>
            ${suppRows}
          </tbody>
        </table>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <h3 style="margin: 0 0 5px; color: #15803d; font-size: 15px;">الخيار المرشح والتوصية النهائية:</h3>
          <p style="margin: 0; font-weight: bold; font-size: 14px; color: #166534;">${rfq.recommended_supplier}</p>
        </div>
      </div>
    `;
    setReportHtml(html);
    setReportTitle(`مقارنة أسعار الموردين - ${rfq.rfq_number}`);
    setReportViewerOpen(true);
  };

  // Save Purchase Order PO
  const handleSaveOrder = () => {
    const newPo = {
      id: Date.now(),
      po_number: `PO-2026-${String(ordersList.length + 1).padStart(3, "0")}`,
      ...orderForm,
      status: "صادر ومؤكد",
      created_at: new Date().toISOString().slice(0, 10)
    };
    setOrdersList([newPo, ...ordersList]);
    setOpenOrderModal(false);
    toast({ title: "نجاح", description: "تم إصدار أمر الشراء PO بنجاح ✅" });
  };

  // Preview Purchase Order PO
  const handlePreviewOrder = (po: any) => {
    const html = `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 30px; border: 2px solid #0f766e; border-radius: 12px; background: #fff;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 15px;">
          <div>
            <h1 style="margin: 0; color: #0f766e; font-size: 22px;">أمر شراء خدمات وتذاكر رسمي (Purchase Order)</h1>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 13px;">رقم أمر الشراء: ${po.po_number}</p>
          </div>
          <div style="text-align: left;">
            <div style="font-weight: bold; font-size: 13px;">تاريخ الإصدار: ${po.created_at}</div>
            <div style="font-size: 12px; color: #64748b;">تاريخ التسليم المتوقع: ${po.delivery_date}</div>
          </div>
        </div>

        <div style="margin: 20px 0; font-size: 13px; line-height: 2;">
          <p><strong>المورد / الوكيل الموجه إليه:</strong> ${po.supplier_name}</p>
          <p><strong>تصنيف الخدمة:</strong> ${po.service_category}</p>
          <p><strong>ملاحظات وشروط أمر الشراء:</strong> ${po.notes || "لا توجد ملاحظات إضافية"}</p>
        </div>

        <table>
          <thead>
            <tr style="background: #f1f5f9;">
              <th>#</th>
              <th>البيان والتفاصيل</th>
              <th>التكلفة الكلية المقدرة</th>
              <th>المبيعات المستهدفة</th>
              <th>الربح المتوقع</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>توريد ${po.service_category} حسب المواصفات المتفق عليها</td>
              <td style="font-family: monospace; font-weight: bold; color: #0d9488;">${fmt(po.total_cost)} ريال</td>
              <td style="font-family: monospace; font-weight: bold; color: #15803d;">${fmt(po.expected_selling_price)} ريال</td>
              <td style="font-family: monospace; font-weight: bold; color: #1d4ed8;">+${fmt(po.expected_selling_price - po.total_cost)} ريال</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 13px;">
          <div>
            <div>توقيع مسؤول المشتريات</div>
            <div style="margin-top: 35px;">.................................</div>
          </div>
          <div>
            <div>موافقة وتعميد المورد</div>
            <div style="margin-top: 35px;">.................................</div>
          </div>
        </div>
      </div>
    `;
    setReportHtml(html);
    setReportTitle(`معاينة أمر الشراء - ${po.po_number}`);
    setReportViewerOpen(true);
  };

  // Save Procurement Invoice
  const handleSaveProcurementInvoice = async () => {
    const newPi = {
      id: Date.now(),
      pi_number: `PI-2026-${String(localInvoices.length + 503).padStart(3, "0")}`,
      supplier_name: invSupplierName,
      supplier_invoice_ref: supplierRef,
      pi_date: new Date().toISOString().slice(0, 10),
      payment_method: paymentMethod,
      cost_subtotal: totalCost,
      fees_subtotal: totalFees,
      selling_subtotal: totalSelling,
      net_profit: expectedProfit,
      status: "مرحلة ومكتملة"
    };
    setLocalInvoices([newPi, ...localInvoices]);
    setOpenInvoiceModal(false);
    toast({ title: "نجاح", description: "تم اعتماد وتأكيد فاتورة المشتريات وتحديث شجرة الحسابات ✅" });
  };

  // Preview Procurement Invoice
  const handlePreviewProcurementInvoice = (pi: any) => {
    const html = `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 30px; border: 2px solid #0d9488; border-radius: 12px; background: #fff;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0d9488; padding-bottom: 15px;">
          <div>
            <h1 style="margin: 0; color: #0d9488; font-size: 22px;">فاتورة مشتريات خدمات وتذاكر سياحية</h1>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 13px;">رقم فاتورة المشتريات: ${pi.pi_number}</p>
          </div>
          <div style="text-align: left;">
            <div style="font-weight: bold; font-size: 13px;">تاريخ الفاتورة: ${pi.pi_date}</div>
            <div style="font-size: 12px; color: #64748b;">طريقة السداد: ${pi.payment_method === 'bank' ? 'تحويل بنكي' : 'نقداً'}</div>
          </div>
        </div>

        <div style="margin: 20px 0; font-size: 13px; line-height: 2; background: #f8fafc; padding: 12px; border-radius: 8px;">
          <p><strong>المورد / الوكيل:</strong> ${pi.supplier_name}</p>
          <p><strong>مرجع فاتورة المورد:</strong> ${pi.supplier_invoice_ref || "غ/م"}</p>
          <p><strong>حالة القيد المحاسبي:</strong> <span style="font-weight: bold; color: #166534;">${pi.status || 'مكتمل ومرحل'}</span></p>
        </div>

        <table>
          <thead>
            <tr style="background: #ccfbf1; color: #0f766e;">
              <th>إجمالي التكلفة الشراء</th>
              <th>رسوم وإضافات</th>
              <th>المبيعات المخططة</th>
              <th>صافي الربح المتوقع</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-family: monospace; font-weight: bold; font-size: 15px; color: #0f766e;">${fmt(pi.cost_subtotal)} ريال</td>
              <td style="font-family: monospace; font-weight: bold; font-size: 15px;">${fmt(pi.fees_subtotal)} ريال</td>
              <td style="font-family: monospace; font-weight: bold; font-size: 15px; color: #15803d;">${fmt(pi.selling_subtotal)} ريال</td>
              <td style="font-family: monospace; font-weight: bold; font-size: 15px; color: #1d4ed8;">+${fmt(pi.net_profit)} ريال</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 13px;">
          <div>
            <div>المحاسب المسؤول</div>
            <div style="margin-top: 35px;">.................................</div>
          </div>
          <div>
            <div>ختم الشركة واعتماد المدير</div>
            <div style="margin-top: 35px;">.................................</div>
          </div>
        </div>
      </div>
    `;
    setReportHtml(html);
    setReportTitle(`معاينة فاتورة مشتريات - ${pi.pi_number}`);
    setReportViewerOpen(true);
  };

  // Save Payment Voucher
  const handleSavePayment = () => {
    const newPv = {
      id: Date.now(),
      pv_number: `PV-2026-${String(paymentsList.length + 1).padStart(3, "0")}`,
      ...paymentForm,
      user_name: "المحاسب المسؤول"
    };
    setPaymentsList([newPv, ...paymentsList]);
    setOpenPaymentModal(false);
    toast({ title: "تم الصرف", description: "تم إصدار سند دفع للمورد وترحيل القيد بنجاح ✅" });
  };

  // Preview Payment Voucher
  const handlePreviewPayment = (pv: any) => {
    const html = `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 30px; border: 2px solid #b45309; border-radius: 12px; background: #fff;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #b45309; padding-bottom: 15px;">
          <div>
            <h1 style="margin: 0; color: #b45309; font-size: 22px;">سند صرف دفعات للمورد (Payment Voucher)</h1>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 13px;">رقم السند: ${pv.pv_number}</p>
          </div>
          <div style="text-align: left;">
            <div style="font-weight: bold; font-size: 13px;">تاريخ السداد: ${pv.voucher_date}</div>
            <div style="font-size: 12px; color: #64748b;">الجهة المصدرة: ${pv.safe_or_bank || 'الخزينة/البنك'}</div>
          </div>
        </div>

        <div style="margin: 25px 0; font-size: 14px; line-height: 2;">
          <p><strong>اسم المورد / الوكيل المستلم:</strong> ${pv.supplier_name}</p>
          <p><strong>مبلغ السداد المصروف:</strong> <span style="font-size: 20px; font-weight: bold; color: #b45309;">${fmt(pv.amount)} ريال سعودي</span></p>
          <p><strong>طريقة الوسيلة المالية:</strong> ${pv.payment_method === 'bank' ? 'تحويل بنكي' : 'نقداً من الخزينة'}</p>
          <p><strong>البيان والسبب:</strong> ${pv.notes || 'سداد المستحقات والالتزامات المترتبة'}</p>
          <p><strong>الموظف المسجل:</strong> ${pv.user_name}</p>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 13px;">
          <div>
            <div>توقيع المحاسب / الخزينة</div>
            <div style="margin-top: 35px;">.................................</div>
          </div>
          <div>
            <div>توقيع المورد / المستلم</div>
            <div style="margin-top: 35px;">.................................</div>
          </div>
        </div>
      </div>
    `;
    setReportHtml(html);
    setReportTitle(`سند صرف دفعة مورد - ${pv.pv_number}`);
    setReportViewerOpen(true);
  };

  // Save Contract
  const handleSaveContract = () => {
    const newContract = {
      id: Date.now(),
      contract_number: `CNT-2026-${String(contractsList.length + 1).padStart(3, "0")}`,
      ...contractForm,
      status: "ساري ونشط"
    };
    setContractsList([newContract, ...contractsList]);
    setOpenContractModal(false);
    toast({ title: "نجاح", description: "تم تسجيل وتفعيل عقد المورد بنجاح ✅" });
  };

  // Preview Contract
  const handlePreviewContract = (cnt: any) => {
    const html = `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 30px; border: 2px solid #0f766e; border-radius: 12px; background: #fff;">
        <div style="text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="margin: 0; color: #0f766e;">اتفاقية وعقد توريد خدمات سياحية</h1>
          <p style="margin: 5px 0 0; color: #64748b; font-size: 13px;">رقم العقد: ${cnt.contract_number} | الحالة: ${cnt.status}</p>
        </div>

        <div style="line-height: 2; font-size: 13px;">
          <p><strong>طرف الاتفاقية (المورد/الوكيل):</strong> ${cnt.supplier_name}</p>
          <p><strong>نوع الاتفاقية والعقد:</strong> ${cnt.contract_type}</p>
          <p><strong>فترة سريان العقد:</strong> من ${cnt.start_date} إلى ${cnt.end_date}</p>
          <p><strong>سقف حد الائتمان المالي (Credit Limit):</strong> <span style="font-weight: bold; font-size: 16px; color: #0f766e;">${fmt(cnt.credit_limit)} ريال سعودي</span></p>
          <p><strong>نسبة التخفيض / العمولة المكتسبة:</strong> <span style="font-weight: bold; color: #15803d;">${cnt.commission_rate}</span></p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <h4 style="margin: 0 0 10px; color: #1e293b;">شروط وأحكام الاتفاقية:</h4>
            <p style="margin: 0; color: #334155;">${cnt.terms}</p>
          </div>
        </div>

        <div style="margin-top: 50px; display: flex; justify-content: space-between; text-align: center; font-size: 13px;">
          <div>
            <div>الطرف الأول (إدارة الوكالة)</div>
            <div style="margin-top: 35px;">.................................</div>
          </div>
          <div>
            <div>الطرف الثاني (المورد / الوكيل)</div>
            <div style="margin-top: 35px;">.................................</div>
          </div>
        </div>
      </div>
    `;
    setReportHtml(html);
    setReportTitle(`عقد مورد - ${cnt.contract_number}`);
    setReportViewerOpen(true);
  };

  // Preview Tourism Procurement Report
  const handlePreviewProcurementReport = () => {
    const totalInvoicesCost = allProcurementInvoices.reduce((sum, pi) => sum + Number(pi.cost_subtotal || 0), 0);
    const totalInvoicesProfit = allProcurementInvoices.reduce((sum, pi) => sum + Number(pi.net_profit || 0), 0);
    const totalPaidSuppliers = paymentsList.reduce((sum, pv) => sum + Number(pv.amount || 0), 0);

    const rowsHtml = allProcurementInvoices.map((pi, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;">${pi.pi_number}</td>
        <td>${pi.supplier_name}</td>
        <td>${pi.pi_date}</td>
        <td style="font-family: monospace; font-weight: bold; color: #0f766e;">${fmt(pi.cost_subtotal)} ريال</td>
        <td style="font-family: monospace; font-weight: bold; color: #15803d;">${fmt(pi.selling_subtotal)} ريال</td>
        <td style="font-family: monospace; font-weight: bold; color: #1d4ed8;">+${fmt(pi.net_profit)} ريال</td>
      </tr>
    `).join("");

    const html = `
      <div style="direction: rtl; font-family: Tajawal, sans-serif; padding: 25px;">
        <div style="text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 15px;">
          <h1 style="margin: 0; color: #0f766e;">تقرير المشتريات والخدمات السياحية التحليلي الشامل</h1>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; text-align: center;">
          <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; border: 1px solid #bbf7d0;">
            <div style="font-size: 12px; color: #166534;">إجمالي حجم المشتريات</div>
            <div style="font-size: 18px; font-weight: bold; color: #15803d; font-family: monospace;">${fmt(totalInvoicesCost)} ريال</div>
          </div>
          <div style="background: #fef3c7; padding: 12px; border-radius: 8px; border: 1px solid #fde68a;">
            <div style="font-size: 12px; color: #92400e;">إجمالي المدفوعات السديدة</div>
            <div style="font-size: 18px; font-weight: bold; color: #b45309; font-family: monospace;">${fmt(totalPaidSuppliers)} ريال</div>
          </div>
          <div style="background: #eff6ff; padding: 12px; border-radius: 8px; border: 1px solid #bfdbfe;">
            <div style="font-size: 12px; color: #1e40af;">الأرباح المحققة من المشتريات</div>
            <div style="font-size: 18px; font-weight: bold; color: #1d4ed8; font-family: monospace;">+${fmt(totalInvoicesProfit)} ريال</div>
          </div>
        </div>

        <table>
          <thead>
            <tr style="background: #ccfbf1; color: #0f766e;">
              <th>#</th>
              <th>رقم الفاتورة</th>
              <th>المورد والشركة</th>
              <th>تاريخ التوريد</th>
              <th>تكلفة الشراء</th>
              <th>المبيعات المستهدفة</th>
              <th>صافي الربح</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || "<tr><td colSpan='7'>لا توجد فواتير مشتريات مسجلة</td></tr>"}
          </tbody>
        </table>
      </div>
    `;
    setReportHtml(html);
    setReportTitle("تقرير المشتريات السياحية الشامل والتحليلي");
    setReportViewerOpen(true);
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans" dir="rtl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-8 h-8 text-teal-600" />
              <h1 className="text-2xl font-bold text-slate-800">إدارة مشتريات الخدمات والموردين (Procurement Hub)</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              منظومة الشراء المتكاملة: طلبات الشراء، المناقصات، أوامر الشراء (PO)، فواتير المشتريات، سندات الدفع، والعقود
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleTabChange("requests")}
              variant={activeTab === "requests" ? "default" : "outline"}
              className={activeTab === "requests" ? "bg-teal-600 hover:bg-teal-700 text-white font-bold" : ""}
            >
              <ClipboardList className="w-4 h-4 ml-1" /> طلبات الشراء
            </Button>
            <Button
              onClick={() => handleTabChange("orders")}
              variant={activeTab === "orders" ? "default" : "outline"}
              className={activeTab === "orders" ? "bg-teal-600 hover:bg-teal-700 text-white font-bold" : ""}
            >
              <ShoppingBag className="w-4 h-4 ml-1" /> أوامر الشراء (PO)
            </Button>
            <Button
              onClick={() => handleTabChange("invoices")}
              variant={activeTab === "invoices" ? "default" : "outline"}
              className={activeTab === "invoices" ? "bg-teal-600 hover:bg-teal-700 text-white font-bold" : ""}
            >
              <Plus className="w-4 h-4 ml-1" /> فاتورة مشتريات جديدة
            </Button>
          </div>
        </div>

        {/* Interactive Navigation Tabs Row */}
        <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap gap-1 border border-slate-200">
          <button
            onClick={() => handleTabChange("requests")}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "requests"
                ? "bg-white text-teal-700 shadow-sm border border-teal-200"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            <ClipboardList className="w-4 h-4 text-teal-600" />
            طلبات الشراء (PR)
          </button>

          <button
            onClick={() => handleTabChange("rfqs")}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "rfqs"
                ? "bg-white text-teal-700 shadow-sm border border-teal-200"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            <FileCheck className="w-4 h-4 text-teal-600" />
            عروض وأسعار الموردين
          </button>

          <button
            onClick={() => handleTabChange("orders")}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "orders"
                ? "bg-white text-teal-700 shadow-sm border border-teal-200"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-teal-600" />
            أوامر الشراء (PO)
          </button>

          <button
            onClick={() => handleTabChange("invoices")}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "invoices"
                ? "bg-white text-teal-700 shadow-sm border border-teal-200"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            <FileText className="w-4 h-4 text-teal-600" />
            فواتير المشتريات (PI)
          </button>

          <button
            onClick={() => handleTabChange("payments")}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "payments"
                ? "bg-white text-amber-700 shadow-sm border border-amber-200"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            <Wallet className="w-4 h-4 text-amber-600" />
            سندات دفع الموردين
          </button>

          <button
            onClick={() => handleTabChange("contracts")}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "contracts"
                ? "bg-white text-indigo-700 shadow-sm border border-indigo-200"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            عقود الموردين
          </button>

          <button
            onClick={() => handleTabChange("reports")}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "reports"
                ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-blue-600" />
            تقارير المشتريات
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between gap-4 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم الفاتورة، اسم المورد، التكلفة، رقم الطلب..."
              className="pr-9"
            />
          </div>
          {activeTab === "reports" && (
            <Button onClick={handlePreviewProcurementReport} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5">
              <Eye className="w-4 h-4" /> استعراض التقرير قبل الطباعة
            </Button>
          )}
        </div>

        {/* ─────────────────────────────────────────────
            TAB 1: REQUESTS (طلبات شراء وحجز الخدمات)
        ───────────────────────────────────────────── */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border">
              <div>
                <h3 className="font-bold text-slate-800 text-base">طلبات شراء وحجز الخدمات السياحية (Purchase Requests)</h3>
                <p className="text-xs text-slate-500">سجل طلبات الاحتياج والتوريد المقدمة من الأقسام المبيعات والحجوزات</p>
              </div>
              <Button onClick={() => setOpenRequestModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1.5">
                <Plus className="w-4 h-4" /> طلب شراء جديد
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b">
                  <tr>
                    <th className="p-3.5">رقم الطلب</th>
                    <th className="p-3.5">المورد والبيان</th>
                    <th className="p-3.5">التكلفة التقديرية</th>
                    <th className="p-3.5">طالب الخدمة</th>
                    <th className="p-3.5">تاريخ التوريد</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requestsList.length === 0 ? (
                    <tr><td colSpan={7} className="text-center p-8 text-slate-400">لا توجد طلبات شراء مسجلة</td></tr>
                  ) : (
                    requestsList.map((pr) => (
                      <tr key={pr.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-mono font-bold text-teal-700">{pr.pr_number}</td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-800">{pr.supplier_name}</div>
                          <div className="text-xs text-slate-500">{pr.description}</div>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-800">{fmt(pr.estimated_cost)} ريال</td>
                        <td className="p-3.5 text-xs text-slate-600">{pr.requested_by}</td>
                        <td className="p-3.5 text-xs text-slate-600">{pr.target_date}</td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-bold">
                            {pr.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold gap-1"
                              onClick={() => handlePreviewRequest(pr)}
                            >
                              <Eye className="w-3.5 h-3.5" /> استعراض
                            </Button>
                            <Button
                              size="sm"
                              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1"
                              onClick={() => handleConvertPrToPo(pr)}
                            >
                              <ShoppingBag className="w-3.5 h-3.5" /> أمر شراء (PO)
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            TAB 2: RFQS (عروض أسعار الموردين والمقارنة)
        ───────────────────────────────────────────── */}
        {activeTab === "rfqs" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border">
              <div>
                <h3 className="font-bold text-slate-800 text-base">عروض أسعار الموردين والمقارنة (RFQs & Price Comparison)</h3>
                <p className="text-xs text-slate-500">جدول المفاضلة والمقارنة بين عروض شركات الطيران وسلاسل الفنادق اختيار العرض الأنسب</p>
              </div>
              <Button onClick={() => setOpenRfqModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1.5">
                <Plus className="w-4 h-4" /> إنشاء مناقصة ومقارنة جديدة
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b">
                  <tr>
                    <th className="p-3.5">رقم الملف</th>
                    <th className="p-3.5">عنوان المناقصة والمقارنة</th>
                    <th className="p-3.5">عدد الموردين المقارنين</th>
                    <th className="p-3.5">التوصية والمرشح الأفضل</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rfqsList.map((rfq) => (
                    <tr key={rfq.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono font-bold text-teal-700">{rfq.rfq_number}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">{rfq.title}</div>
                        <div className="text-xs text-slate-500">{rfq.services}</div>
                      </td>
                      <td className="p-3.5 font-bold text-slate-700">{rfq.suppliers_compared?.length || 2} شركات</td>
                      <td className="p-3.5 text-xs font-bold text-emerald-700">{rfq.recommended_supplier}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                          {rfq.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold gap-1"
                          onClick={() => handlePreviewRfq(rfq)}
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-600" /> استعراض مقارنة الأسعار قبل الطباعة
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            TAB 3: ORDERS (أوامر شراء الخدمات POs)
        ───────────────────────────────────────────── */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border">
              <div>
                <h3 className="font-bold text-slate-800 text-base">أوامر شراء الخدمات والتذاكر (Purchase Orders - PO)</h3>
                <p className="text-xs text-slate-500">أوامر الشراء الرسمية الموجهة للموردين والوكلاء مع تتبع التسليم</p>
              </div>
              <Button onClick={() => setOpenOrderModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1.5">
                <Plus className="w-4 h-4" /> أمر شراء جديد (PO)
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b">
                  <tr>
                    <th className="p-3.5">رقم أمر الشراء</th>
                    <th className="p-3.5">المورد والخدمة</th>
                    <th className="p-3.5">التكلفة الشاملة</th>
                    <th className="p-3.5">المبيعات المتوقعة</th>
                    <th className="p-3.5">الربح التقديري</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ordersList.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono font-bold text-teal-700">{po.po_number}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">{po.supplier_name}</div>
                        <div className="text-xs text-slate-500">{po.service_category}</div>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-800">{fmt(po.total_cost)} ريال</td>
                      <td className="p-3.5 font-mono font-bold text-emerald-700">{fmt(po.expected_selling_price)} ريال</td>
                      <td className="p-3.5 font-mono font-bold text-blue-700">+{fmt(po.expected_selling_price - po.total_cost)} ريال</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">
                          {po.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold gap-1"
                            onClick={() => handlePreviewOrder(po)}
                          >
                            <Eye className="w-3.5 h-3.5" /> استعراض
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1"
                            onClick={() => {
                              setInvSupplierName(po.supplier_name);
                              setOpenInvoiceModal(true);
                            }}
                          >
                            <FileText className="w-3.5 h-3.5" /> إصدار فاتورة
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            TAB 4: INVOICES (فواتير المشتريات Invoices)
        ───────────────────────────────────────────── */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border">
              <div>
                <h3 className="font-bold text-slate-800 text-base">فواتير مشتريات الخدمات والتذاكر (Procurement Invoices)</h3>
                <p className="text-xs text-slate-500">إدخال الفواتير الرسمية من الموردين وتوزيع القيود المحاسبية والأرباح تلقائياً</p>
              </div>
              <Button onClick={() => setOpenInvoiceModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1.5">
                <Plus className="w-4 h-4" /> فاتورة مشتريات جديدة
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b">
                  <tr>
                    <th className="p-3.5">رقم فاتورة المشتريات</th>
                    <th className="p-3.5">المورد والتاريخ</th>
                    <th className="p-3.5">طريقة السداد</th>
                    <th className="p-3.5">إجمالي التكلفة</th>
                    <th className="p-3.5">المبيعات المتوقعة</th>
                    <th className="p-3.5">الربح الصافي</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingInvoices ? (
                    <tr><td colSpan={8} className="text-center p-8 text-slate-400">جاري تحميل فواتير المشتريات...</td></tr>
                  ) : allProcurementInvoices.length === 0 ? (
                    <tr><td colSpan={8} className="text-center p-8 text-slate-400">لا توجد فواتير مشتريات مسجلة بعد</td></tr>
                  ) : (
                    allProcurementInvoices.map((pi: any) => (
                      <tr key={pi.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-mono font-bold text-teal-700">{pi.pi_number}</td>
                        <td className="p-3.5 text-xs">
                          <div className="font-bold text-slate-800">{pi.supplier_name}</div>
                          <div className="text-slate-500">{pi.pi_date}</div>
                        </td>
                        <td className="p-3.5 text-xs font-bold text-slate-700">{pi.payment_method === 'bank' ? 'تحويل بنكي' : 'نقداً'}</td>
                        <td className="p-3.5 text-xs font-bold text-slate-800 font-mono">
                          {fmt(pi.cost_subtotal + (pi.fees_subtotal || 0))} ريال
                        </td>
                        <td className="p-3.5 text-xs font-bold text-emerald-700 font-mono">
                          {fmt(pi.selling_subtotal)} ريال
                        </td>
                        <td className="p-3.5 text-xs font-bold text-blue-700 font-mono">
                          +{fmt(pi.net_profit)} ريال
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">
                            مرحلة ومكتملة ✅
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold gap-1"
                            onClick={() => handlePreviewProcurementInvoice(pi)}
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" /> استعراض قبل الطباعة
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            TAB 5: PAYMENTS (سندات دفع الموردين والتسويات)
        ───────────────────────────────────────────── */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border">
              <div>
                <h3 className="font-bold text-slate-800 text-base">سندات دفع الموردين والتسويات (Supplier Payments)</h3>
                <p className="text-xs text-slate-500">إدارة سندات الصرف والتحويلات البنكية والنقدية المدفوعة للوكلاء والموردين</p>
              </div>
              <Button onClick={() => setOpenPaymentModal(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5">
                <Plus className="w-4 h-4" /> سند دفع جديد للمورد
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b">
                  <tr>
                    <th className="p-3.5">رقم السند</th>
                    <th className="p-3.5">المورد المستلم</th>
                    <th className="p-3.5">الخزينة / البنك</th>
                    <th className="p-3.5">مبلغ السداد</th>
                    <th className="p-3.5">التاريخ</th>
                    <th className="p-3.5">البيان</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paymentsList.map((pv) => (
                    <tr key={pv.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono font-bold text-amber-800">{pv.pv_number}</td>
                      <td className="p-3.5 font-bold text-slate-800">{pv.supplier_name}</td>
                      <td className="p-3.5 text-xs text-slate-600">{pv.safe_or_bank}</td>
                      <td className="p-3.5 font-mono font-bold text-amber-800">{fmt(pv.amount)} ريال</td>
                      <td className="p-3.5 text-xs text-slate-600">{pv.voucher_date}</td>
                      <td className="p-3.5 text-xs text-slate-500">{pv.notes}</td>
                      <td className="p-3.5 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-amber-200 text-amber-800 hover:bg-amber-50 font-bold gap-1"
                          onClick={() => handlePreviewPayment(pv)}
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-700" /> استعراض السند قبل الطباعة
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            TAB 6: CONTRACTS (عقود الموردين)
        ───────────────────────────────────────────── */}
        {activeTab === "contracts" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border">
              <div>
                <h3 className="font-bold text-slate-800 text-base">عقود الموردين والوكلاء وتسهيلات الائتمان (Contracts & SLAs)</h3>
                <p className="text-xs text-slate-500">إدارة اتفاقيات التوريد والسقف الائتماني ونسب العمولة المكتسبة من شركات الطيران والفنادق</p>
              </div>
              <Button onClick={() => setOpenContractModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5">
                <Plus className="w-4 h-4" /> تسجيل عقد مورد جديد
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contractsList.map((cnt) => (
                <div key={cnt.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">{cnt.contract_number}</span>
                      <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-bold">{cnt.status}</span>
                    </div>

                    <h4 className="font-bold text-slate-800 text-lg">{cnt.supplier_name}</h4>
                    <p className="text-xs text-slate-500">{cnt.contract_type}</p>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl text-xs font-sans">
                      <div>
                        <div className="text-slate-500">سقف الائتمان:</div>
                        <div className="font-bold text-indigo-700 font-mono">{fmt(cnt.credit_limit)} ريال</div>
                      </div>
                      <div>
                        <div className="text-slate-500">نسبة العمولة:</div>
                        <div className="font-bold text-emerald-700">{cnt.commission_rate}</div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600">
                      <strong>الفترة:</strong> من {cnt.start_date} إلى {cnt.end_date}
                    </div>
                  </div>

                  <div className="pt-3 border-t flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold gap-1"
                      onClick={() => handlePreviewContract(cnt)}
                    >
                      <Eye className="w-3.5 h-3.5" /> استعراض العقد قبل الطباعة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            TAB 7: REPORTS (تقارير المشتريات)
        ───────────────────────────────────────────── */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                <div className="text-xs text-slate-500 font-bold">إجمالي المشتريات</div>
                <div className="text-2xl font-bold text-teal-700 font-mono mt-1">
                  {fmt(allProcurementInvoices.reduce((sum, pi) => sum + Number(pi.cost_subtotal || 0), 0))} ريال
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                <div className="text-xs text-slate-500 font-bold">إجمالي المدفوعات للموردين</div>
                <div className="text-2xl font-bold text-amber-700 font-mono mt-1">
                  {fmt(paymentsList.reduce((sum, pv) => sum + Number(pv.amount || 0), 0))} ريال
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                <div className="text-xs text-slate-500 font-bold">الأرباح التقديرية من الشراء</div>
                <div className="text-2xl font-bold text-blue-700 font-mono mt-1">
                  +{fmt(allProcurementInvoices.reduce((sum, pi) => sum + Number(pi.net_profit || 0), 0))} ريال
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border shadow-sm">
                <div className="text-xs text-slate-500 font-bold">عدد فواتير المشتريات</div>
                <div className="text-2xl font-bold text-slate-800 font-mono mt-1">
                  {allProcurementInvoices.length} فاتورة
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border shadow-sm text-center space-y-4">
              <BarChart3 className="w-12 h-12 text-teal-600 mx-auto" />
              <h3 className="font-bold text-lg text-slate-800">استعراض التقرير التحليلي الشامل للمشتريات السياحية</h3>
              <p className="text-sm text-slate-500 max-w-lg mx-auto">
                يمكنك الآن معاينة التقرير الشامل للمشتريات بما في ذلك تحليلات التكلفة والأرباح وعقود الموردين بشاشة كاملة قبل الطباعة
              </p>
              <Button onClick={handlePreviewProcurementReport} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2">
                <Eye className="w-5 h-5" /> استعراض التقرير الشامل قبل الطباعة
              </Button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────
            FULL-SCREEN MODAL 1: CREATE REQUEST (PR)
        ───────────────────────────────────────────── */}
        <Dialog open={openRequestModal} onOpenChange={setOpenRequestModal}>
          <DialogContent className="max-w-[100vw] w-screen h-screen max-h-screen m-0 rounded-none p-6 bg-white flex flex-col justify-between font-sans overflow-y-auto" dir="rtl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-bold text-teal-800 flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-teal-600" /> إنشـاء طلب شراء وتدبير خدمات سياحية جديد (Purchase Request)
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6 text-sm">
              <div className="space-y-1">
                <Label className="font-bold">المورد المقترح *</Label>
                <Input value={requestForm.supplier_name} onChange={(e) => setRequestForm({ ...requestForm, supplier_name: e.target.value })} placeholder="اسم الشركة الموردة" />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">تصنيف الخدمة</Label>
                <Select value={requestForm.service_category} onValueChange={(v) => setRequestForm({ ...requestForm, service_category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="تذاكر طيران">تذاكر طيران</SelectItem>
                    <SelectItem value="غرف واجنيح فنادق">غرف وإقامات فنادق</SelectItem>
                    <SelectItem value="نقل بري ولوجستيات">نقل بري ولوجستيات</SelectItem>
                    <SelectItem value="معاملات تأشيرات">معاملات تأشيرات</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="font-bold">بيان الخدمة المطلوبة بالتفصيل *</Label>
                <Textarea value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} placeholder="اكتب تفاصيل التذاكر أو كتل الغرف المطلوبة..." className="h-24" />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">التكلفة التقديرية (ريال سعودي) *</Label>
                <Input type="number" value={requestForm.estimated_cost} onChange={(e) => setRequestForm({ ...requestForm, estimated_cost: Number(e.target.value) })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">تاريخ التوريد المستهدف</Label>
                <Input type="date" value={requestForm.target_date} onChange={(e) => setRequestForm({ ...requestForm, target_date: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">القسم الطالب للخدمة</Label>
                <Input value={requestForm.requested_by} onChange={(e) => setRequestForm({ ...requestForm, requested_by: e.target.value })} />
              </div>
            </div>

            <DialogFooter className="border-t pt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenRequestModal(false)}>إلغاء</Button>
              <Button onClick={handleSaveRequest} className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-8">
                حفظ وإرسال طلب الشراء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────
            FULL-SCREEN MODAL 2: CREATE RFQ / PRICE COMPARISON
        ───────────────────────────────────────────── */}
        <Dialog open={openRfqModal} onOpenChange={setOpenRfqModal}>
          <DialogContent className="max-w-[100vw] w-screen h-screen max-h-screen m-0 rounded-none p-6 bg-white flex flex-col justify-between font-sans overflow-y-auto" dir="rtl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-bold text-teal-800 flex items-center gap-2">
                <FileCheck className="w-6 h-6 text-teal-600" /> إعداد جدول مفاضلة ومقارنة أسعار موردين (RFQ Price Comparison)
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 my-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="font-bold">عنوان المناقصة والمقارنة *</Label>
                  <Input value={rfqForm.title} onChange={(e) => setRfqForm({ ...rfqForm, title: e.target.value })} placeholder="مثال: مقارنة أسعار تذاكر موسم الصيف" />
                </div>
                <div className="space-y-1">
                  <Label className="font-bold">بيان الخدمات المشتراة</Label>
                  <Input value={rfqForm.services} onChange={(e) => setRfqForm({ ...rfqForm, services: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border p-4 rounded-xl bg-slate-50">
                <div className="space-y-2 border-l pl-4">
                  <h4 className="font-bold text-teal-800">عرض المورد الأول:</h4>
                  <Input value={rfqForm.supp1_name} onChange={(e) => setRfqForm({ ...rfqForm, supp1_name: e.target.value })} placeholder="اسم المورد 1" />
                  <Input type="number" value={rfqForm.supp1_price} onChange={(e) => setRfqForm({ ...rfqForm, supp1_price: Number(e.target.value) })} placeholder="السعر" />
                  <Input value={rfqForm.supp1_comm} onChange={(e) => setRfqForm({ ...rfqForm, supp1_comm: e.target.value })} placeholder="العمولة" />
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-teal-800">عرض المورد الثاني:</h4>
                  <Input value={rfqForm.supp2_name} onChange={(e) => setRfqForm({ ...rfqForm, supp2_name: e.target.value })} placeholder="اسم المورد 2" />
                  <Input type="number" value={rfqForm.supp2_price} onChange={(e) => setRfqForm({ ...rfqForm, supp2_price: Number(e.target.value) })} placeholder="السعر" />
                  <Input value={rfqForm.supp2_comm} onChange={(e) => setRfqForm({ ...rfqForm, supp2_comm: e.target.value })} placeholder="العمولة" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="font-bold">المرشح والتوصية النهائية *</Label>
                <Input value={rfqForm.recommended_supplier} onChange={(e) => setRfqForm({ ...rfqForm, recommended_supplier: e.target.value })} />
              </div>
            </div>

            <DialogFooter className="border-t pt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenRfqModal(false)}>إلغاء</Button>
              <Button onClick={handleSaveRfq} className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-8">
                حفظ واعتماد جدول المقارنة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────
            FULL-SCREEN MODAL 3: CREATE PURCHASE ORDER (PO)
        ───────────────────────────────────────────── */}
        <Dialog open={openOrderModal} onOpenChange={setOpenOrderModal}>
          <DialogContent className="max-w-[100vw] w-screen h-screen max-h-screen m-0 rounded-none p-6 bg-white flex flex-col justify-between font-sans overflow-y-auto" dir="rtl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-bold text-teal-800 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-teal-600" /> إصـدار أمر شراء خدمات وتذاكر جديد (Purchase Order)
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 my-4 text-sm">
              <div className="space-y-1">
                <Label className="font-bold">اسم المورد / الشركة *</Label>
                <Input value={orderForm.supplier_name} onChange={(e) => setOrderForm({ ...orderForm, supplier_name: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">فئة الخدمة</Label>
                <Select value={orderForm.service_category} onValueChange={(v) => setOrderForm({ ...orderForm, service_category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="تذاكر طيران">تذاكر طيران</SelectItem>
                    <SelectItem value="غرف واجنيح فنادق">غرف وإقامات فنادق</SelectItem>
                    <SelectItem value="نقل بري ولوجستيات">نقل بري ولوجستيات</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-bold">إجمالي تكلفة الشراء (ريال سعودي) *</Label>
                <Input type="number" value={orderForm.total_cost} onChange={(e) => setOrderForm({ ...orderForm, total_cost: Number(e.target.value) })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">سعر البيع المستهدف (ريال سعودي) *</Label>
                <Input type="number" value={orderForm.expected_selling_price} onChange={(e) => setOrderForm({ ...orderForm, expected_selling_price: Number(e.target.value) })} />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="font-bold">الشروط والملاحظات</Label>
                <Textarea value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} className="h-20" />
              </div>
            </div>

            <DialogFooter className="border-t pt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenOrderModal(false)}>إلغاء</Button>
              <Button onClick={handleSaveOrder} className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-8">
                تأكيد وإصدار أمر الشراء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────
            FULL-SCREEN MODAL 4: CREATE PROCUREMENT INVOICE (PI)
        ───────────────────────────────────────────── */}
        <Dialog open={openInvoiceModal} onOpenChange={setOpenInvoiceModal}>
          <DialogContent className="max-w-[100vw] w-screen h-screen max-h-screen m-0 rounded-none p-6 bg-white flex flex-col justify-between font-sans overflow-y-auto" dir="rtl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-2xl font-bold text-teal-800 flex items-center gap-2">
                <ShoppingBag className="w-7 h-7 text-teal-600" /> إدخال فاتورة مشتريات خدمات وتذاكر من المورد (Procurement Invoice)
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 my-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
                <div className="space-y-1">
                  <Label className="font-bold">المورد / الوكيل *</Label>
                  <Input value={invSupplierName} onChange={(e) => setInvSupplierName(e.target.value)} placeholder="اسم الشركة الموردة" />
                </div>
                <div className="space-y-1">
                  <Label className="font-bold">رقم فاتورة المورد المرجعي</Label>
                  <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="SDA-INV-1020" />
                </div>
                <div className="space-y-1">
                  <Label className="font-bold">طريقة الدفع للمورد</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">تحويل بنكي direct bank</SelectItem>
                      <SelectItem value="cash">نقداً من الخزينة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 text-base">بنود الخدمات المشتراة:</h4>
                  <Button size="sm" onClick={addItem} variant="outline" className="text-xs font-bold gap-1 border-teal-200 text-teal-700">
                    <Plus className="w-3.5 h-3.5" /> إضافة بند مشتريات
                  </Button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3 text-xs items-center shadow-sm">
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-[11px] font-bold">الوصف / الخدمة المشتراة</Label>
                      <Input className="h-9 text-xs" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold">سعر التكلفة الشراء</Label>
                      <Input className="h-9 text-xs font-mono font-bold" type="number" value={item.cost_price} onChange={(e) => updateItem(idx, "cost_price", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold">البيع المخطط</Label>
                      <Input className="h-9 text-xs font-mono font-bold text-emerald-700" type="number" value={item.selling_price} onChange={(e) => updateItem(idx, "selling_price", Number(e.target.value))} />
                    </div>
                    {items.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-red-500 hover:bg-red-50 p-1 mt-5">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 bg-teal-50 p-4 rounded-xl text-center text-sm font-sans border border-teal-200">
                <div>
                  <div className="text-slate-500 font-bold">إجمالي الشراء</div>
                  <div className="font-bold text-slate-800 text-lg font-mono">{fmt(totalCost)} ريال</div>
                </div>
                <div>
                  <div className="text-slate-500 font-bold">المبيعات المخططة</div>
                  <div className="font-bold text-emerald-800 text-lg font-mono">{fmt(totalSelling)} ريال</div>
                </div>
                <div>
                  <div className="text-slate-500 font-bold">الأرباح الصافية التقديرية</div>
                  <div className="font-bold text-blue-700 text-lg font-mono">+{fmt(expectedProfit)} ريال</div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenInvoiceModal(false)}>إلغاء</Button>
              <Button onClick={handleSaveProcurementInvoice} className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-8">
                اعتماد وتنسيق القيود المحاسبية
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────
            FULL-SCREEN MODAL 5: CREATE PAYMENT VOUCHER
        ───────────────────────────────────────────── */}
        <Dialog open={openPaymentModal} onOpenChange={setOpenPaymentModal}>
          <DialogContent className="max-w-[100vw] w-screen h-screen max-h-screen m-0 rounded-none p-6 bg-white flex flex-col justify-between font-sans overflow-y-auto" dir="rtl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-bold text-amber-800 flex items-center gap-2">
                <Coins className="w-6 h-6 text-amber-600" /> إصدار سند دفع للمورد (Payment Voucher)
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 my-4 text-sm">
              <div className="space-y-1">
                <Label className="font-bold">اسم المورد المستلم *</Label>
                <Input value={paymentForm.supplier_name} onChange={(e) => setPaymentForm({ ...paymentForm, supplier_name: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">مبلغ السداد (ريال سعودي) *</Label>
                <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">جهة الصرف</Label>
                <Input value={paymentForm.safe_or_bank} onChange={(e) => setPaymentForm({ ...paymentForm, safe_or_bank: e.target.value })} placeholder="الخزينة الرئيسية / البنك" />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">طريقة الدفع</Label>
                <Select value={paymentForm.payment_method} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقداً من الخزينة</SelectItem>
                    <SelectItem value="bank">تحويل بنكي direct bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="font-bold">البيان والملاحظات</Label>
                <Textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="h-20" />
              </div>
            </div>

            <DialogFooter className="border-t pt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenPaymentModal(false)}>إلغاء</Button>
              <Button onClick={handleSavePayment} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8">
                تأكيد الصرف وترحيل القيد المحاسبي
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────
            FULL-SCREEN MODAL 6: CREATE CONTRACT
        ───────────────────────────────────────────── */}
        <Dialog open={openContractModal} onOpenChange={setOpenContractModal}>
          <DialogContent className="max-w-[100vw] w-screen h-screen max-h-screen m-0 rounded-none p-6 bg-white flex flex-col justify-between font-sans overflow-y-auto" dir="rtl">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-bold text-indigo-800 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-indigo-600" /> تسجيل عقد وتسهيلات مورد جديد (Supplier Contract)
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 my-4 text-sm">
              <div className="space-y-1">
                <Label className="font-bold">اسم المورد / الشركة *</Label>
                <Input value={contractForm.supplier_name} onChange={(e) => setContractForm({ ...contractForm, supplier_name: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">نوع الاتفاقيةالعقد</Label>
                <Input value={contractForm.contract_type} onChange={(e) => setContractForm({ ...contractForm, contract_type: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">سقف الائتمان الدائن (ريال)</Label>
                <Input type="number" value={contractForm.credit_limit} onChange={(e) => setContractForm({ ...contractForm, credit_limit: Number(e.target.value) })} />
              </div>

              <div className="space-y-1">
                <Label className="font-bold">نسبة العمولة المكتسبة</Label>
                <Input value={contractForm.commission_rate} onChange={(e) => setContractForm({ ...contractForm, commission_rate: e.target.value })} placeholder="مثال: 8.5%" />
              </div>

              <div className="space-y-1 col-span-2">
                <Label className="font-bold">شروط وأحكام الاتفاقية</Label>
                <Textarea value={contractForm.terms} onChange={(e) => setContractForm({ ...contractForm, terms: e.target.value })} className="h-24" />
              </div>
            </div>

            <DialogFooter className="border-t pt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenContractModal(false)}>إلغاء</Button>
              <Button onClick={handleSaveContract} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8">
                حفظ العقد وتفعيله
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────
            FULL-SCREEN REPORT VIEWER MODAL
        ───────────────────────────────────────────── */}
        <ReportViewerModal
          isOpen={reportViewerOpen}
          onClose={() => setReportViewerOpen(false)}
          htmlContent={reportHtml}
          title={reportTitle}
        />

      </div>
    </AdminLayout>
  );
}

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { 
  Plane, Plus, Search, ChevronRight, ChevronLeft, Trash2, 
  Save, X, Printer, UserPlus, CheckCircle2, AlertCircle, 
  ArrowRight, ArrowLeft, ArrowDownRight, ArrowUpRight, 
  DollarSign, FileText, Calendar, Building2, User, RefreshCw,
  Wallet, CreditCard, Sparkles, ShieldCheck
} from "lucide-react";

interface FlightBookingFullscreenProps {
  open: boolean;
  onClose: () => void;
  booking: any | null;
  bookingsList: any[];
  customers: any[];
  passengers: any[];
  airlines: any[];
  onSave: (formData: any) => Promise<any>;
  onDelete: (id: number) => void;
  onPrintVoucher?: (booking: any) => void;
  isSaving: boolean;
  onCustomerAdded?: () => void;
}

export function FlightBookingFullscreenDialog({
  open,
  onClose,
  booking,
  bookingsList,
  customers,
  passengers,
  airlines,
  onSave,
  onDelete,
  onPrintVoucher,
  isSaving,
  onCustomerAdded
}: FlightBookingFullscreenProps) {
  // Track index for browsing existing bookings
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Form State
  const [form, setForm] = useState({
    booking_number: "",
    service_type: "flight",
    customer_id: "",
    passenger_id: "",
    airline_supplier: "",
    supplier_id: "",
    flight_number: "",
    origin_city: "",
    destination_city: "",
    departure_date: new Date().toISOString().slice(0, 10),
    return_date: "",
    ticket_number: "",
    pnr: "",
    status: "confirmed",
    issue_date: new Date().toISOString().slice(0, 10),
    cost_price: "0",
    supplier_currency: "SAR",
    supplier_statement: "تكلفة تذكرة طيران",
    supplier_payment_method: "credit", // آجل افتراضياً للطرف الثاني
    selling_price: "0",
    customer_currency: "SAR",
    customer_statement: "قيمة تذكرة طيران",
    payment_method: "cash", // نقداً افتراضياً للطرف الأول
    travel_class: "اقتصادية",
    notes: ""
  });

  // Search popover state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState("");

  // Quick Customer Add Modal
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustType, setNewCustType] = useState("individual");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [quickCustError, setQuickCustError] = useState("");

  // Populate form based on booking prop or generate new
  useEffect(() => {
    if (booking) {
      const idx = bookingsList.findIndex(b => b.id === booking.id);
      setCurrentIndex(idx);
      setForm({
        booking_number: booking.booking_number || "",
        service_type: booking.service_type || "flight",
        customer_id: booking.customer_id ? String(booking.customer_id) : "",
        passenger_id: booking.passenger_id ? String(booking.passenger_id) : "",
        airline_supplier: booking.airline_supplier || booking.airline_name || "",
        supplier_id: booking.supplier_id ? String(booking.supplier_id) : "",
        flight_number: booking.flight_number || "",
        origin_city: booking.origin_city || "",
        destination_city: booking.destination_city || "",
        departure_date: booking.departure_date || new Date().toISOString().slice(0, 10),
        return_date: booking.return_date || "",
        ticket_number: booking.ticket_number || "",
        pnr: booking.pnr || "",
        status: booking.status || "confirmed",
        issue_date: booking.issue_date || new Date().toISOString().slice(0, 10),
        cost_price: String(booking.cost_price || 0),
        supplier_currency: booking.supplier_currency || "SAR",
        supplier_statement: booking.supplier_statement || "تكلفة تذكرة طيران",
        supplier_payment_method: booking.supplier_payment_method || "credit",
        selling_price: String(booking.selling_price || 0),
        customer_currency: booking.customer_currency || "SAR",
        customer_statement: booking.customer_statement || "قيمة تذكرة طيران",
        payment_method: booking.payment_method || "cash",
        travel_class: booking.travel_class || "اقتصادية",
        notes: booking.notes || ""
      });
    } else {
      initNewForm();
    }
  }, [booking, bookingsList]);

  const initNewForm = () => {
    setCurrentIndex(-1);
    const nextSeq = String((bookingsList.length || 0) + 1).padStart(6, "0");
    setForm({
      booking_number: nextSeq,
      service_type: "flight",
      customer_id: "",
      passenger_id: "",
      airline_supplier: "",
      supplier_id: "",
      flight_number: "",
      origin_city: "",
      destination_city: "",
      departure_date: new Date().toISOString().slice(0, 10),
      return_date: "",
      ticket_number: "",
      pnr: "",
      status: "confirmed",
      issue_date: new Date().toISOString().slice(0, 10),
      cost_price: "0",
      supplier_currency: "SAR",
      supplier_statement: "تكلفة تذكرة طيران",
      supplier_payment_method: "credit",
      selling_price: "0",
      customer_currency: "SAR",
      customer_statement: "قيمة تذكرة طيران",
      payment_method: "cash",
      travel_class: "اقتصادية",
      notes: ""
    });
  };

  // Step between bookings
  const handleNextBooking = () => {
    if (bookingsList.length === 0) return;
    const next = currentIndex < bookingsList.length - 1 ? currentIndex + 1 : 0;
    const nextBk = bookingsList[next];
    if (nextBk) {
      loadBookingIntoForm(nextBk, next);
    }
  };

  const handlePrevBooking = () => {
    if (bookingsList.length === 0) return;
    const prev = currentIndex > 0 ? currentIndex - 1 : bookingsList.length - 1;
    const prevBk = bookingsList[prev];
    if (prevBk) {
      loadBookingIntoForm(prevBk, prev);
    }
  };

  const loadBookingIntoForm = (bk: any, idx: number) => {
    setCurrentIndex(idx);
    setForm({
      booking_number: bk.booking_number || "",
      service_type: bk.service_type || "flight",
      customer_id: bk.customer_id ? String(bk.customer_id) : "",
      passenger_id: bk.passenger_id ? String(bk.passenger_id) : "",
      airline_supplier: bk.airline_supplier || bk.airline_name || "",
      supplier_id: bk.supplier_id ? String(bk.supplier_id) : "",
      flight_number: bk.flight_number || "",
      origin_city: bk.origin_city || "",
      destination_city: bk.destination_city || "",
      departure_date: bk.departure_date || new Date().toISOString().slice(0, 10),
      return_date: bk.return_date || "",
      ticket_number: bk.ticket_number || "",
      pnr: bk.pnr || "",
      status: bk.status || "confirmed",
      issue_date: bk.issue_date || new Date().toISOString().slice(0, 10),
      cost_price: String(bk.cost_price || 0),
      supplier_currency: bk.supplier_currency || "SAR",
      supplier_statement: bk.supplier_statement || "تكلفة تذكرة طيران",
      supplier_payment_method: bk.supplier_payment_method || "credit",
      selling_price: String(bk.selling_price || 0),
      customer_currency: bk.customer_currency || "SAR",
      customer_statement: bk.customer_statement || "قيمة تذكرة طيران",
      payment_method: bk.payment_method || "cash",
      travel_class: bk.travel_class || "اقتصادية",
      notes: bk.notes || ""
    });
  };

  // Handle Quick Add Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickCustError("");
    if (!newCustName.trim()) {
      setQuickCustError("يرجى إدخال اسم العميل");
      return;
    }
    setIsAddingCustomer(true);
    try {
      const token = sessionStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newCustName.trim(),
          phone: newCustPhone.trim(),
          customer_type: newCustType
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إضافة العميل");
      }
      // Success: auto select the new customer
      if (onCustomerAdded) onCustomerAdded();
      setForm(f => ({ ...f, customer_id: String(data.id) }));
      setShowAddCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
    } catch (err: any) {
      setQuickCustError(err.message || "حدث خطأ أثناء إضافة العميل");
    } finally {
      setIsAddingCustomer(false);
    }
  };

  // Math Calculations
  const sellVal = Number(form.selling_price || 0);
  const costVal = Number(form.cost_price || 0);
  const commVal = sellVal - costVal;
  const marginPct = costVal > 0 ? ((commVal / costVal) * 100).toFixed(1) : "0";

  // Selected entities names for display
  const selectedCustomer = customers.find(c => String(c.id) === String(form.customer_id));
  const selectedSupplier = airlines.find(a => String(a.id) === String(form.supplier_id));

  // Auto-switch payment method for agency-affiliated customers
  useEffect(() => {
    if (selectedCustomer && selectedCustomer.affiliation_type === 'agency') {
      // Force Credit to Agency Account
      setForm(f => ({ ...f, payment_method: "credit" }));
    }
  }, [form.customer_id, selectedCustomer]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_id) {
      alert("يرجى تحديد العميل (الطرف الأول)");
      return;
    }
    if (!form.supplier_id && !form.airline_supplier) {
      alert("يرجى تحديد شركة الطيران / المورد (الطرف الثاني)");
      return;
    }
    onSave(form);
  };

  const isEditingExisting = currentIndex >= 0 && bookingsList[currentIndex];

  // Search filter
  const filteredBookings = bookingsList.filter(b => {
    if (!modalSearchTerm) return true;
    const s = modalSearchTerm.toLowerCase();
    return (
      (b.booking_number && b.booking_number.toLowerCase().includes(s)) ||
      (b.pnr && b.pnr.toLowerCase().includes(s)) ||
      (b.ticket_number && b.ticket_number.toLowerCase().includes(s)) ||
      (b.customer_name && b.customer_name.toLowerCase().includes(s)) ||
      (b.passenger_name_ar && b.passenger_name_ar.toLowerCase().includes(s))
    );
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex flex-col h-screen w-screen overflow-hidden text-right rtl" dir="rtl">
      <div className="flex flex-col h-full w-full bg-slate-100 shadow-2xl overflow-hidden">
        
        {/* ======================================================== */}
        {/* 2. رأس الشاشة (HEADER & ACTION BAR)                      */}
        {/* ======================================================== */}
        <header className="bg-slate-900 text-white border-b border-slate-800 px-5 py-3 shrink-0 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* Title & Primary Info */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Plane className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black tracking-tight text-white">
                    {isEditingExisting ? "تعديل حجز تذكرة طيران" : "إضافة حجز تذكرة طيران جديد"}
                  </h1>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                    isEditingExisting 
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30" 
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  }`}>
                    {isEditingExisting ? "سجل موجود" : "حجز جديد"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  نافذة كاملة لإدارة حجوزات الطيران، فصل الطرفين الماليين وتوليد القيود المحاسبية التلقائية
                </p>
              </div>
            </div>

            {/* Operation Meta: Number & Date */}
            <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">رقم العملية:</span>
                <input
                  type="text"
                  value={form.booking_number}
                  onChange={e => setForm(f => ({ ...f, booking_number: e.target.value }))}
                  className="bg-slate-900 text-emerald-400 font-mono font-black text-sm px-2.5 py-1 rounded border border-slate-700 w-28 text-center focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  placeholder="000001"
                />
              </div>

              <div className="h-4 w-px bg-slate-700 mx-1" />

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-400 font-bold">التاريخ:</span>
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
                  className="bg-slate-900 text-slate-200 font-sans text-xs px-2 py-1 rounded border border-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* ACTION BAR (شريط أزرار العمليات) */}
            <div className="flex items-center gap-2">
              {/* إضافة جديد */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={initNewForm}
                className="bg-emerald-600 hover:bg-emerald-500 text-white border-none font-bold gap-1.5 shadow-sm"
                title="بدء عملية حجز جديدة وتصفير الحقول"
              >
                <Plus className="w-4 h-4" />
                إضافة جديد
              </Button>

              {/* بحث */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSearchModal(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 font-bold gap-1.5"
                title="بحث فوري عن حجز سابق"
              >
                <Search className="w-4 h-4 text-blue-400" />
                بحث
              </Button>

              {/* استعراض / التنقل بين الحجوزات */}
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={handlePrevBooking}
                  className="p-1.5 hover:bg-slate-700 text-slate-300 rounded hover:text-white transition-colors"
                  title="الحجز السابق"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold px-2 text-slate-300 select-none">
                  {currentIndex >= 0 ? `${currentIndex + 1} / ${bookingsList.length}` : "استعراض"}
                </span>
                <button
                  type="button"
                  onClick={handleNextBooking}
                  className="p-1.5 hover:bg-slate-700 text-slate-300 rounded hover:text-white transition-colors"
                  title="الحجز التالي"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* حذف */}
              {isEditingExisting && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(`هل أنت متأكد من حذف الحجز رقم "${form.booking_number}" وتراجع القيود المحاسبية المرتبطة به؟`)) {
                      onDelete(bookingsList[currentIndex].id);
                      initNewForm();
                    }
                  }}
                  className="bg-red-950/40 hover:bg-red-900/60 text-red-400 border-red-800/60 font-bold gap-1.5"
                  title="حذف الحجز الحالي"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف
                </Button>
              )}

              {/* طباعة قسيمة */}
              {isEditingExisting && onPrintVoucher && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPrintVoucher(bookingsList[currentIndex])}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border-emerald-700/50 font-bold gap-1.5"
                  title="طباعة قسيمة السفر للعميل"
                >
                  <Printer className="w-4 h-4" />
                  طباعة
                </Button>
              )}

              {/* حفظ */}
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black px-4 gap-2 shadow-lg shadow-blue-600/30"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "جاري الحفظ..." : "حفظ"}
              </Button>

              {/* إغلاق النافذة */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors mr-2"
                title="إغلاق الشاشة والرجوع"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* ======================================================== */}
        {/* SCROLLABLE MAIN BODY                                     */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* ------------------------------------------------------ */}
            {/* SECTION 1: الطرفان المتقابلان (العميل vs شركة الطيران)    */}
            {/* ------------------------------------------------------ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* ==================================================== */}
              {/* الطرف الأول: العميل (The Client)                     */}
              {/* ==================================================== */}
              <div className="bg-white rounded-2xl border-2 border-emerald-200/80 shadow-sm p-5 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
                
                {/* Header of Party 1 */}
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-emerald-950">الطرف الأول: العميل</h2>
                      <p className="text-[11px] text-emerald-700 font-medium">حساب المدين / المبيعات والتحصيل</p>
                    </div>
                  </div>

                  <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full font-bold">
                    المدين / الدافع
                  </span>
                </div>

                {/* Customer Selector with Quick Add */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700">
                      اختيار العميل (Customer) <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomer(true)}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 hover:underline"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      + إضافة عميل جديد
                    </button>
                  </div>
                  <select
                    required
                    value={form.customer_id}
                    onChange={e => {
                      const cid = e.target.value;
                      const cust = customers.find(c => String(c.id) === cid);
                      setForm(f => ({
                        ...f,
                        customer_id: cid,
                        customer_statement: cust 
                          ? `قيمة تذكرة طيران للعميل: ${cust.name} ${f.pnr ? `(PNR: ${f.pnr})` : ""}`
                          : f.customer_statement
                      }));
                    }}
                    className="flex h-11 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                  >
                    <option value="">-- اضغط لاختيار العميل من الدليل --</option>
                    {customers.map((c: any, idx: number) => (
                      <option key={`c-${c.id || idx}-${idx}`} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ""} {c.affiliation_type === 'agency' ? `🏬 [تابع لمكتب: ${c.office_name || 'وكيل وسيط'}]` : ""} {c.customer_type === "company" ? "[شركة]" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actual Passenger */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    المسافر الفعلي (Passenger)
                  </label>
                  <select
                    value={form.passenger_id}
                    onChange={e => setForm(f => ({ ...f, passenger_id: e.target.value }))}
                    className="flex h-10 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 text-xs text-slate-700 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- نفس اسم العميل المختار (أو اختر مسافراً مسجلاً) --</option>
                    {passengers.map((p: any, idx: number) => (
                      <option key={`p-${p.id || idx}-${idx}`} value={p.id}>
                        {p.name_ar || p.name_en} {p.passport_number ? `(جواز: ${p.passport_number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selling Price & Currency */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                      <span>مبلغ البيع للعميل *</span>
                      <span className="text-[10px] text-emerald-700 font-mono">Selling Price</span>
                    </label>
                    <div className="relative">
                      <Input
                        required
                        type="number"
                        step="any"
                        min="0"
                        value={form.selling_price}
                        onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
                        className="h-11 text-lg font-mono font-black text-emerald-900 pr-3 pl-12 rounded-xl border-slate-300 bg-emerald-50/20 focus:border-emerald-500"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-3 text-xs font-black text-slate-400 font-mono">
                        {form.customer_currency}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800">
                      عملة العميل
                    </label>
                    <select
                      value={form.customer_currency}
                      onChange={e => setForm(f => ({ ...f, customer_currency: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="YER">ريال يمني (YER)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="EUR">يورو (EUR)</option>
                      <option value="QAR">ريال قطري (QAR)</option>
                      <option value="KWD">دينار كويتي (KWD)</option>
                      <option value="EGP">جنيه مصري (EGP)</option>
                    </select>
                  </div>
                </div>

                {/* Client Payment Method (نقدًا vs آجل) */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 block">
                      طريقة الدفع للطرف الأول (تحدد التأثير المالي المحاسبي) <span className="text-red-500">*</span>
                    </label>
                    {selectedCustomer && (
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        selectedCustomer.affiliation_type === 'agency' 
                          ? 'bg-purple-100 text-purple-900 border border-purple-300' 
                          : 'bg-blue-100 text-blue-900 border border-blue-300'
                      }`}>
                        {selectedCustomer.affiliation_type === 'agency' 
                          ? `🏬 عميل تابع لمكتب: ${selectedCustomer.office_name || 'مكتب وسيط'}` 
                          : '👤 عميل مباشر للمكتب الرئيسي'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* نقدًا */}
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, payment_method: "cash" }))}
                      className={`p-3 rounded-xl border-2 text-right transition-all flex flex-col justify-between ${
                        form.payment_method === "cash"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-black text-sm flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-emerald-600" />
                          نقدًا (Cash)
                        </span>
                        {form.payment_method === "cash" && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-emerald-800 font-medium">
                        تحصيل مباشر في الصندوق الرئيسي (11100)
                      </span>
                    </button>

                    {/* آجل - استبدال وإخفاء آجل العميل بآجل المكتب الوسيط عند التبعية */}
                    {selectedCustomer?.affiliation_type === 'agency' ? (
                      /* إخفاء خيار آجل على العميل واستبداله بـ آجل على حساب المكتب الوسيط */
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, payment_method: "credit" }))}
                        className={`p-3 rounded-xl border-2 text-right transition-all flex flex-col justify-between ${
                          form.payment_method === "credit"
                            ? "border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-600/25 shadow-sm"
                            : "border-purple-200 bg-purple-50/40 hover:bg-purple-50 text-purple-900"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-black text-sm flex items-center gap-1.5 text-purple-950">
                            <Building2 className="w-4 h-4 text-purple-700" />
                            آجل على حساب المكتب الوسيط
                          </span>
                          {form.payment_method === "credit" && (
                            <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0" />
                          )}
                        </div>
                        <span className="text-[11px] text-purple-800 font-bold leading-tight">
                          قيد على حساب: {selectedCustomer.office_name || "الوكيل الوسيط"} ({selectedCustomer.account_code || "دليل الحسابات"})
                        </span>
                      </button>
                    ) : (
                      /* عميل مباشر: طريقة الدفع الآجلة المعتادة لحساب العميل المستقل */
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, payment_method: "credit" }))}
                        className={`p-3 rounded-xl border-2 text-right transition-all flex flex-col justify-between ${
                          form.payment_method === "credit"
                            ? "border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20 shadow-sm"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-black text-sm flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                            آجل على حساب العميل (Credit)
                          </span>
                          {form.payment_method === "credit" && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                        </div>
                        <span className="text-[11px] text-blue-800 font-medium">
                          ذمم مدينة على العميل (حساب شخصي 11200)
                        </span>
                      </button>
                    )}
                  </div>

                  {/* تنبيه محاسبي وأمني توضيحي عند اختيار عميل تابع لمكتب وسيط */}
                  {selectedCustomer?.affiliation_type === 'agency' && (
                    <div className="p-3 bg-purple-50/90 border border-purple-200 rounded-xl flex items-start gap-2.5 text-xs text-purple-950 mt-2">
                      <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold text-purple-900 block">حماية أمنية ومحاسبية مفعلة:</span>
                        العميل (<strong>{selectedCustomer.name}</strong>) مسجل كعميل تابع لمكتب (<strong>{selectedCustomer.office_name || 'الوكيل الوسيط'}</strong>). تم حجب وإخفاء قيد الآجل الفردي للعميل واستبداله بالقيد الآجل المباشر على حساب المكتب الوسيط في شجرة الحسابات (<strong>{selectedCustomer.account_code || '11200'}</strong>). يمنع النظام فتح أي حساب للعميل بدليل الحسابات، وسيتم تثبيت اسم العميل تلقائياً في تفاصيل كشف حساب المكتب.
                      </div>
                    </div>
                  )}
                </div>

                {/* Customer Statement */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      {selectedCustomer?.affiliation_type === 'agency'
                        ? "البيان الخاص بالحجز (يظهر صراحة باسم العميل في كشف حساب المكتب الوسيط)"
                        : "البيان الخاص بالعميل (يظهر في كشف حسابه وفاتورته)"}
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Statement</span>
                  </div>
                  <Input
                    value={form.customer_statement}
                    onChange={e => setForm(f => ({ ...f, customer_statement: e.target.value }))}
                    placeholder={
                      selectedCustomer?.affiliation_type === 'agency'
                        ? `قيمة تذكرة طيران - عميل: ${selectedCustomer.name}`
                        : "مثال: قيمة تذكرة طيران مسار الرياض - القاهرة"
                    }
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>

              </div>

              {/* ==================================================== */}
              {/* الطرف الثاني: شركة الطيران / المورد (The Supplier)  */}
              {/* ==================================================== */}
              <div className="bg-white rounded-2xl border-2 border-blue-200/80 shadow-sm p-5 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
                
                {/* Header of Party 2 */}
                <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-blue-950">الطرف الثاني: شركة الطيران / المورد</h2>
                      <p className="text-[11px] text-blue-700 font-medium">حساب الدائن / تكلفة الشراء والمستحقات</p>
                    </div>
                  </div>

                  <span className="text-xs bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-1 rounded-full font-bold">
                    الدائن / التكلفة
                  </span>
                </div>

                {/* Airline / Supplier Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700">
                      شركة الطيران / المورد (من دليل الحسابات) <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-blue-700 font-mono">الذمم الدائنة للطيران</span>
                  </div>
                  <select
                    required
                    value={form.supplier_id}
                    onChange={e => {
                      const sid = e.target.value;
                      const sup = airlines.find(a => String(a.id) === sid);
                      setForm(f => ({
                        ...f,
                        supplier_id: sid,
                        airline_supplier: sup ? sup.name : f.airline_supplier,
                        supplier_statement: sup 
                          ? `تكلفة تذكرة طيران من ${sup.name} ${f.pnr ? `(PNR: ${f.pnr})` : ""}`
                          : f.supplier_statement
                      }));
                    }}
                    className="flex h-11 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  >
                    <option value="">-- اضغط لاختيار شركة الطيران / المورد --</option>
                    {airlines.map((a: any, idx: number) => (
                      <option key={`a-${a.id || idx}-${idx}`} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Helper for Airline Name fallback */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    الاسم التجاري للناقل (Carrier Name)
                  </label>
                  <Input
                    value={form.airline_supplier}
                    onChange={e => setForm(f => ({ ...f, airline_supplier: e.target.value }))}
                    placeholder="مثال: الخطوط السعودية (Saudia) / طيران أديل / فلاي ناس..."
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>

                {/* Cost Price & Currency */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                      <span>مبلغ التكلفة على المكتب *</span>
                      <span className="text-[10px] text-blue-700 font-mono">Cost Price</span>
                    </label>
                    <div className="relative">
                      <Input
                        required
                        type="number"
                        step="any"
                        min="0"
                        value={form.cost_price}
                        onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
                        className="h-11 text-lg font-mono font-black text-blue-950 pr-3 pl-12 rounded-xl border-slate-300 bg-blue-50/20 focus:border-blue-500"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-3 text-xs font-black text-slate-400 font-mono">
                        {form.supplier_currency}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-800">
                      عملة المورد
                    </label>
                    <select
                      value={form.supplier_currency}
                      onChange={e => setForm(f => ({ ...f, supplier_currency: e.target.value }))}
                      className="flex h-11 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="YER">ريال يمني (YER)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="EUR">يورو (EUR)</option>
                      <option value="QAR">ريال قطري (QAR)</option>
                      <option value="KWD">دينار كويتي (KWD)</option>
                    </select>
                  </div>
                </div>

                {/* Supplier Payment Method (آجل vs نقدًا) */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-black text-slate-800 block">
                    طريقة الدفع لشركة الطيران / المورد (تحدد التأثير المالي التلقائي) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* آجل (افتراضي للموردين) */}
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, supplier_payment_method: "credit" }))}
                      className={`p-3 rounded-xl border-2 text-right transition-all flex flex-col justify-between ${
                        form.supplier_payment_method === "credit"
                          ? "border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-black text-sm flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                          آجل (Credit)
                        </span>
                        {form.supplier_payment_method === "credit" && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-blue-800 font-medium">
                        ذمم دائنة لشركة الطيران (حساب المورد)
                      </span>
                    </button>

                    {/* نقدًا */}
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, supplier_payment_method: "cash" }))}
                      className={`p-3 rounded-xl border-2 text-right transition-all flex flex-col justify-between ${
                        form.supplier_payment_method === "cash"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-black text-sm flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-emerald-600" />
                          نقدًا (Cash)
                        </span>
                        {form.supplier_payment_method === "cash" && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-emerald-800 font-medium">
                        صرف نقدي من الصندوق (دائن 11100)
                      </span>
                    </button>
                  </div>
                </div>

                {/* Supplier Statement */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      البيان الخاص بشركة الطيران / المورد (يظهر في كشف حساب المورد)
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Statement</span>
                  </div>
                  <Input
                    value={form.supplier_statement}
                    onChange={e => setForm(f => ({ ...f, supplier_statement: e.target.value }))}
                    placeholder="مثال: تكلفة تذكرة طيران PNR: 6AKL9Q"
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>

              </div>

            </div>

            {/* ------------------------------------------------------ */}
            {/* SECTION 2: بيانات التذكرة والرحلة (FLIGHT DETAILS)       */}
            {/* ------------------------------------------------------ */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Plane className="w-5 h-5 text-blue-600" />
                  <h3 className="font-black text-sm text-slate-900">بيانات الرحلة والتذكرة (Flight & Booking Details)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">حالة التذكرة:</span>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="h-8 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold px-2.5 focus:bg-white"
                  >
                    <option value="confirmed">حجز مؤكد</option>
                    <option value="issued">تذكرة مصدرة</option>
                    <option value="pending_issue">بانتظار الإصدار</option>
                    <option value="cancelled">ملغاة</option>
                    <option value="refunded">مسترجعة</option>
                    <option value="reissued">معاد إصدارها</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* PNR */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">
                    رقم الحجز (PNR)
                  </label>
                  <Input
                    value={form.pnr}
                    onChange={e => setForm(f => ({ ...f, pnr: e.target.value.toUpperCase() }))}
                    placeholder="e.g. 6AKL9Q"
                    className="h-10 font-mono font-black text-blue-700 uppercase rounded-xl border-slate-300"
                  />
                </div>

                {/* Ticket Number */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">
                    رقم التذكرة الإلكترونية
                  </label>
                  <Input
                    value={form.ticket_number}
                    onChange={e => setForm(f => ({ ...f, ticket_number: e.target.value }))}
                    placeholder="065-1234567890"
                    className="h-10 font-mono text-xs rounded-xl border-slate-300"
                  />
                </div>

                {/* Flight Number */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">
                    رقم الرحلة (Flight No.)
                  </label>
                  <Input
                    value={form.flight_number}
                    onChange={e => setForm(f => ({ ...f, flight_number: e.target.value }))}
                    placeholder="SV-102"
                    className="h-10 font-mono text-xs rounded-xl border-slate-300"
                  />
                </div>

                {/* Travel Class */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">
                    درجة السفر
                  </label>
                  <select
                    value={form.travel_class}
                    onChange={e => setForm(f => ({ ...f, travel_class: e.target.value }))}
                    className="flex h-10 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 text-xs font-bold text-slate-800"
                  >
                    <option value="اقتصادية">اقتصادية (Economy)</option>
                    <option value="رجال أعمال">رجال أعمال (Business)</option>
                    <option value="أولى">الدرجة الأولى (First)</option>
                  </select>
                </div>

                {/* Departure Date */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">
                    تاريخ المغادرة
                  </label>
                  <Input
                    type="date"
                    value={form.departure_date}
                    onChange={e => setForm(f => ({ ...f, departure_date: e.target.value }))}
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>

                {/* Return Date */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">
                    تاريخ العودة (اختياري)
                  </label>
                  <Input
                    type="date"
                    value={form.return_date}
                    onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))}
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>
              </div>

              {/* Routing / Cities and Notes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">مدينة الإقلاع (Origin)</label>
                  <Input
                    value={form.origin_city}
                    onChange={e => setForm(f => ({ ...f, origin_city: e.target.value }))}
                    placeholder="مثال: الرياض (RUH) أو جدة (JED)"
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">مدينة الوصول (Destination)</label>
                  <Input
                    value={form.destination_city}
                    onChange={e => setForm(f => ({ ...f, destination_city: e.target.value }))}
                    placeholder="مثال: القاهرة (CAI) أو دبي (DXB)"
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">ملاحظات وشروط التذكرة</label>
                  <Input
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="وزن الأمتعة، شروط التعديل والاسترجاع..."
                    className="h-10 text-xs rounded-xl border-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------ */}
            {/* SECTION 3: التأثير المالي وملخص العملية (FINANCIAL)      */}
            {/* ------------------------------------------------------ */}
            <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl p-5 space-y-4">
              
              {/* Financial Summary Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-black text-sm text-white">التأثير المالي وملخص العملية المحاسبية</h3>
                    <p className="text-[11px] text-slate-400">
                      طريقة الدفع لكل طرف تحدد تلقائياً القيد المحاسبي المزدوج المتولد لحظة الحفظ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Total Sell */}
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-400 block font-bold">إجمالي البيع (العميل)</span>
                    <span className="text-lg font-mono font-black text-white">
                      {sellVal.toLocaleString()} {form.customer_currency}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {form.payment_method === "cash" ? "🟢 نقدًا (الصندوق)" : "🔵 آجل (ذمم مدينة)"}
                    </span>
                  </div>

                  <div className="text-slate-600 font-mono text-xl">−</div>

                  {/* Total Cost */}
                  <div className="text-right">
                    <span className="text-[10px] text-blue-400 block font-bold">إجمالي التكلفة (المورد)</span>
                    <span className="text-lg font-mono font-black text-white">
                      {costVal.toLocaleString()} {form.supplier_currency}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {form.supplier_payment_method === "credit" ? "🔵 آجل (ذمم دائنة)" : "🟢 نقدًا (صرف الصندوق)"}
                    </span>
                  </div>

                  <div className="text-slate-600 font-mono text-xl">=</div>

                  {/* Profit / Commission */}
                  <div className="text-right bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-amber-400 block font-bold">صافي عمولة المكتب (الربح)</span>
                    <span className={`text-xl font-mono font-black ${commVal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {commVal.toLocaleString()} {form.customer_currency}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      هامش الربح: {marginPct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Real-time Double-Entry Ledger Preview */}
              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-2">
                <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  المعاينة الحية للقيود المحاسبية التلقائية (Double-Entry Journal Preview):
                </span>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold">
                        <th className="py-1.5 px-2">الطرف / الحساب المحاسبي</th>
                        <th className="py-1.5 px-2">مدين (Debit)</th>
                        <th className="py-1.5 px-2">دائن (Credit)</th>
                        <th className="py-1.5 px-2">العملة</th>
                        <th className="py-1.5 px-2">طبيعة الحركة والتأثير المالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 font-mono text-[11px]">
                      
                      {/* Customer / Safe Impact */}
                      {sellVal > 0 && form.payment_method === "cash" && (
                        <>
                          <tr className="text-emerald-300">
                            <td className="py-1 px-2 font-sans font-bold">
                              11100 - الصندوق الرئيسي (الخزينة)
                            </td>
                            <td className="py-1 px-2 font-bold">{sellVal.toLocaleString()}</td>
                            <td className="py-1 px-2 text-slate-600">0.00</td>
                            <td className="py-1 px-2">{form.customer_currency}</td>
                            <td className="py-1 px-2 font-sans text-emerald-400">
                              📥 تحصيل نقدي بالصندوق من العميل (مدين)
                            </td>
                          </tr>
                          <tr className="text-slate-300">
                            <td className="py-1 px-2 font-sans">
                              41001 - إيرادات مبيعات تذاكر الطيران
                            </td>
                            <td className="py-1 px-2 text-slate-600">0.00</td>
                            <td className="py-1 px-2 font-bold">{sellVal.toLocaleString()}</td>
                            <td className="py-1 px-2">{form.customer_currency}</td>
                            <td className="py-1 px-2 font-sans text-slate-400">
                              📈 إثبات إيراد مبيعات التذكرة (دائن)
                            </td>
                          </tr>
                        </>
                      )}

                      {sellVal > 0 && form.payment_method === "credit" && (
                        <>
                          <tr className="text-blue-300">
                            <td className="py-1 px-2 font-sans font-bold">
                              {selectedCustomer && selectedCustomer.affiliation_type === 'agency'
                                ? `حساب المكتب الوسيط (${selectedCustomer.office_name || "الوكيل الوسيط"})`
                                : `حساب العميل (${selectedCustomer ? selectedCustomer.name : "العميل"})`}
                            </td>
                            <td className="py-1 px-2 font-bold">{sellVal.toLocaleString()}</td>
                            <td className="py-1 px-2 text-slate-600">0.00</td>
                            <td className="py-1 px-2">{form.customer_currency}</td>
                            <td className="py-1 px-2 font-sans text-blue-400">
                              {selectedCustomer && selectedCustomer.affiliation_type === 'agency'
                                ? "👤 قيد استحقاق في ذمم المكتب الوسيط الدائنة والمدينة - العميل لا يفتح له حساب منفصل"
                                : "👤 قيد استحقاق في ذمم العميل المدينة (مدين) - الصندوق لا يتأثر"}
                            </td>
                          </tr>
                          <tr className="text-slate-300">
                            <td className="py-1 px-2 font-sans">
                              41001 - إيرادات مبيعات تذاكر الطيران
                            </td>
                            <td className="py-1 px-2 text-slate-600">0.00</td>
                            <td className="py-1 px-2 font-bold">{sellVal.toLocaleString()}</td>
                            <td className="py-1 px-2">{form.customer_currency}</td>
                            <td className="py-1 px-2 font-sans text-slate-400">
                              📈 إثبات إيراد مبيعات التذكرة (دائن)
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Supplier / Safe Impact */}
                      {costVal > 0 && form.supplier_payment_method === "credit" && (
                        <>
                          <tr className="text-slate-300">
                            <td className="py-1 px-2 font-sans">
                              51000 - تكلفة شراء تذاكر الطيران
                            </td>
                            <td className="py-1 px-2 font-bold">{costVal.toLocaleString()}</td>
                            <td className="py-1 px-2 text-slate-600">0.00</td>
                            <td className="py-1 px-2">{form.supplier_currency}</td>
                            <td className="py-1 px-2 font-sans text-slate-400">
                              📉 إثبات تكلفة شراء التذكرة (مدين)
                            </td>
                          </tr>
                          <tr className="text-indigo-300">
                            <td className="py-1 px-2 font-sans font-bold">
                              حساب المورد ({selectedSupplier ? selectedSupplier.name : form.airline_supplier || "شركة الطيران"})
                            </td>
                            <td className="py-1 px-2 text-slate-600">0.00</td>
                            <td className="py-1 px-2 font-bold">{costVal.toLocaleString()}</td>
                            <td className="py-1 px-2">{form.supplier_currency}</td>
                            <td className="py-1 px-2 font-sans text-indigo-400">
                              ✈️ ذمم دائنة لشركة الطيران (دائن) - الصندوق لا يتأثر
                            </td>
                          </tr>
                        </>
                      )}

                      {costVal > 0 && form.supplier_payment_method === "cash" && (
                        <>
                          <tr className="text-slate-300">
                            <td className="py-1 px-2 font-sans">
                              51000 - تكلفة شراء تذاكر الطيران
                            </td>
                            <td className="py-1 px-2 font-bold">{costVal.toLocaleString()}</td>
                            <td className="py-1 px-2 text-slate-600">0.00</td>
                            <td className="py-1 px-2">{form.supplier_currency}</td>
                            <td className="py-1 px-2 font-sans text-slate-400">
                              📉 إثبات تكلفة شراء التذكرة (مدين)
                            </td>
                          </tr>
                          <tr className="text-red-300">
                            <td className="py-1 px-2 font-sans font-bold">
                              11100 - الصندوق الرئيسي (الخزينة)
                            </td>
                            <td className="py-1 px-2 text-slate-600">0.00</td>
                            <td className="py-1 px-2 font-bold">{costVal.toLocaleString()}</td>
                            <td className="py-1 px-2">{form.supplier_currency}</td>
                            <td className="py-1 px-2 font-sans text-red-400">
                              📤 صرف نقدي من الصندوق لسداد شركة الطيران (دائن)
                            </td>
                          </tr>
                        </>
                      )}

                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Bottom Form Actions */}
            <div className="flex items-center justify-between pt-2 pb-6">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="bg-white hover:bg-slate-100 font-bold border-slate-300"
                >
                  إلغاء وخروج
                </Button>

                {isEditingExisting && onPrintVoucher && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onPrintVoucher(bookingsList[currentIndex])}
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    معاينة قسيمة التذكرة
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black text-sm px-8 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "جاري حفظ الحجز والتأثير المالي..." : "حفظ الحجز والتأثير المالي"}
                </Button>
              </div>
            </div>

          </form>

        </div>

      </div>

      {/* ======================================================== */}
      {/* QUICK SEARCH DIALOG (نافذة البحث السريع)                 */}
      {/* ======================================================== */}
      <Dialog open={showSearchModal} onOpenChange={setShowSearchModal}>
        <DialogContent className="max-w-2xl text-right rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              بحث واستعراض حجوزات الطيران
            </DialogTitle>
            <DialogDescription>
              ابحث برقم العملية، رقم التذكرة، الـ PNR أو اسم العميل لتحميل الحجز مباشرة في الشاشة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-3.5 text-slate-400" />
              <Input
                placeholder="اكتب رقم العملية، الـ PNR، التذكرة أو اسم العميل..."
                value={modalSearchTerm}
                onChange={e => setModalSearchTerm(e.target.value)}
                className="pr-9 h-11 text-sm font-bold"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto divide-y border rounded-xl">
              {filteredBookings.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-medium">
                  لا توجد نتائج مطابقة للبحث
                </div>
              ) : (
                filteredBookings.map((bk, idx) => (
                  <div
                    key={`fbk-${bk.id || idx}-${idx}`}
                    onClick={() => {
                      loadBookingIntoForm(bk, idx);
                      setShowSearchModal(false);
                    }}
                    className="p-3 hover:bg-blue-50/60 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                        <span className="font-mono text-blue-700">{bk.booking_number}</span>
                        <span>•</span>
                        <span>{bk.customer_name || "عميل غير محدد"}</span>
                        {bk.pnr && (
                          <span className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px]">
                            PNR: {bk.pnr}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-1">
                        <span>الناقل: {bk.airline_supplier || bk.airline_name || "-"}</span>
                        <span>المسار: {bk.origin_city} ➔ {bk.destination_city}</span>
                        <span>التاريخ: {bk.issue_date || bk.departure_date}</span>
                      </div>
                    </div>

                    <div className="text-left font-mono font-black text-xs text-emerald-800">
                      {Number(bk.selling_price || 0).toLocaleString()} {bk.customer_currency || "SAR"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSearchModal(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* QUICK ADD CUSTOMER DIALOG (إضافة عميل سريعاً)            */}
      {/* ======================================================== */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="max-w-md text-right rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-emerald-950">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              إضافة عميل جديد سريعاً
            </DialogTitle>
            <DialogDescription>
              تسجيل بيانات العميل لإصدار التذكرة واختياره مباشرة في الحجز الحالي
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCustomer} className="space-y-3.5 py-2">
            {quickCustError && (
              <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{quickCustError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">اسم العميل *</label>
              <Input
                required
                value={newCustName}
                onChange={e => setNewCustName(e.target.value)}
                placeholder="الاسم الكامل للعميل أو الشركة..."
                className="h-10 text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">رقم الهاتف / الجوال</label>
              <Input
                value={newCustPhone}
                onChange={e => setNewCustPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                className="h-10 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">نوع العميل</label>
              <select
                value={newCustType}
                onChange={e => setNewCustType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="individual">فرد (Individual)</option>
                <option value="company">شركة / جهة (Company)</option>
                <option value="agent">وكيل سياحي (Agent)</option>
              </select>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddCustomer(false)}>
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isAddingCustomer}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                {isAddingCustomer ? "جاري الحفظ..." : "حفظ العميل واختياره"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, UserCheck, Plane, ArrowRight, ArrowLeft, CheckCircle2, 
  CreditCard, DollarSign, Receipt, Printer, Ticket, 
  Calendar, ShieldAlert, AlertCircle, FileText, Sparkles, Building2, MapPin
} from "lucide-react";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {})
    }
  }).then(async res => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ أثناء العملية");
    }
    if (res.status === 204) return {} as T;
    return res.json();
  });
}

const STEPS = [
  { id: 1, title: "العميل والشركة", subtitle: "اختيار أو تسجيل العميل", icon: Users },
  { id: 2, title: "المسافرون", subtitle: "بيانات الجوازات والركاب", icon: UserCheck },
  { id: 3, title: "رحلة الذهاب والعودة", subtitle: "مسار الطيران والمطارات", icon: Plane },
  { id: 4, title: "الناقل والأسعار المتقدمة", subtitle: "التكلفة، البيع، والعمولة", icon: DollarSign },
  { id: 5, title: "الدفع وطريقة السداد", subtitle: "نقدي، آجل، أو مجزأ", icon: CreditCard },
  { id: 6, title: "تأكيد وإصدار الفاتورة", subtitle: "مراجعة القيد والتذكرة", icon: Receipt }
];

export default function TravelWizardBookingPage() {
  const qc = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSuccessModal, setIsSuccessModal] = useState(false);
  const [issuedResult, setIssuedResult] = useState<any>(null);

  // Form State
  const [form, setForm] = useState({
    // Step 1: Customer
    customer_id: "",
    customer_name: "",
    customer_type: "individual", // individual, corporate, vip, debtor
    price_tier: "standard", // standard, corporate, agent, employee, custom
    credit_limit: 0,
    current_balance: 0,
    
    // Step 2: Passenger
    passenger_type: "same_as_customer", // same_as_customer, select_existing, new_passenger
    passenger_id: "",
    passenger_name_ar: "",
    passenger_name_en: "",
    passenger_title: "Mr",
    passport_number: "",
    passport_expiry_date: "",
    nationality: "سعودي",
    
    // Step 3: Flight details
    trip_type: "round_trip", // one_way, round_trip, multi_city
    origin_city: "الرياض (RUH)",
    destination_city: "دبي (DXB)",
    departure_date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    departure_time: "10:30",
    return_date: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10),
    return_time: "18:00",
    travel_class: "اقتصادية",
    pnr: `PNR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    flight_number: "SV-112",
    ticket_number: `065-${Math.floor(1000000000 + Math.random() * 9000000000)}`,

    // Step 4: Pricing & Rules
    airline_supplier: "الخطوط السعودية (Saudia)",
    supplier_cost: 1200, // سعر الشراء من المورد
    service_fee: 50, // رسوم الخدمة
    direct_expense: 0, // مصروفات مباشرة
    discount_amount: 0, // الخصم
    selling_price: 1500, // سعر البيع الأساسي
    commission_override: 300, // العمولة المقدرة
    price_rule_note: "سعر بيع التجزئة القياسي للعملاء الأفراد",

    // Step 5: Payment
    payment_mode: "cash", // cash, credit, partial, bank
    paid_amount: 1500,
    safe_id: 1,
    bank_account_id: 1,
    payment_notes: "سداد فوري عند الحجز",

    // Step 6: Notes
    booking_notes: "تأكيد المقعد الأمامي ووجبة خاصة"
  });

  // Queries
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers-list"],
    queryFn: () => fetchWithAuth("/api/customers")
  });

  const { data: passengers = [] } = useQuery<any[]>({
    queryKey: ["travel-passengers-list", form.customer_id],
    queryFn: () => fetchWithAuth(`/api/travel/passengers?${form.customer_id ? `customer_id=${form.customer_id}` : ''}`)
  });

  const { data: airlines = [] } = useQuery<any[]>({
    queryKey: ["travel-airlines"],
    queryFn: () => fetchWithAuth("/api/travel/airlines")
  });

  const { data: safes = [] } = useQuery<any[]>({
    queryKey: ["safes-list"],
    queryFn: () => fetchWithAuth("/api/safes")
  });

  const { data: bankAccounts = [] } = useQuery<any[]>({
    queryKey: ["bank-accounts-list"],
    queryFn: () => fetchWithAuth("/api/accounting/banks")
  });

  // Calculate dynamic math
  const cost = Number(form.supplier_cost || 0);
  const directExp = Number(form.direct_expense || 0);
  const sFee = Number(form.service_fee || 0);
  const discount = Number(form.discount_amount || 0);
  const baseSell = Number(form.selling_price || 0);
  
  // Total Sale = Selling Price + Service Fee - Discount
  const totalSaleAmount = Math.max(0, baseSell + sFee - discount);
  // Profit = Total Sale Amount - Total Cost (Supplier Cost + Direct Expense)
  const netProfit = totalSaleAmount - (cost + directExp);
  // Due / Remaining
  const paid = Number(form.paid_amount || 0);
  const remainingDebt = Math.max(0, totalSaleAmount - paid);

  // Handle Customer Selection
  const handleSelectCustomer = (cId: string) => {
    const cust = customers.find(c => String(c.id) === String(cId));
    if (cust) {
      const isCorp = cust.customer_type === "corporate";
      const isVip = cust.customer_type === "vip";
      let suggestedPrice = 1500;
      let pTier = "standard";

      if (isCorp) {
        suggestedPrice = 1350; // Special corporate pricing
        pTier = "corporate";
      } else if (isVip) {
        suggestedPrice = 1400; // VIP rate
        pTier = "vip";
      }

      setForm(f => ({
        ...f,
        customer_id: String(cust.id),
        customer_name: cust.name,
        customer_type: cust.customer_type || "individual",
        price_tier: pTier,
        credit_limit: cust.credit_limit || (isCorp ? 50000 : 5000),
        current_balance: cust.balance || 0,
        selling_price: suggestedPrice,
        paid_amount: isCorp ? 0 : suggestedPrice,
        payment_mode: isCorp ? "credit" : "cash",
        passenger_name_ar: cust.name,
        passenger_name_en: cust.name_en || "",
        passport_number: cust.passport_number || ""
      }));
    } else {
      setForm(f => ({ ...f, customer_id: "" }));
    }
  };

  // Submit Booking Mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      // 1. Create passenger if new
      let pId = form.passenger_id ? Number(form.passenger_id) : null;
      if (form.passenger_type === "new_passenger" && form.passenger_name_ar) {
        const paxRes: any = await fetchWithAuth("/api/travel/passengers", {
          method: "POST",
          body: JSON.stringify({
            customer_id: form.customer_id || null,
            name_ar: form.passenger_name_ar,
            name_en: form.passenger_name_en || form.passenger_name_ar,
            title: form.passenger_title,
            passport_number: form.passport_number,
            passport_expiry_date: form.passport_expiry_date,
            nationality: form.nationality
          })
        });
        pId = paxRes.id;
      }

      // 2. Create Booking Ticket
      const bookingData = {
        booking_number: `TKT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        service_type: "flight",
        customer_id: Number(form.customer_id),
        passenger_id: pId,
        airline_supplier: form.airline_supplier,
        flight_number: form.flight_number,
        origin_city: form.origin_city,
        destination_city: form.destination_city,
        departure_date: form.departure_date,
        departure_time: form.departure_time,
        return_date: form.trip_type === "round_trip" ? form.return_date : null,
        travel_class: form.travel_class,
        ticket_number: form.ticket_number,
        pnr: form.pnr,
        status: "issued",
        issue_date: new Date().toISOString().slice(0, 10),
        cost_price: cost + directExp,
        selling_price: totalSaleAmount,
        commission: netProfit,
        profit: netProfit,
        payment_status: remainingDebt === 0 ? "paid" : (paid > 0 ? "partial" : "unpaid"),
        payment_method: form.payment_mode,
        notes: `${form.booking_notes} | نوع السعر: ${form.price_tier} | مسدد: ${paid} | آجل متبقي: ${remainingDebt}`
      };

      const result: any = await fetchWithAuth("/api/travel/bookings", {
        method: "POST",
        body: JSON.stringify(bookingData)
      });

      return result;
    },
    onSuccess: (res) => {
      setIssuedResult(res);
      setIsSuccessModal(true);
      qc.invalidateQueries({ queryKey: ["travel-bookings"] });
      qc.invalidateQueries({ queryKey: ["customers-list"] });
    }
  });

  const nextStep = () => {
    if (currentStep === 1 && !form.customer_id) {
      alert("يرجى اختيار العميل للمتابعة");
      return;
    }
    if (currentStep === 4 && totalSaleAmount < cost) {
      if (!confirm("تنبيه أمان: سعر البيع أقل من سعر التكلفة! هل ترغب في طلب موافقة إدارية وإكمال الإدخال؟")) {
        return;
      }
    }
    if (currentStep < 6) setCurrentStep(c => c + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(c => c - 1);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <Sparkles className="w-7 h-7 text-amber-500" />
              شاشة الحجز السريع وإصدار التذاكر (Flight Booking Wizard)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              تسلسل حجز متكامل: العميل ⬅️ المسافر ⬅️ خط السير ⬅️ الناقل والأسعار ⬅️ طريقة الدفع ⬅️ تأكيد القيد وإصدار الفاتورة
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-full font-bold">
              الخطوة {currentStep} من 6
            </span>
          </div>
        </div>

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <div
                key={step.id}
                onClick={() => {
                  if (step.id < currentStep || form.customer_id) {
                    setCurrentStep(step.id);
                  }
                }}
                className={`cursor-pointer rounded-xl border p-3 transition-all ${
                  isActive 
                    ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]" 
                    : isCompleted 
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100/70"
                    : "bg-card text-muted-foreground border-slate-200 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold font-mono">0{step.id}</span>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="font-bold text-xs line-clamp-1">{step.title}</div>
                <div className={`text-[10px] line-clamp-1 ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {step.subtitle}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Step Content */}
        <Card className="border-2 shadow-sm">
          <CardContent className="p-6">
            {/* ================= STEP 1: CUSTOMER ================= */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    الخطوة 1: اختيار العميل أو الشركة (Corporate & Retail CRM)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    اختر العميل لتطبيق قواعد الأسعار الخاصة به (سعر الشركات، سعر الوكلاء، أو السعر العادي) وفحص رصيده وحد الائتمان
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">قائمة العملاء والشركات المعتمدة *</label>
                      <select
                        value={form.customer_id}
                        onChange={e => handleSelectCustomer(e.target.value)}
                        className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-primary"
                      >
                        <option value="">-- اضغط لاختيار العميل من قاعدة البيانات --</option>
                        {customers.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.customer_type === 'corporate' ? '🏢 [شركة]' : c.customer_type === 'vip' ? '⭐ [VIP]' : '👤 [أفراد]'} {c.affiliation_type === 'agency' ? `🏬 [تابع لمكتب: ${c.office_name || 'وكيل وسيط'}]` : ""} - هاتف: {c.phone || '—'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">شريحة التسعير المطبقة (Pricing Tier)</label>
                      <select
                        value={form.price_tier}
                        onChange={e => setForm(f => ({ ...f, price_tier: e.target.value }))}
                        className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                      >
                        <option value="standard">سعر التجزئة العادي (Standard Retail)</option>
                        <option value="corporate">سعر الشركات والاتفاقيات (Corporate Discount)</option>
                        <option value="agent">سعر الوكلاء والموزعين (B2B Agent)</option>
                        <option value="employee">سعر الموظفين والأقارب (Staff Rate)</option>
                        <option value="vip">سعر كبار العملاء (VIP Client Rate)</option>
                      </select>
                    </div>
                  </div>

                  {/* Customer Brief Card */}
                  <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">ملف العميل المالي والائتماني</h4>
                    {form.customer_id ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">اسم العميل:</span>
                          <span className="font-bold text-slate-900">{form.customer_name}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">نوع الحساب:</span>
                          <span className="font-semibold text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            {form.customer_type === 'corporate' ? 'حساب شركة (Corporate B2B)' : 'حساب أفراد (Retail)'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">الرصيد الحالي المستحق:</span>
                          <span className={`font-mono font-bold ${form.current_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {Number(form.current_balance || 0).toLocaleString()} ريال
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t pt-2">
                          <span className="text-muted-foreground">الحد الائتماني المتاح:</span>
                          <span className="font-mono font-bold text-blue-700">
                            {Number(form.credit_limit || 0).toLocaleString()} ريال
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-xs">
                        لم يتم اختيار عميل بعد. الرجاء الاختيار من القائمة للبدء.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 2: PASSENGERS ================= */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-primary" />
                    الخطوة 2: تحديد بيانات المسافرين (Passengers & Passports)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    يمكن أن يكون المسافر هو نفس العميل، أو أحد موظفي الشركة، أو مسافر مسجل مسبقاً، أو إضافة مسافر جديد فوراً
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, passenger_type: "same_as_customer" }))}
                    className={`p-3 rounded-lg border text-right transition-all ${
                      form.passenger_type === "same_as_customer" 
                        ? "border-primary bg-primary/5 text-primary font-bold shadow-sm" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold">1. المسافر هو نفس العميل</div>
                    <div className="text-[10px] text-muted-foreground mt-1">تعبئة البيانات تلقائياً من ملف العميل</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, passenger_type: "select_existing" }))}
                    className={`p-3 rounded-lg border text-right transition-all ${
                      form.passenger_type === "select_existing" 
                        ? "border-primary bg-primary/5 text-primary font-bold shadow-sm" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold">2. اختيار مسافر مسجل مسبقاً</div>
                    <div className="text-[10px] text-muted-foreground mt-1">من قائمة المسافرين التابعين للعميل/الشركة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, passenger_type: "new_passenger" }))}
                    className={`p-3 rounded-lg border text-right transition-all ${
                      form.passenger_type === "new_passenger" 
                        ? "border-primary bg-primary/5 text-primary font-bold shadow-sm" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold">3. تسجيل مسافر جديد</div>
                    <div className="text-[10px] text-muted-foreground mt-1">إدخال اسم ورقم جواز جديد لهذه الرحلة</div>
                  </button>
                </div>

                {form.passenger_type === "select_existing" && (
                  <div className="space-y-2 bg-slate-50 p-4 rounded-xl border">
                    <label className="text-xs font-bold text-slate-700">اختر من مسافري العميل المسجلين:</label>
                    <select
                      value={form.passenger_id}
                      onChange={e => {
                        const pid = e.target.value;
                        const p = passengers.find((x: any) => String(x.id) === String(pid));
                        if (p) {
                          setForm(f => ({
                            ...f,
                            passenger_id: String(p.id),
                            passenger_name_ar: p.name_ar,
                            passenger_name_en: p.name_en,
                            passport_number: p.passport_number || "",
                            nationality: p.nationality || "سعودي"
                          }));
                        }
                      }}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">-- اضغط للاختيار من المسافرين --</option>
                      {passengers.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name_ar} ({p.name_en}) - جواز: {p.passport_number || 'بدون'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">اللقب</label>
                    <select
                      value={form.passenger_title}
                      onChange={e => setForm(f => ({ ...f, passenger_title: e.target.value }))}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="Mr">السيد (Mr)</option>
                      <option value="Mrs">السيدة (Mrs)</option>
                      <option value="Ms">الآنسة (Ms)</option>
                      <option value="Child">طفل (CHD)</option>
                      <option value="Infant">رضيع (INF)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">الاسم بالعربية *</label>
                    <Input
                      value={form.passenger_name_ar}
                      onChange={e => setForm(f => ({ ...f, passenger_name_ar: e.target.value }))}
                      placeholder="مطابق للهوية والجواز"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">الاسم بالإنجليزية (Passport Name) *</label>
                    <Input
                      value={form.passenger_name_en}
                      onChange={e => setForm(f => ({ ...f, passenger_name_en: e.target.value }))}
                      placeholder="e.g. MOHAMMED AL-OTAIBI"
                      className="font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">رقم جواز السفر *</label>
                    <Input
                      value={form.passport_number}
                      onChange={e => setForm(f => ({ ...f, passport_number: e.target.value }))}
                      placeholder="e.g. A12345678"
                      className="font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">تاريخ انتهاء الجواز</label>
                    <Input
                      type="date"
                      value={form.passport_expiry_date}
                      onChange={e => setForm(f => ({ ...f, passport_expiry_date: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">الجنسية</label>
                    <Input
                      value={form.nationality}
                      onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}
                      placeholder="سعودي"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 3: FLIGHT ROUTE ================= */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Plane className="w-5 h-5 text-primary" />
                    الخطوة 3: تفاصيل خط سير الرحلة (Flight Itinerary & Schedule)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    تحديد نوع الرحلة، محطات الانطلاق والوصول، مواعيد الإقلاع والعودة ودرجة السفر
                  </p>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="trip_type"
                      checked={form.trip_type === "round_trip"}
                      onChange={() => setForm(f => ({ ...f, trip_type: "round_trip" }))}
                    />
                    ذهاب وعودة (Round Trip)
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="trip_type"
                      checked={form.trip_type === "one_way"}
                      onChange={() => setForm(f => ({ ...f, trip_type: "one_way" }))}
                    />
                    ذهاب فقط (One Way)
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">مدينة / مطار المغادرة (Origin) *</label>
                    <Input
                      value={form.origin_city}
                      onChange={e => setForm(f => ({ ...f, origin_city: e.target.value }))}
                      placeholder="مثال: الرياض (RUH) / جدة (JED)"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">مدينة / مطار الوصول (Destination) *</label>
                    <Input
                      value={form.destination_city}
                      onChange={e => setForm(f => ({ ...f, destination_city: e.target.value }))}
                      placeholder="مثال: دبي (DXB) / القاهرة (CAI) / لندن (LHR)"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">تاريخ ووقت الإقلاع (Departure)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={form.departure_date}
                        onChange={e => setForm(f => ({ ...f, departure_date: e.target.value }))}
                      />
                      <Input
                        type="time"
                        value={form.departure_time}
                        onChange={e => setForm(f => ({ ...f, departure_time: e.target.value }))}
                      />
                    </div>
                  </div>

                  {form.trip_type === "round_trip" && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">تاريخ ووقت العودة (Return)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={form.return_date}
                          onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))}
                        />
                        <Input
                          type="time"
                          value={form.return_time}
                          onChange={e => setForm(f => ({ ...f, return_time: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">درجة السفر (Cabin Class)</label>
                    <select
                      value={form.travel_class}
                      onChange={e => setForm(f => ({ ...f, travel_class: e.target.value }))}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="اقتصادية">الدرجة السياحية (Economy Class)</option>
                      <option value="رجال الأعمال">درجة رجال الأعمال (Business Class)</option>
                      <option value="الأولى">الدرجة الأولى (First Class)</option>
                      <option value="سياحية ممتازة">السياحية الممتازة (Premium Economy)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">رمز الحجز PNR</label>
                    <Input
                      value={form.pnr}
                      onChange={e => setForm(f => ({ ...f, pnr: e.target.value.toUpperCase() }))}
                      className="font-mono uppercase font-bold text-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 4: ADVANCED PRICING & PROFIT ================= */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    الخطوة 4: نظام الأسعار المتقدم وحساب الربح والعمولة
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    تطبيق معادلة الربح: (سعر البيع + رسوم الخدمة - الخصم) - (تكلفة المورد + المصروف المباشر) = صافي الربح
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Price Inputs */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">شركة الطيران أو المزود (Airline/GDS) *</label>
                      <Input
                        value={form.airline_supplier}
                        onChange={e => setForm(f => ({ ...f, airline_supplier: e.target.value }))}
                        placeholder="مثال: الخطوط السعودية (Saudia)"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">سعر الشراء من المورد (Cost Price) *</label>
                        <Input
                          type="number"
                          value={form.supplier_cost}
                          onChange={e => setForm(f => ({ ...f, supplier_cost: Number(e.target.value) }))}
                          className="font-mono font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">سعر البيع الأساسي (Selling Price) *</label>
                        <Input
                          type="number"
                          value={form.selling_price}
                          onChange={e => setForm(f => ({ ...f, selling_price: Number(e.target.value) }))}
                          className="font-mono font-bold text-blue-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">رسوم الخدمة (+)</label>
                        <Input
                          type="number"
                          value={form.service_fee}
                          onChange={e => setForm(f => ({ ...f, service_fee: Number(e.target.value) }))}
                          className="font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">خصم العميل (-)</label>
                        <Input
                          type="number"
                          value={form.discount_amount}
                          onChange={e => setForm(f => ({ ...f, discount_amount: Number(e.target.value) }))}
                          className="font-mono text-red-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">مصروف مباشر (+)</label>
                        <Input
                          type="number"
                          value={form.direct_expense}
                          onChange={e => setForm(f => ({ ...f, direct_expense: Number(e.target.value) }))}
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Real-time Profit & Cost Engine */}
                  <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4" /> محرك حساب الربح والتسعير
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        {form.price_tier}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>سعر البيع للعميل:</span>
                        <span className="font-mono text-slate-200">{baseSell.toLocaleString()} ريال</span>
                      </div>
                      {sFee > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>+ رسوم الخدمة المضافة:</span>
                          <span className="font-mono">+{sFee.toLocaleString()} ريال</span>
                        </div>
                      )}
                      {discount > 0 && (
                        <div className="flex justify-between text-red-400">
                          <span>- الخصم الممنوح:</span>
                          <span className="font-mono">-{discount.toLocaleString()} ريال</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-1.5">
                        <span>إجمالي الفاتورة على العميل:</span>
                        <span className="font-mono text-cyan-400">{totalSaleAmount.toLocaleString()} ريال</span>
                      </div>

                      <div className="flex justify-between text-slate-400 border-t border-slate-800/60 pt-1.5">
                        <span>- تكلفة المورد الأساسية:</span>
                        <span className="font-mono text-slate-300">-{cost.toLocaleString()} ريال</span>
                      </div>
                    </div>

                    <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-emerald-300 font-bold uppercase">صافي ربح الخدمة (Net Profit)</div>
                        <div className="text-xs text-slate-400">متاح للمصرح لهم فقط</div>
                      </div>
                      <div className="text-xl font-mono font-extrabold text-emerald-400">
                        +{netProfit.toLocaleString()} ريال
                      </div>
                    </div>

                    {totalSaleAmount < cost && (
                      <div className="bg-red-950/80 border border-red-500/50 rounded-xl p-2.5 flex items-center gap-2 text-red-200 text-xs">
                        <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                        <span>تحذير: العملية بأقل من سعر التكلفة وستتطلب اعتماداً إدارياً!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 5: PAYMENT & CREDIT ================= */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    الخطوة 5: طريقة الدفع والسداد (Cash, Credit & Partial Payments)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    إمكانية البيع النقدي، البيع الآجل للشركات، أو الدفع الجزئي مع ترحيل المتبقي لحساب العميل
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, payment_mode: "cash", paid_amount: totalSaleAmount }))}
                    className={`p-4 rounded-xl border text-right transition-all ${
                      form.payment_mode === "cash" 
                        ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/20" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-sm font-bold flex items-center justify-between">
                      <span>1. سداد كامل نقداً / شبكة</span>
                      <Receipt className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">تسوية كامل المبلغ ({totalSaleAmount.toLocaleString()} ريال) في الصندوق فوراً</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, payment_mode: "credit", paid_amount: 0 }))}
                    className={`p-4 rounded-xl border text-right transition-all ${
                      form.payment_mode === "credit" 
                        ? "border-blue-500 bg-blue-50 text-blue-950 font-bold ring-2 ring-blue-500/20" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-sm font-bold flex items-center justify-between">
                      <span>2. بيع آجل على الحساب</span>
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">ترحيل كامل المبلغ لذمة العميل/الشركة (مديونية)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, payment_mode: "partial", paid_amount: Math.round(totalSaleAmount / 2) }))}
                    className={`p-4 rounded-xl border text-right transition-all ${
                      form.payment_mode === "partial" 
                        ? "border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-500/20" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-sm font-bold flex items-center justify-between">
                      <span>3. دفعة مقدمة / سداد جزئي</span>
                      <DollarSign className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">دفع جزء نقداً وترحيل المتبقي لكشف حساب العميل</div>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">المبلغ المدفوع الآن (Paid Now) *</label>
                    <Input
                      type="number"
                      value={form.paid_amount}
                      onChange={e => setForm(f => ({ ...f, paid_amount: Number(e.target.value) }))}
                      className="font-mono font-bold text-emerald-700 text-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">المتبقي آجل (Remaining Debt)</label>
                    <div className="h-10 flex items-center px-3 rounded-md bg-white border font-mono font-bold text-red-600">
                      {remainingDebt.toLocaleString()} ريال
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">الصندوق / الخزينة المستلمة</label>
                    <select
                      value={form.safe_id}
                      onChange={e => setForm(f => ({ ...f, safe_id: Number(e.target.value) }))}
                      className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm"
                    >
                      {safes.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.currency || 'ريال'})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 6: CONFIRMATION & INVOICE ================= */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-primary" />
                    الخطوة 6: مراجعة وتأكيد الحجز وإصدار الفاتورة وقيد اليومية
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    فور الضغط على "تأكيد وإصدار"، سيتم توليد التذكرة، إيداع الدفعة في الخزينة، وتسجيل القيد المحاسبي المزدوج آلياً
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {/* Summary Card 1 */}
                  <div className="border rounded-xl p-4 bg-slate-50/70 space-y-2.5">
                    <h4 className="font-bold text-slate-800 text-xs border-b pb-1 text-primary">بيانات التذكرة والرحلة</h4>
                    <div className="flex justify-between"><span className="text-muted-foreground">العميل الحجاز:</span><span className="font-bold">{form.customer_name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">المسافر:</span><span className="font-bold">{form.passenger_name_ar} ({form.passenger_name_en})</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">جواز السفر:</span><span className="font-mono font-semibold">{form.passport_number || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">خط السير:</span><span className="font-bold">{form.origin_city} ⬅️ {form.destination_city}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">تاريخ الرحلة:</span><span className="font-mono">{form.departure_date} ({form.departure_time})</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">الناقل والدرجة:</span><span>{form.airline_supplier} - {form.travel_class}</span></div>
                  </div>

                  {/* Summary Card 2 */}
                  <div className="border rounded-xl p-4 bg-slate-50/70 space-y-2.5">
                    <h4 className="font-bold text-slate-800 text-xs border-b pb-1 text-emerald-700">الأثر المالي والمحاسبي</h4>
                    <div className="flex justify-between"><span className="text-muted-foreground">إجمالي قيمة الفاتورة:</span><span className="font-mono font-bold text-slate-900">{totalSaleAmount.toLocaleString()} ريال</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">سعر تكلفة المورد:</span><span className="font-mono text-slate-600">{cost.toLocaleString()} ريال</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">صافي ربح الوكالة:</span><span className="font-mono font-bold text-emerald-700">+{netProfit.toLocaleString()} ريال</span></div>
                    <div className="flex justify-between border-t pt-1.5"><span className="text-muted-foreground">المدفوع نقداً/بنك:</span><span className="font-mono font-bold text-blue-700">{paid.toLocaleString()} ريال</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">المتبقي آجل على العميل:</span><span className="font-mono font-bold text-red-600">{remainingDebt.toLocaleString()} ريال</span></div>
                    <div className="flex justify-between text-xs text-muted-foreground"><span>القيد المزدوج:</span><span>من حـ/ الصندوق والعميل إلى حـ/ المبيعات والموردين</span></div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">ملاحظات إضافية على الحجز والفاتورة</label>
                  <Input
                    value={form.booking_notes}
                    onChange={e => setForm(f => ({ ...f, booking_notes: e.target.value }))}
                    placeholder="شروط خاصة، سياسة أمتعة، رقم المقعد..."
                  />
                </div>
              </div>
            )}

            {/* Step Actions Toolbar */}
            <div className="flex items-center justify-between border-t pt-5 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="gap-2 font-bold"
              >
                <ArrowRight className="w-4 h-4" /> السابق
              </Button>

              {currentStep < 6 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-bold px-6"
                >
                  المتابعة للخطوة التالية <ArrowLeft className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => bookMutation.mutate()}
                  disabled={bookMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold px-8 text-base shadow-md"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {bookMutation.isPending ? "جاري إصدار الحجز والقيد..." : "تأكيد الحجز وإصدار الفاتورة النهائية"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Success Modal with Print Option */}
        <Dialog open={isSuccessModal} onOpenChange={setIsSuccessModal}>
          <DialogContent className="max-w-lg text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center text-slate-900">
                تم تأكيد الحجز وإصدار التذكرة بنجاح!
              </DialogTitle>
              <DialogDescription className="text-center">
                تم تسجيل التذكرة برقم PNR <span className="font-mono font-bold text-primary">{form.pnr}</span> وترحيل القيود المحاسبية
              </DialogDescription>
            </DialogHeader>

            <div className="bg-slate-50 border rounded-xl p-4 text-xs text-right space-y-2 font-sans my-3">
              <div className="flex justify-between"><span>العميل:</span><span className="font-bold">{form.customer_name}</span></div>
              <div className="flex justify-between"><span>المسافر:</span><span className="font-bold">{form.passenger_name_ar}</span></div>
              <div className="flex justify-between"><span>خط السير:</span><span className="font-bold">{form.origin_city} ⬅️ {form.destination_city}</span></div>
              <div className="flex justify-between"><span>إجمالي المبلغ:</span><span className="font-mono font-bold text-slate-900">{totalSaleAmount.toLocaleString()} ريال</span></div>
              <div className="flex justify-between"><span>المبلغ المحصل:</span><span className="font-mono font-bold text-emerald-700">{paid.toLocaleString()} ريال</span></div>
              {remainingDebt > 0 && (
                <div className="flex justify-between text-red-600"><span>المسجل آجل في كشف الحساب:</span><span className="font-mono font-bold">{remainingDebt.toLocaleString()} ريال</span></div>
              )}
            </div>

            <DialogFooter className="flex sm:justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsSuccessModal(false);
                  setCurrentStep(1);
                }}
                className="font-bold"
              >
                إجراء حجز جديد
              </Button>
              <Button
                onClick={() => {
                  window.print();
                }}
                className="bg-primary gap-2 font-bold"
              >
                <Printer className="w-4 h-4" /> طباعة إيصال وقسيمة التذكرة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

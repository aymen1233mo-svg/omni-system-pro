import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bus, Plus, Search, Edit2, Trash2, CheckCircle2, Clock, AlertCircle,
  FileText, CheckSquare, Printer, MessageCircle, UserPlus, Calendar,
  DollarSign, Building2, Eye, ShieldCheck, Share2, ArrowUpDown, RefreshCw,
  Coins, Download, FileSpreadsheet, MapPin, Tag, CreditCard, ChevronRight,
  User, Phone, Hash, Luggage, Navigation, Check, X, Filter, Send, AlertTriangle
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

// Available Currencies
const CURRENCIES = [
  { code: "SAR", symbol: "ر.س", label: "ريال سعودي (SAR)", flag: "🇸🇦", rateToSar: 1 },
  { code: "USD", symbol: "$", label: "دولار أمريكي (USD)", flag: "🇺🇸", rateToSar: 3.75 },
  { code: "YER", symbol: "ر.ي", label: "ريال يمني (YER)", flag: "🇾🇪", rateToSar: 0.00263 },
  { code: "AED", symbol: "د.إ", label: "درهم إماراتي (AED)", flag: "🇦🇪", rateToSar: 1.02 },
  { code: "EUR", symbol: "€", label: "يورو أوروبي (EUR)", flag: "🇪🇺", rateToSar: 4.10 },
  { code: "KWD", symbol: "د.ك", label: "دينار كويتي (KWD)", flag: "🇰🇼", rateToSar: 12.25 },
  { code: "EGP", symbol: "ج.م", label: "جنيه مصري (EGP)", flag: "🇪🇬", rateToSar: 0.076 },
  { code: "QAR", symbol: "ر.ق", label: "ريال قطري (QAR)", flag: "🇶🇦", rateToSar: 1.03 },
  { code: "OMR", symbol: "ر.ع", label: "ريال عماني (OMR)", flag: "🇴🇲", rateToSar: 9.75 },
  { code: "BHD", symbol: "د.ب", label: "دينار بحريني (BHD)", flag: "🇧🇭", rateToSar: 9.95 },
  { code: "JOD", symbol: "د.أ", label: "دينار أردني (JOD)", flag: "🇯🇴", rateToSar: 5.29 }
];

// Bus Service Types
const BUS_SERVICE_TYPES = [
  "حافلة VIP فاخرة",
  "درجة أولى رجال أعمال",
  "حافلة سرير نوم (Sleeper)",
  "حافلة بولمان سياحية عادية",
  "حافلة دولية مباشرة",
  "ميني باص HiAce سياحي",
  "حافلة كوستر Coaster",
  "سيارة نقل بري خاصة (ليموزين دولي)"
];

// Popular Bus Routes & Stations
const POPULAR_CITIES = [
  "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر",
  "أبها", "خميس مشيط", "جازان", "تبوك", "حائل", "نجران", "الطائف", "ينبع",
  "صنعاء", "عدن", "تعز", "المكلا", "سيئون", "الغيضة", "مأرب",
  "دبي", "أبوظبي", "الشارقة", "المنامة", "الكويت", "مسقط", "صلالة", "عمان", "القاهرة"
];

const BUS_STATUS: Record<string, { label: string; class: string; icon: string }> = {
  confirmed: { label: "مؤكدة ومصدرة ✅", class: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold", icon: "✅" },
  pending: { label: "قيد الحجز والتأكيد ⏳", class: "bg-blue-100 text-blue-900 border-blue-300", icon: "⏳" },
  waiting_payment: { label: "بانتظار السداد ⚠️", class: "bg-amber-100 text-amber-900 border-amber-300 font-semibold", icon: "⚠️" },
  completed: { label: "منفذة / مكتملة 🏁", class: "bg-indigo-100 text-indigo-900 border-indigo-300", icon: "🏁" },
  cancelled: { label: "ملغاة ❌", class: "bg-red-100 text-red-900 border-red-300", icon: "❌" },
  refunded: { label: "مسترجعة 🔄", class: "bg-purple-100 text-purple-900 border-purple-300", icon: "🔄" }
};

const PAYMENT_METHODS: Record<string, { label: string; badge: string }> = {
  cash: { label: "نقداً (Cash)", badge: "bg-green-50 text-green-700 border-green-200" },
  credit: { label: "آجل / على الحساب (Credit)", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  bank_transfer: { label: "تحويل بنكي (Bank)", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  pos: { label: "شبكة / مدى (POS)", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  cheque: { label: "شيك بنكي (Cheque)", badge: "bg-slate-50 text-slate-700 border-slate-200" },
  wallet: { label: "محفظة / رصيد (Wallet)", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" }
};

const SUPPLIER_PAYMENT_METHODS = [
  { id: "credit", label: "آجل / على حساب المورد (Credit)" },
  { id: "cash", label: "نقداً من الصندوق (Cash)" },
  { id: "bank_transfer", label: "تحويل بنكي للمورد (Bank Transfer)" },
  { id: "cheque", label: "شيك بنكي (Cheque)" },
  { id: "wallet", label: "خصم من رصيد المورد (Wallet)" }
];

export default function TravelBusTicketsPage() {
  const qc = useQueryClient();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [tripTypeFilter, setTripTypeFilter] = useState("all");

  // Selected Booking for Bottom Actions
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any | null>(null);

  // Quick Customer modal
  const [quickCustomerModalOpen, setQuickCustomerModalOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({ name: "", phone: "", customer_type: "individual", affiliation_type: "direct" });

  // Quick Passenger modal
  const [quickPassengerModalOpen, setQuickPassengerModalOpen] = useState(false);
  const [quickPassengerForm, setQuickPassengerForm] = useState({ name_ar: "", name_en: "", passport_number: "", phone: "", nationality: "سعودي" });

  const [quickCompanyModalOpen, setQuickCompanyModalOpen] = useState(false);
  const [quickCompanyForm, setQuickCompanyForm] = useState({ name: "", phone: "", notes: "" });

  const [printBooking, setPrintBooking] = useState<any | null>(null);

  const initialForm = {
    booking_number: `BUS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
    ticket_number: `TKT-BUS-${Math.floor(100000 + Math.random() * 900000)}`,
    pnr_number: `PNR-LND-${Math.floor(1000 + Math.random() * 9000)}`,
    trip_type: "one_way",
    bus_type: "حافلة VIP فاخرة",
    bus_number: "",
    seat_number: "",

    customer_id: "",
    customer_name: "",
    passenger_id: "",
    passenger_name: "",
    passenger_phone: "",
    passenger_national_id: "",
    selling_price: "350",
    customer_currency: "SAR",
    customer_statement: "قيمة تذكرة نقل بري (الرياض -> جدة)",
    payment_method: "cash",
    payment_status: "paid",
    paid_amount: "350",
    remaining_balance: "0",

    company_id: "",
    company_name: "",
    cost_price: "280",
    supplier_currency: "SAR",
    supplier_statement: "تكلفة حجز مقعد حافلة نقل بري",
    supplier_payment_method: "credit",
    supplier_payment_status: "unpaid",
    supplier_paid_amount: "0",
    supplier_remaining_balance: "280",

    agency_commission: "70",
    commission_currency: "SAR",
    commission_statement: "عمولة وربح حجز تذكرة نقل بري",
    exchange_rate: "1",

    origin_city: "الرياض",
    origin_station: "محطة العزيزية الرئيسية",
    destination_city: "جدة",
    destination_station: "محطة البلد المركزية",
    departure_date: new Date().toISOString().slice(0, 10),
    departure_time: "08:00",
    boarding_time: "07:30",
    arrival_date: new Date().toISOString().slice(0, 10),
    arrival_time: "18:00",
    return_departure_date: "",
    luggage_weight: "30",
    luggage_pieces: "2",

    status: "confirmed",
    issue_date: new Date().toISOString().slice(0, 10),
    notes: ""
  };

  const [form, setForm] = useState<any>(initialForm);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<any[]>({
    queryKey: ["travel-bus-bookings", search, statusFilter, companyFilter, currencyFilter, paymentFilter, tripTypeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (companyFilter !== "all") params.append("company_id", companyFilter);
      if (currencyFilter !== "all") params.append("currency", currencyFilter);
      if (paymentFilter !== "all") params.append("payment_status", paymentFilter);
      if (tripTypeFilter !== "all") params.append("trip_type", tripTypeFilter);
      return fetchWithAuth(`/api/travel/bus-bookings?${params.toString()}`);
    }
  });

  const { data: statsData } = useQuery<any>({
    queryKey: ["travel-bus-bookings-stats"],
    queryFn: () => fetchWithAuth("/api/travel/bus-bookings/stats")
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers-list"],
    queryFn: () => fetchWithAuth("/api/customers")
  });

  const { data: passengers = [] } = useQuery<any[]>({
    queryKey: ["passengers-list"],
    queryFn: () => fetchWithAuth("/api/travel/passengers")
  });

  const { data: transportCompanies = [] } = useQuery<any[]>({
    queryKey: ["transport-companies-list"],
    queryFn: () => fetchWithAuth("/api/travel/transport-companies")
  });

  const selectedBooking = useMemo(() => (bookings || []).find((b: any) => b.id === selectedBookingId), [bookings, selectedBookingId]);

  const selectedCustomerObj = useMemo(() => {
    if (!form.customer_id) return null;
    return customers.find((c: any) => String(c.id) === String(form.customer_id)) || null;
  }, [customers, form.customer_id]);

  const selectedCustomerAffiliation = selectedCustomerObj?.affiliation_type || 'direct';

  const [saveError, setSaveError] = useState<string | null>(null);

  const saveBookingMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingBooking?.id) {
        return fetchWithAuth(`/api/travel/bus-bookings/${editingBooking.id}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return fetchWithAuth("/api/travel/bus-bookings", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-bus-bookings"] });
      qc.invalidateQueries({ queryKey: ["travel-bus-bookings-stats"] });
      setSaveError(null);
      setModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setSaveError(err?.message || "تعذر حفظ الحجز. يرجى التحقق من المدخلات المطلوبة.");
    }
  });

  const deleteBookingMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/travel/bus-bookings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-bus-bookings"] });
      qc.invalidateQueries({ queryKey: ["travel-bus-bookings-stats"] });
      setSelectedBookingId(null);
    }
  });

  const confirmBookingMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/travel/bus-bookings/${id}/confirm`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-bus-bookings"] });
      qc.invalidateQueries({ queryKey: ["travel-bus-bookings-stats"] });
    }
  });

  const issueBookingMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/travel/bus-bookings/${id}/issue`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-bus-bookings"] });
      qc.invalidateQueries({ queryKey: ["travel-bus-bookings-stats"] });
    }
  });

  const quickCustomerMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/customers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (created: any) => {
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      setQuickCustomerModalOpen(false);
      setQuickCustomerForm({ name: "", phone: "", customer_type: "individual", affiliation_type: "direct" });
      if (created?.id) {
        setForm((prev: any) => ({ ...prev, customer_id: String(created.id), customer_name: created.name }));
      }
    }
  });

  const quickPassengerMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/travel/passengers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (created: any) => {
      qc.invalidateQueries({ queryKey: ["passengers-list"] });
      setQuickPassengerModalOpen(false);
      setQuickPassengerForm({ name_ar: "", name_en: "", passport_number: "", phone: "", nationality: "سعودي" });
      if (created?.id) {
        setForm((prev: any) => ({
          ...prev,
          passenger_id: String(created.id),
          passenger_name: created.name_ar,
          passenger_phone: created.phone || "",
          passenger_national_id: created.passport_number || ""
        }));
      }
    }
  });

  const quickCompanyMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/travel/transport-companies", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (created: any) => {
      qc.invalidateQueries({ queryKey: ["transport-companies-list"] });
      setQuickCompanyModalOpen(false);
      setQuickCompanyForm({ name: "", phone: "", notes: "" });
      if (created?.id) {
        setForm((prev: any) => ({ ...prev, company_id: String(created.id), company_name: created.name }));
      }
    }
  });

  const handleCustomerSelect = (customerId: string) => {
    const cust = (customers || []).find((c: any) => String(c.id) === customerId);
    setForm((prev: any) => ({
      ...prev,
      customer_id: customerId,
      customer_name: cust?.name || ""
    }));
  };

  const handlePassengerSelect = (passengerId: string) => {
    const pass = (passengers || []).find((p: any) => String(p.id) === passengerId);
    setForm((prev: any) => ({
      ...prev,
      passenger_id: passengerId,
      passenger_name: pass?.name_ar || pass?.name_en || "",
      passenger_phone: pass?.phone || prev.passenger_phone,
      passenger_national_id: pass?.passport_number || prev.passenger_national_id
    }));
  };

  const handleCompanySelect = (companyId: string) => {
    const comp = (transportCompanies || []).find((c: any) => String(c.id) === companyId);
    setForm((prev: any) => ({
      ...prev,
      company_id: companyId,
      company_name: comp?.name || ""
    }));
  };

  const handleSellingPriceChange = (val: string) => {
    const sell = Number(val) || 0;
    const cost = Number(form.cost_price) || 0;
    const comm = sell - cost;
    setForm((prev: any) => {
      let paid = prev.paid_amount;
      let rem = prev.remaining_balance;
      if (prev.payment_status === "paid") {
        paid = String(sell);
        rem = "0";
      } else if (prev.payment_status === "unpaid") {
        paid = "0";
        rem = String(sell);
      } else {
        rem = String(Math.max(0, sell - (Number(paid) || 0)));
      }
      return {
        ...prev,
        selling_price: val,
        paid_amount: paid,
        remaining_balance: rem,
        agency_commission: String(comm)
      };
    });
  };

  const handlePaymentMethodChange = (method: string) => {
    const sell = Number(form.selling_price) || 0;
    if (method === "credit") {
      setForm((prev: any) => ({
        ...prev,
        payment_method: method,
        paid_amount: "0",
        remaining_balance: String(sell),
        payment_status: "unpaid"
      }));
    } else {
      setForm((prev: any) => ({
        ...prev,
        payment_method: method,
        paid_amount: String(sell),
        remaining_balance: "0",
        payment_status: "paid"
      }));
    }
  };

  const handleSupplierPaymentMethodChange = (method: string) => {
    const cost = Number(form.cost_price) || 0;
    if (method === "credit") {
      setForm((prev: any) => ({
        ...prev,
        supplier_payment_method: method,
        supplier_paid_amount: "0",
        supplier_remaining_balance: String(cost),
        supplier_payment_status: "unpaid"
      }));
    } else {
      setForm((prev: any) => ({
        ...prev,
        supplier_payment_method: method,
        supplier_paid_amount: String(cost),
        supplier_remaining_balance: "0",
        supplier_payment_status: "paid"
      }));
    }
  };

  const handleCustomerPaymentStatusChange = (status: string) => {
    const sell = Number(form.selling_price) || 0;
    if (status === "paid") {
      setForm((prev: any) => ({ ...prev, payment_status: status, paid_amount: String(sell), remaining_balance: "0" }));
    } else if (status === "unpaid") {
      setForm((prev: any) => ({ ...prev, payment_status: status, paid_amount: "0", remaining_balance: String(sell) }));
    } else {
      const paid = Number(form.paid_amount) || 0;
      setForm((prev: any) => ({ ...prev, payment_status: status, remaining_balance: String(Math.max(0, sell - paid)) }));
    }
  };

  const handlePaymentStatusChange = (status: string) => {
    handleCustomerPaymentStatusChange(status);
  };

  const handlePaidAmountChange = (val: string) => {
    const paid = Number(val) || 0;
    const sell = Number(form.selling_price) || 0;
    const rem = Math.max(0, sell - paid);
    let status = form.payment_status;
    if (paid >= sell && sell > 0) status = "paid";
    else if (paid > 0) status = "partial";
    else status = "unpaid";
    setForm((prev: any) => ({
      ...prev,
      paid_amount: val,
      remaining_balance: String(rem),
      payment_status: status
    }));
  };

  const handleCostPriceChange = (val: string) => {
    const cost = Number(val) || 0;
    const sell = Number(form.selling_price) || 0;
    const comm = sell - cost;
    setForm((prev: any) => {
      let paid = prev.supplier_paid_amount;
      let rem = prev.supplier_remaining_balance;
      if (prev.supplier_payment_status === "paid") {
        paid = String(cost);
        rem = "0";
      } else if (prev.supplier_payment_status === "unpaid") {
        paid = "0";
        rem = String(cost);
      } else {
        rem = String(Math.max(0, cost - (Number(paid) || 0)));
      }
      return {
        ...prev,
        cost_price: val,
        supplier_paid_amount: paid,
        supplier_remaining_balance: rem,
        agency_commission: String(comm)
      };
    });
  };

  const handleSupplierPaymentStatusChange = (status: string) => {
    const cost = Number(form.cost_price) || 0;
    if (status === "paid") {
      setForm((prev: any) => ({ ...prev, supplier_payment_status: status, supplier_paid_amount: String(cost), supplier_remaining_balance: "0" }));
    } else if (status === "unpaid") {
      setForm((prev: any) => ({ ...prev, supplier_payment_status: status, supplier_paid_amount: "0", supplier_remaining_balance: String(cost) }));
    } else {
      const paid = Number(form.supplier_paid_amount) || 0;
      setForm((prev: any) => ({ ...prev, supplier_payment_status: status, supplier_remaining_balance: String(Math.max(0, cost - paid)) }));
    }
  };

  const handleCurrencyChange = (curr: string) => {
    setForm((prev: any) => ({
      ...prev,
      customer_currency: curr,
      supplier_currency: curr,
      commission_currency: curr
    }));
  };

  const resetForm = () => {
    setEditingBooking(null);
    setForm({
      booking_number: `BUS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      ticket_number: `TKT-BUS-${Math.floor(100000 + Math.random() * 900000)}`,
      pnr_number: `PNR-LND-${Math.floor(1000 + Math.random() * 9000)}`,
      trip_type: "one_way",
      bus_type: "حافلة VIP فاخرة",
      bus_number: "",
      seat_number: "",

      customer_id: "",
      customer_name: "",
      passenger_id: "",
      passenger_name: "",
      passenger_phone: "",
      passenger_national_id: "",
      selling_price: "350",
      customer_currency: "SAR",
      customer_statement: "قيمة تذكرة نقل بري (الرياض -> جدة)",
      payment_method: "cash",
      payment_status: "paid",
      paid_amount: "350",
      remaining_balance: "0",

      company_id: "",
      company_name: "",
      cost_price: "280",
      supplier_currency: "SAR",
      supplier_statement: "تكلفة حجز مقعد حافلة نقل بري",
      supplier_payment_method: "credit",
      supplier_payment_status: "unpaid",
      supplier_paid_amount: "0",
      supplier_remaining_balance: "280",

      agency_commission: "70",
      commission_currency: "SAR",
      commission_statement: "عمولة وربح حجز تذكرة نقل بري",
      exchange_rate: "1",

      origin_city: "الرياض",
      origin_station: "محطة العزيزية الرئيسية",
      destination_city: "جدة",
      destination_station: "محطة البلد المركزية",
      departure_date: new Date().toISOString().slice(0, 10),
      departure_time: "08:00",
      boarding_time: "07:30",
      arrival_date: new Date().toISOString().slice(0, 10),
      arrival_time: "18:00",
      return_departure_date: "",
      luggage_weight: "30",
      luggage_pieces: "2",

      status: "confirmed",
      issue_date: new Date().toISOString().slice(0, 10),
      notes: ""
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleEdit = (bk: any) => {
    setEditingBooking(bk);
    setForm({
      booking_number: bk.booking_number || "",
      ticket_number: bk.ticket_number || "",
      pnr_number: bk.pnr_number || "",
      trip_type: bk.trip_type || "one_way",
      bus_type: bk.bus_type || "حافلة VIP فاخرة",
      bus_number: bk.bus_number || "",
      seat_number: bk.seat_number || "",

      customer_id: bk.customer_id ? String(bk.customer_id) : "",
      customer_name: bk.customer_name || bk.customer_name_joined || "",
      passenger_id: bk.passenger_id ? String(bk.passenger_id) : "",
      passenger_name: bk.passenger_name || bk.passenger_name_joined || "",
      passenger_phone: bk.passenger_phone || bk.passenger_phone_joined || "",
      passenger_national_id: bk.passenger_national_id || bk.passenger_passport_joined || "",
      selling_price: String(bk.selling_price || 0),
      customer_currency: bk.customer_currency || "SAR",
      customer_statement: bk.customer_statement || "",
      payment_method: bk.payment_method || "cash",
      payment_status: bk.payment_status || "paid",
      paid_amount: String(bk.paid_amount !== undefined ? bk.paid_amount : bk.selling_price || 0),
      remaining_balance: String(bk.remaining_balance || 0),

      company_id: bk.company_id ? String(bk.company_id) : "",
      company_name: bk.company_name || bk.company_name_joined || "",
      cost_price: String(bk.cost_price || 0),
      supplier_currency: bk.supplier_currency || "SAR",
      supplier_statement: bk.supplier_statement || "",
      supplier_payment_method: bk.supplier_payment_method || "credit",
      supplier_payment_status: bk.supplier_payment_status || "unpaid",
      supplier_paid_amount: String(bk.supplier_paid_amount || 0),
      supplier_remaining_balance: String(bk.supplier_remaining_balance !== undefined ? bk.supplier_remaining_balance : bk.cost_price || 0),

      agency_commission: String(bk.agency_commission || (Number(bk.selling_price || 0) - Number(bk.cost_price || 0))),
      commission_currency: bk.commission_currency || bk.customer_currency || "SAR",
      commission_statement: bk.commission_statement || "",
      exchange_rate: String(bk.exchange_rate || 1),

      origin_city: bk.origin_city || "",
      origin_station: bk.origin_station || "",
      destination_city: bk.destination_city || "",
      destination_station: bk.destination_station || "",
      departure_date: bk.departure_date || "",
      departure_time: bk.departure_time || "",
      boarding_time: bk.boarding_time || "",
      arrival_date: bk.arrival_date || "",
      arrival_time: bk.arrival_time || "",
      return_departure_date: bk.return_departure_date || "",
      luggage_weight: String(bk.luggage_weight || 30),
      luggage_pieces: String(bk.luggage_pieces || 2),

      status: bk.status || "confirmed",
      issue_date: bk.issue_date || new Date().toISOString().slice(0, 10),
      notes: bk.notes || ""
    });
    setModalOpen(true);
  };

  const handlePrint = (bk: any) => {
    setPrintBooking(bk);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!bookings.length) return;
    const headers = [
      "رقم الحجز", "رقم التذكرة", "رقم PNR", "العميل", "المسافر", "شركة النقل البري",
      "مسار الرحلة", "تاريخ التحرك", "نوع الباص", "رقم المقعد",
      "سعر البيع", "عملة البيع", "بيان العميل",
      "سعر التكلفة", "عملة التكلفة", "بيان شركة النقل",
      "عمولة المكتب", "بيان العمولة",
      "طريقة الدفع", "حالة الدفع", "الحالة"
    ];

    const rows = bookings.map(b => [
      b.booking_number,
      b.ticket_number,
      b.pnr_number,
      b.customer_name || b.customer_name_joined || "-",
      b.passenger_name || b.passenger_name_joined || "-",
      b.company_name || b.company_name_joined || "-",
      `${b.origin_city || ""} -> ${b.destination_city || ""}`,
      `${b.departure_date || ""} ${b.departure_time || ""}`,
      b.bus_type || "-",
      b.seat_number || "-",
      b.selling_price || 0,
      b.customer_currency || "SAR",
      `"${(b.customer_statement || "").replace(/"/g, '""')}"`,
      b.cost_price || 0,
      b.supplier_currency || "SAR",
      `"${(b.supplier_statement || "").replace(/"/g, '""')}"`,
      b.agency_commission || 0,
      `"${(b.commission_statement || "").replace(/"/g, '""')}"`,
      PAYMENT_METHODS[b.payment_method]?.label || b.payment_method,
      b.payment_status === "paid" ? "مدفوع" : "آجل",
      BUS_STATUS[b.status]?.label || b.status
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `حجوزات_تذاكر_النقل_البري_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-28 text-right" dir="rtl">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-l from-emerald-900 via-teal-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-emerald-700/30">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 backdrop-blur-md rounded-xl border border-emerald-400/30 text-emerald-300">
                <Bus className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  حجوزات وتذاكر النقل البري والباصات
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 font-mono">
                    Land Transport Tickets
                  </span>
                </h1>
                <p className="text-sm text-emerald-100/80">
                  إدارة شاملة لحجوزات الحافلات وخطوط النقل البري بنظام الطرفين (العميل والشركة)، وتعدد العملات، وتتبع العمولات وبيانات المحطات.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              id="btn-add-bus-booking-top"
              onClick={handleOpenAdd}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2 shadow-lg shadow-emerald-500/25 border border-emerald-400/30 px-5 py-2.5 h-auto text-base"
            >
              <Plus className="w-5 h-5" />
              إضافة حجز تذكرة جديد ➕
            </Button>
            <Button
              id="btn-add-transport-company-top"
              onClick={() => setQuickCompanyModalOpen(true)}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-medium gap-2"
            >
              <Building2 className="w-4 h-4 text-emerald-300" />
              إضافة شركة نقل بري 🏢
            </Button>
            <Button
              id="btn-export-bus-bookings-csv"
              onClick={handleExportCSV}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-medium gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-300" />
              تصدير كشف Excel 📊
            </Button>
            <Button
              id="btn-refresh-bus-bookings"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["travel-bus-bookings"] });
                qc.invalidateQueries({ queryKey: ["travel-bus-bookings-stats"] });
              }}
              variant="ghost"
              className="text-emerald-200 hover:text-white hover:bg-white/10 p-2.5"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Currency Financial Stats Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Total Volume */}
          <Card className="border-emerald-200/60 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-800">إجمالي تذاكر النقل البري</p>
                  <h3 className="text-3xl font-black text-emerald-950 mt-1">{statsData?.total_count || bookings.length}</h3>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">حجز مسجل بالنظام</p>
                </div>
                <div className="p-3.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                  <Bus className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SAR Financials */}
          {(() => {
            const sarStat = statsData?.currency_stats?.find((s: any) => s.currency === "SAR") || {
              total_sales: bookings.filter(b => (b.customer_currency || "SAR") === "SAR").reduce((acc, b) => acc + (b.selling_price || 0), 0),
              total_cost: bookings.filter(b => (b.customer_currency || "SAR") === "SAR").reduce((acc, b) => acc + (b.cost_price || 0), 0),
              total_commission: bookings.filter(b => (b.customer_currency || "SAR") === "SAR").reduce((acc, b) => acc + (b.agency_commission || 0), 0)
            };
            return (
              <Card className="border-blue-200/60 shadow-sm bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🇸🇦</span>
                        <p className="text-xs font-bold text-blue-900">الريال السعودي (SAR)</p>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-black text-blue-950">{Number(sarStat.total_sales || 0).toLocaleString()}</span>
                        <span className="text-xs text-blue-700 font-bold">ر.س مبيعات</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs pt-1 border-t border-blue-100">
                        <span className="text-slate-600">التكلفة: <b className="text-slate-900">{Number(sarStat.total_cost || 0).toLocaleString()}</b></span>
                        <span className="text-emerald-700 font-bold">العمولة: <b>{Number(sarStat.total_commission || 0).toLocaleString()}</b></span>
                      </div>
                    </div>
                    <div className="p-3 bg-blue-100 text-blue-800 rounded-2xl">
                      <DollarSign className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* USD Financials */}
          {(() => {
            const usdStat = statsData?.currency_stats?.find((s: any) => s.currency === "USD") || {
              total_sales: bookings.filter(b => b.customer_currency === "USD").reduce((acc, b) => acc + (b.selling_price || 0), 0),
              total_cost: bookings.filter(b => b.customer_currency === "USD").reduce((acc, b) => acc + (b.cost_price || 0), 0),
              total_commission: bookings.filter(b => b.customer_currency === "USD").reduce((acc, b) => acc + (b.agency_commission || 0), 0)
            };
            return (
              <Card className="border-teal-200/60 shadow-sm bg-gradient-to-br from-teal-50 to-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🇺🇸</span>
                        <p className="text-xs font-bold text-teal-900">الدولار الأمريكي (USD)</p>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-black text-teal-950">${Number(usdStat.total_sales || 0).toLocaleString()}</span>
                        <span className="text-xs text-teal-700 font-bold">مبيعات</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs pt-1 border-t border-teal-100">
                        <span className="text-slate-600">التكلفة: <b className="text-slate-900">${Number(usdStat.total_cost || 0).toLocaleString()}</b></span>
                        <span className="text-emerald-700 font-bold">العمولة: <b>${Number(usdStat.total_commission || 0).toLocaleString()}</b></span>
                      </div>
                    </div>
                    <div className="p-3 bg-teal-100 text-teal-800 rounded-2xl">
                      <Coins className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* YER Financials */}
          {(() => {
            const yerStat = statsData?.currency_stats?.find((s: any) => s.currency === "YER") || {
              total_sales: bookings.filter(b => b.customer_currency === "YER").reduce((acc, b) => acc + (b.selling_price || 0), 0),
              total_cost: bookings.filter(b => b.customer_currency === "YER").reduce((acc, b) => acc + (b.cost_price || 0), 0),
              total_commission: bookings.filter(b => b.customer_currency === "YER").reduce((acc, b) => acc + (b.agency_commission || 0), 0)
            };
            return (
              <Card className="border-amber-200/60 shadow-sm bg-gradient-to-br from-amber-50 to-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🇾🇪</span>
                        <p className="text-xs font-bold text-amber-900">الريال اليمني (YER)</p>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-black text-amber-950">{Number(yerStat.total_sales || 0).toLocaleString()}</span>
                        <span className="text-xs text-amber-700 font-bold">ر.ي مبيعات</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs pt-1 border-t border-amber-100">
                        <span className="text-slate-600">التكلفة: <b className="text-slate-900">{Number(yerStat.total_cost || 0).toLocaleString()}</b></span>
                        <span className="text-emerald-700 font-bold">العمولة: <b>{Number(yerStat.total_commission || 0).toLocaleString()}</b></span>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                      <CreditCard className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>

        {/* Filter and Search Box */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Search Bar */}
              <div className="lg:col-span-2 relative">
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  id="input-search-bus-bookings"
                  placeholder="بحث برقم التذكرة، الحجز، العميل، شركة النقل، المسار، المقعد..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pr-9 bg-slate-50 border-slate-200 text-sm"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  id="select-status-filter"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">جميع الحالات (All Statuses)</option>
                  <option value="confirmed">مؤكدة ومصدرة ✅</option>
                  <option value="pending">قيد الحجز والتأكيد ⏳</option>
                  <option value="waiting_payment">بانتظار السداد ⚠️</option>
                  <option value="completed">منفذة / مكتملة 🏁</option>
                  <option value="cancelled">ملغاة ❌</option>
                  <option value="refunded">مسترجعة 🔄</option>
                </select>
              </div>

              {/* Company Filter (الطرف الثاني) */}
              <div>
                <select
                  id="select-company-filter"
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">جميع شركات النقل البري (الطرف الثاني)</option>
                  {transportCompanies.map((c: any, idx: number) => (
                    <option key={`bus-filter-comp-${c.id || idx}-${idx}`} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Currency Filter */}
              <div>
                <select
                  id="select-currency-filter"
                  value={currencyFilter}
                  onChange={e => setCurrencyFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">جميع العملات (All Currencies)</option>
                  <option value="SAR">🇸🇦 ريال سعودي (SAR)</option>
                  <option value="USD">🇺🇸 دولار أمريكي (USD)</option>
                  <option value="YER">🇾🇪 ريال يمني (YER)</option>
                </select>
              </div>

              {/* Payment Method Filter */}
              <div>
                <select
                  id="select-payment-filter"
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">جميع طرق الدفع (Payment Methods)</option>
                  <option value="cash">نقداً (Cash)</option>
                  <option value="credit">آجل / على الحساب (Credit)</option>
                  <option value="bank_transfer">تحويل بنكي (Bank Transfer)</option>
                  <option value="pos">شبكة / مدى (POS)</option>
                  <option value="cheque">شيك بنكي (Cheque)</option>
                  <option value="wallet">خصم من المحفظة (Wallet)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bus Bookings Table List */}
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <Bus className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-base">قائمة معاملات وحجوزات تذاكر النقل البري</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {bookings.length} معاملة
              </span>
            </div>
            <p className="text-xs text-slate-500">
              * انقر على أي سطر لتحديده وتطبيق إجراءات الطباعة أو التعديل السريعة
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 text-xs font-bold border-b border-slate-200">
                  <th className="py-3.5 px-4">رقم المعاملة / التذكرة</th>
                  <th className="py-3.5 px-4">الطرف الأول (العميل والمسافر)</th>
                  <th className="py-3.5 px-4">الطرف الثاني (شركة النقل البري)</th>
                  <th className="py-3.5 px-4">مسار الرحلة والمواعيد</th>
                  <th className="py-3.5 px-4">تفاصيل الحافلة والمقعد</th>
                  <th className="py-3.5 px-4">المبالغ ونظام الطرفين والعمولة</th>
                  <th className="py-3.5 px-4">طريقة وحالة الدفع</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {bookingsLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
                        <span>جاري تحميل بيانات تذاكر النقل البري...</span>
                      </div>
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                          <Bus className="w-10 h-10" />
                        </div>
                        <p className="text-base font-medium text-slate-600">لا توجد حجوزات تذاكر نقل بري مطابقة للبحث</p>
                        <Button
                          id="btn-empty-add-bus"
                          onClick={handleOpenAdd}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold"
                        >
                          <Plus className="w-4 h-4" />
                          إضافة أول حجز نقل بري الآن ➕
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  bookings.map((bk: any, idx: number) => {
                    const isSelected = selectedBookingId === bk.id;
                    const statusObj = BUS_STATUS[bk.status] || { label: bk.status, class: "bg-slate-100 text-slate-800" };
                    const payMethodObj = PAYMENT_METHODS[bk.payment_method] || { label: bk.payment_method, badge: "bg-slate-100 text-slate-800" };

                    return (
                      <tr
                        key={`bus-bk-${bk.id || idx}-${idx}`}
                        id={`bus-row-${bk.id}`}
                        onClick={() => setSelectedBookingId(bk.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-50/80 border-r-4 border-emerald-600 font-medium"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        {/* Booking & Ticket Number */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className="font-mono font-bold text-slate-900 text-sm block">
                              {bk.booking_number}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-emerald-700 font-mono">
                              <Tag className="w-3 h-3" />
                              <span>{bk.ticket_number || "TKT-PENDING"}</span>
                            </div>
                            {bk.pnr_number && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                PNR: {bk.pnr_number}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* First Party: Customer & Passenger */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-blue-600" />
                              <span>{bk.customer_name || bk.customer_name_joined || "عميل نقدي"}</span>
                            </div>
                            {(bk.passenger_name || bk.passenger_name_joined) && (
                              <p className="text-xs text-slate-600">
                                الراكب: <span className="font-semibold text-slate-800">{bk.passenger_name || bk.passenger_name_joined}</span>
                              </p>
                            )}
                            {(bk.passenger_phone || bk.customer_phone_joined) && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3" />
                                {bk.passenger_phone || bk.customer_phone_joined}
                              </p>
                            )}
                            {bk.customer_statement && (
                              <p className="text-[11px] text-blue-800 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100 line-clamp-1 max-w-[200px]" title={bk.customer_statement}>
                                📝 {bk.customer_statement}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Second Party: Transport Company */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{bk.company_name || bk.company_name_joined || "شركة نقل بري"}</span>
                            </div>
                            {bk.company_phone_joined && (
                              <p className="text-xs text-slate-500 font-mono">
                                📞 {bk.company_phone_joined}
                              </p>
                            )}
                            {bk.supplier_statement && (
                              <p className="text-[11px] text-emerald-800 bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-100 line-clamp-1 max-w-[200px]" title={bk.supplier_statement}>
                                🏷️ {bk.supplier_statement}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Route & Schedule */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 font-bold text-slate-900 text-xs">
                              <span className="text-blue-700">{bk.origin_city || "الرياض"}</span>
                              <span className="text-slate-400">⬅️</span>
                              <span className="text-emerald-700">{bk.destination_city || "جدة"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {bk.departure_date}
                              </span>
                              {bk.departure_time && (
                                <span className="flex items-center gap-1 font-mono text-slate-700 font-semibold">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {bk.departure_time}
                                </span>
                              )}
                            </div>
                            {bk.trip_type === "round_trip" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                                🔁 ذهاب وعودة {bk.return_departure_date ? `(${bk.return_departure_date})` : ""}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Bus & Seat */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1 text-xs">
                            <span className="font-semibold text-slate-800 block">
                              {bk.bus_type || "حافلة VIP"}
                            </span>
                            <div className="flex items-center gap-2">
                              {bk.seat_number && (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-200">
                                  مقعد: {bk.seat_number}
                                </span>
                              )}
                              {bk.bus_number && (
                                <span className="text-slate-600 font-mono">
                                  باص: {bk.bus_number}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Luggage className="w-3 h-3" />
                              أمتعة: {bk.luggage_weight || 30} كجم ({bk.luggage_pieces || 2} حقيبة)
                            </span>
                          </div>
                        </td>

                        {/* Financials & Two-Party Accounting & Commission */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-600">سعر البيع (العميل):</span>
                              <span className="font-bold text-blue-900 font-mono">
                                {Number(bk.selling_price || 0).toLocaleString()} {bk.customer_currency || "SAR"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-slate-500">
                              <span>التكلفة (الشركة):</span>
                              <span className="font-mono">
                                {Number(bk.cost_price || 0).toLocaleString()} {bk.supplier_currency || bk.customer_currency || "SAR"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                              <span className="font-bold text-emerald-700">عمولة المكتب:</span>
                              <span className="font-black text-emerald-700 font-mono">
                                +{Number(bk.agency_commission || 0).toLocaleString()} {bk.commission_currency || bk.customer_currency || "SAR"}
                              </span>
                            </div>
                            {bk.commission_statement && (
                              <p className="text-[10px] text-emerald-700 italic truncate max-w-[180px]" title={bk.commission_statement}>
                                {bk.commission_statement}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Payment Method & Status */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${payMethodObj.badge}`}>
                              {payMethodObj.label}
                            </span>
                            <div>
                              {bk.payment_status === "paid" ? (
                                <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> مدفوع بالكامل
                                </span>
                              ) : (
                                <span className="text-xs text-amber-700 font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> آجل ({Number(bk.remaining_balance || bk.selling_price || 0).toLocaleString()} {bk.customer_currency})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-block text-xs px-2.5 py-1 rounded-full border font-bold ${statusObj.class}`}>
                            {statusObj.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                            {bk.status !== "confirmed" && (
                              <Button
                                id={`btn-confirm-bus-${bk.id}`}
                                size="sm"
                                variant="ghost"
                                onClick={() => confirmBookingMutation.mutate(bk.id)}
                                disabled={confirmBookingMutation.isPending}
                                className="text-emerald-700 hover:bg-emerald-50 h-8 w-8 p-0"
                                title="تأكيد الحجز فوراً"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              id={`btn-issue-bus-${bk.id}`}
                              size="sm"
                              variant="ghost"
                              onClick={() => issueBookingMutation.mutate(bk.id)}
                              disabled={issueBookingMutation.isPending}
                              className="text-purple-700 hover:bg-purple-50 h-8 w-8 p-0"
                              title="إصدار التذكرة والترحيل"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                            <Button
                              id={`btn-print-bus-${bk.id}`}
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePrint(bk)}
                              className="text-emerald-700 hover:bg-emerald-50 h-8 w-8 p-0"
                              title="طباعة واستعراض التذكرة"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              id={`btn-edit-bus-${bk.id}`}
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(bk)}
                              className="text-blue-700 hover:bg-blue-50 h-8 w-8 p-0"
                              title="تعديل المعاملة"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              id={`btn-delete-bus-${bk.id}`}
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف حجز التذكرة رقم ${bk.booking_number}؟`)) {
                                  deleteBookingMutation.mutate(bk.id);
                                }
                              }}
                              className="text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                              title="حذف المعاملة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* BOTTOM FIXED ACTIONS BAR - Explicitly requested by user:
            "مع اضافه نهاية الشاشه ازرار طباعه المعاملة (استعراض) وزر اضافه معامله جديد وزر البحث عن معاملات سابقه وزر تعديل المعامله" */}
        <div className="fixed bottom-0 right-0 left-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-2xl p-4 z-40">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">المعاملة المحددة حالياً:</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {selectedBooking ? `${selectedBooking.booking_number} - (${selectedBooking.passenger_name || selectedBooking.customer_name})` : "لم يتم تحديد معاملة"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Button: Confirm Booking */}
              {selectedBooking && selectedBooking.status !== "confirmed" && (
                <Button
                  id="btn-bottom-confirm-bus"
                  onClick={() => confirmBookingMutation.mutate(selectedBooking.id)}
                  disabled={confirmBookingMutation.isPending}
                  variant="outline"
                  className="border-emerald-500 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-bold gap-2"
                >
                  <Check className="w-4 h-4 text-emerald-700" />
                  تأكيد الحجز ✅
                </Button>
              )}

              {/* Button: Issue Booking */}
              {selectedBooking && (
                <Button
                  id="btn-bottom-issue-bus"
                  onClick={() => issueBookingMutation.mutate(selectedBooking.id)}
                  disabled={issueBookingMutation.isPending}
                  variant="outline"
                  className="border-purple-500 text-purple-800 bg-purple-50 hover:bg-purple-100 font-bold gap-2"
                >
                  <Send className="w-4 h-4 text-purple-700" />
                  إصدار التذكرة 🚀
                </Button>
              )}

              {/* Button: Add New Booking */}
              <Button
                id="btn-bottom-add-booking"
                onClick={handleOpenAdd}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 px-5 shadow-md shadow-emerald-600/20"
              >
                <Plus className="w-4 h-4" />
                إضافة معاملة جديدة ➕
              </Button>

              {/* Button: Edit Booking */}
              <Button
                id="btn-bottom-edit-booking"
                disabled={!selectedBooking}
                onClick={() => selectedBooking && handleEdit(selectedBooking)}
                variant="outline"
                className="border-blue-300 text-blue-800 hover:bg-blue-50 font-bold gap-2"
              >
                <Edit2 className="w-4 h-4" />
                تعديل المعاملة ✏️
              </Button>

              {/* Button: Print / Preview Booking */}
              <Button
                id="btn-bottom-print-booking"
                disabled={!selectedBooking}
                onClick={() => selectedBooking && handlePrint(selectedBooking)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 shadow-md"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                طباعة المعاملة (استعراض) 🖨️
              </Button>

              {/* Button: Search / Filter Focus */}
              <Button
                id="btn-bottom-search-booking"
                onClick={() => {
                  const input = document.getElementById("input-search-bus-bookings");
                  input?.focus();
                  window.scrollTo({ top: 180, behavior: "smooth" });
                }}
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold gap-2"
              >
                <Search className="w-4 h-4 text-slate-500" />
                البحث عن معاملات سابقة 🔍
              </Button>
            </div>
          </div>
        </div>

        {/* MODAL: ADD / EDIT BUS TICKET BOOKING (شاشة أفقية متكاملة لنظام الطرفين) */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-6xl h-[95vh] p-0 flex flex-col gap-0 overflow-hidden bg-slate-50/50" dir="rtl">
            <DialogHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white px-5 py-3 shrink-0 flex items-center justify-between border-b border-slate-700/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Bus className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                    {editingBooking ? `تعديل حجز تذكرة نقل بري (${editingBooking.booking_number})` : "تسجيل حجز تذكرة نقل بري جديدة (نظام الطرفين المتكامل)"}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-400 font-medium">
                    يرجى تحديد بيانات العميل وسعر البيع والمورد، مع اختيار العملة المطلوبة واحتساب العمولة.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form
              onSubmit={e => {
                e.preventDefault();
                const custName = form.customer_name?.trim() || (customers.find((c: any) => String(c.id) === form.customer_id)?.name) || form.passenger_name?.trim();
                const compName = form.company_name?.trim() || (transportCompanies.find((c: any) => String(c.id) === form.company_id)?.name);
                
                if (!form.customer_id && !custName) {
                  setSaveError("يرجى اختيار العميل أو إدخال اسم المسافر");
                  return;
                }
                if (!form.company_id && !compName) {
                  setSaveError("يرجى اختيار شركة النقل البري (المورد)");
                  return;
                }
                
                setSaveError(null);
                saveBookingMutation.mutate({
                  ...form,
                  customer_name: custName || form.customer_name || "عميل مباشر",
                  company_name: compName || form.company_name || "شركة نقل بري",
                  status: "confirmed"
                });
              }}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 bg-slate-100/70">
                
                {saveError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{saveError}</span>
                    </div>
                    <button type="button" onClick={() => setSaveError(null)} className="text-rose-500 hover:text-rose-700">
                      ✕
                    </button>
                  </div>
                )}

              {/* قسم أفقي 1: نظام الطرفين الماليين جنباً إلى جنب */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                {/* الطرف الأول: العميل */}
                <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/40 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-blue-900 text-sm flex items-center gap-2 border-b border-blue-200 pb-2 mb-3">
                      <User className="w-5 h-5 text-blue-600" />
                      الطرف الأول: بيانات العميل والبيع (Customer & Sales)
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex justify-between">
                          <span>العميل الدافع (Customer) *</span>
                          <button type="button" onClick={() => setQuickCustomerModalOpen(true)} className="text-[10px] text-blue-600 hover:underline">
                            + جديد
                          </button>
                        </label>
                        <select
                          required
                          value={form.customer_id}
                          onChange={e => {
                            const val = e.target.value;
                            setForm({ ...form, customer_id: val });
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs font-bold"
                        >
                          <option value="">-- اختر العميل --</option>
                          {customers.map((c: any) => (
                            <option key={`bus-cust-${c.id}`} value={c.id}>
                              {c.name} {c.phone ? `(${c.phone})` : ""} {c.affiliation_type === 'agency' ? `🏬 [تابع لمكتب: ${c.office_name || 'وكيل وسيط'}]` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex justify-between">
                          <span>اسم المسافر (Passenger)</span>
                          <button type="button" onClick={() => setQuickPassengerModalOpen(true)} className="text-[10px] text-emerald-600 hover:underline">
                            + جديد
                          </button>
                        </label>
                        <select
                          value={form.passenger_id}
                          onChange={e => {
                            setForm({ ...form, passenger_id: e.target.value });
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs"
                        >
                          <option value="">نفس العميل الدافع</option>
                          {passengers.map((p: any) => (
                            <option key={`bus-pax-${p.id}`} value={p.id}>{p.name_ar}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">سعر البيع للعميل *</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={form.selling_price}
                          onChange={e => handleSellingPriceChange(e.target.value)}
                          className="h-9 bg-white font-mono font-bold text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">عملة العميل *</label>
                        <select
                          required
                          value={form.customer_currency}
                          onChange={e => setForm({ ...form, customer_currency: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1 mb-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">طريقة السداد *</label>
                        {selectedCustomerAffiliation === 'agency' && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200">
                            🏬 عميل تابع لمكتب وسيط
                          </span>
                        )}
                      </div>
                      <select
                        required
                        value={form.payment_method}
                        onChange={e => handlePaymentMethodChange(e.target.value)}
                        className={`flex h-9 w-full rounded-md border px-2 text-xs font-bold ${
                          selectedCustomerAffiliation === 'agency' && form.payment_method === 'credit'
                            ? 'border-purple-500 bg-purple-50 text-purple-950 font-black'
                            : 'border-input bg-white'
                        }`}
                      >
                        <option value="cash">نقداً (Cash)</option>
                        {selectedCustomerAffiliation === 'agency' ? (
                          <option value="credit">
                            🏢 آجل على حساب المكتب الوسيط ({selectedCustomerObj?.office_name || "الوكيل الوسيط"})
                          </option>
                        ) : (
                          <option value="credit">آجل على حساب العميل (Credit - ذمم مدينة 11200)</option>
                        )}
                        <option value="bank">تحويل بنكي (Bank Transfer)</option>
                        <option value="card">بطاقة دفع (Card)</option>
                        <option value="cheque">شيك (Cheque)</option>
                      </select>

                      {/* تنبيه محاسبي وأمني توضيحي للعميل التابع في حجز النقل البري */}
                      {selectedCustomerAffiliation === 'agency' && form.payment_method === 'credit' && (
                        <div className="mt-1.5 p-2 bg-purple-50/90 border border-purple-200 rounded-lg text-[10px] text-purple-950 flex items-start gap-1.5 leading-relaxed">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>حماية محاسبية مشددة:</strong> نظراً لأن العميل (<strong>{selectedCustomerObj?.name}</strong>) تابع لمكتب (<strong>{selectedCustomerObj?.office_name || 'الوكيل الوسيط'}</strong>)، فإن اختيار طريقة الدفع الآجل يوجه القيد مباشرة لكشف حساب المكتب الوسيط بدليل الحسابات برقم (<strong>{selectedCustomerObj?.account_code || '11200'}</strong>) ويمنع النظام تماماً إنشاء أي حساب فردي للعميل.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">المبلغ المدفوع</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={form.paid_amount}
                          onChange={e => handlePaidAmountChange(e.target.value)}
                          disabled={form.payment_method === 'credit'}
                          className="h-9 bg-white font-mono text-xs disabled:opacity-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">المتبقي</label>
                        <Input
                          type="number"
                          value={form.remaining_balance}
                          readOnly
                          className="h-9 bg-slate-100 font-mono text-xs text-rose-700 font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">بيان القيد المحاسبي للعميل</label>
                    <Input
                      placeholder="قيمة تذكرة باص..."
                      value={form.customer_statement}
                      onChange={e => setForm({ ...form, customer_statement: e.target.value })}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                </div>

                {/* الطرف الثاني: المورد/المكتب */}
                <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2 border-b border-emerald-200 pb-2 mb-3">
                      <Bus className="w-5 h-5 text-emerald-600" />
                      الطرف الثاني: شركة النقل والتكلفة (Supplier/Company)
                    </h3>

                    <div className="space-y-1 mb-3">
                      <label className="text-[11px] font-bold text-slate-700 flex justify-between">
                        <span>شركة النقل البري (المورد) *</span>
                        <button type="button" onClick={() => setQuickCompanyModalOpen(true)} className="text-[10px] text-emerald-600 hover:underline">
                          + جديد
                        </button>
                      </label>
                      <select
                        required
                        value={form.company_id}
                        onChange={e => {
                          setForm({ ...form, company_id: e.target.value });
                        }}
                        className="flex h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-xs font-bold"
                      >
                        <option value="">-- اختر شركة النقل --</option>
                        {transportCompanies.map((c: any) => (
                          <option key={`bus-comp-${c.id}`} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">تكلفة التذكرة (Cost) *</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={form.cost_price}
                          onChange={e => handleCostPriceChange(e.target.value)}
                          className="h-9 bg-white font-mono font-bold text-xs text-emerald-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">عملة التكلفة *</label>
                        <select
                          required
                          value={form.supplier_currency}
                          onChange={e => setForm({ ...form, supplier_currency: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold text-emerald-900"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-1 mb-3">
                      <label className="text-[11px] font-bold text-slate-700">طريقة سداد المورد *</label>
                      <select
                        required
                        value={form.supplier_payment_method}
                        onChange={e => handleSupplierPaymentMethodChange(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold"
                      >
                        {SUPPLIER_PAYMENT_METHODS.map(pm => (
                          <option key={pm.id} value={pm.id}>{pm.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">بيان القيد المحاسبي لشركة النقل</label>
                    <Input
                      placeholder="تكلفة تذكرة باص..."
                      value={form.supplier_statement}
                      onChange={e => setForm({ ...form, supplier_statement: e.target.value })}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* قسم أفقي 2: تفاصيل التذكرة والرحلة */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5 mt-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    بيانات التذكرة ومسار الرحلة
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">رقم التذكرة (Ticket No.) *</label>
                    <Input
                      required
                      value={form.ticket_number}
                      onChange={e => setForm({ ...form, ticket_number: e.target.value })}
                      placeholder="TKT-XXXXXX"
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">رقم البوليصة (PNR)</label>
                    <Input
                      value={form.pnr_number}
                      onChange={e => setForm({ ...form, pnr_number: e.target.value })}
                      placeholder="PNRXXXX"
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">مدينة الانطلاق *</label>
                    <Input
                      required
                      value={form.origin_city}
                      onChange={e => setForm({ ...form, origin_city: e.target.value })}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">مدينة الوصول *</label>
                    <Input
                      required
                      value={form.destination_city}
                      onChange={e => setForm({ ...form, destination_city: e.target.value })}
                      className="text-xs h-8 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-emerald-900 mb-1 block">تاريخ المغادرة *</label>
                    <Input
                      required
                      type="date"
                      value={form.departure_date}
                      onChange={e => setForm({ ...form, departure_date: e.target.value })}
                      className="text-xs h-8 bg-white font-mono text-emerald-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">وقت المغادرة *</label>
                    <Input
                      required
                      type="time"
                      value={form.departure_time}
                      onChange={e => setForm({ ...form, departure_time: e.target.value })}
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

              <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-4 bg-slate-50/70 p-3 rounded-b-xl">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start">
                  {editingBooking ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleteBookingMutation.isPending}
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف الحجز نهائياً؟`)) {
                          deleteBookingMutation.mutate(editingBooking.id);
                          setModalOpen(false);
                        }
                      }}
                      className="font-bold text-xs gap-1.5 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف الحجز 🗑️
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (confirm("هل تريد إفراغ كافة الحقول وإعادة الضبط؟")) {
                          resetForm();
                        }
                      }}
                      className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs gap-1.5"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                      إفراغ الحقول 🔄
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs font-bold h-9">
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveBookingMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 shadow-md gap-1.5 h-9"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {saveBookingMutation.isPending ? "جاري الحفظ..." : editingBooking ? "حفظ التعديلات ✅" : "حفظ الحجز وتوثيق القيد ➕"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL: QUICK ADD CUSTOMER */}
        <Dialog open={quickCustomerModalOpen} onOpenChange={setQuickCustomerModalOpen}>
          <DialogContent className="max-w-md text-right" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2 text-right">
                <UserPlus className="w-5 h-5 text-blue-600" />
                إضافة عميل جديد سريعاً
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 text-right">
                إضافة عميل إلى دليل الحسابات وربطه فوراً بهذه المعاملة.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">اسم العميل *</label>
                <Input
                  value={quickCustomerForm.name}
                  onChange={e => setQuickCustomerForm({ ...quickCustomerForm, name: e.target.value })}
                  placeholder="مثال: خالد محمد الشمري"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">رقم الجوال *</label>
                <Input
                  value={quickCustomerForm.phone}
                  onChange={e => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
                  placeholder="05XXXXXXXX"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setQuickCustomerModalOpen(false)}>إلغاء</Button>
              <Button
                id="btn-save-quick-customer"
                onClick={() => {
                  if (!quickCustomerForm.name.trim()) return alert("يرجى إدخال اسم العميل");
                  quickCustomerMutation.mutate(quickCustomerForm);
                }}
                disabled={quickCustomerMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {quickCustomerMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                حفظ وإدراج ➕
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: QUICK ADD PASSENGER */}
        <Dialog open={quickPassengerModalOpen} onOpenChange={setQuickPassengerModalOpen}>
          <DialogContent className="max-w-md text-right" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2 text-right">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                إضافة مسافر / راكب جديد
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 text-right">
                تسجيل بيانات الراكب في سجل المسافرين.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">الاسم بالعربية *</label>
                <Input
                  value={quickPassengerForm.name_ar}
                  onChange={e => setQuickPassengerForm({ ...quickPassengerForm, name_ar: e.target.value })}
                  placeholder="الاسم الثلاثي أو الرباعي"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">رقم الجوال</label>
                <Input
                  value={quickPassengerForm.phone}
                  onChange={e => setQuickPassengerForm({ ...quickPassengerForm, phone: e.target.value })}
                  placeholder="05XXXXXXXX"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">رقم الهوية / الجواز</label>
                <Input
                  value={quickPassengerForm.passport_number}
                  onChange={e => setQuickPassengerForm({ ...quickPassengerForm, passport_number: e.target.value })}
                  placeholder="10XXXXXXXX أو A12345678"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setQuickPassengerModalOpen(false)}>إلغاء</Button>
              <Button
                id="btn-save-quick-passenger"
                onClick={() => {
                  if (!quickPassengerForm.name_ar.trim()) return alert("يرجى إدخال اسم المسافر");
                  quickPassengerMutation.mutate(quickPassengerForm);
                }}
                disabled={quickPassengerMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {quickPassengerMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                حفظ وإدراج ➕
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: QUICK ADD TRANSPORT COMPANY */}
        <Dialog open={quickCompanyModalOpen} onOpenChange={setQuickCompanyModalOpen}>
          <DialogContent className="max-w-md text-right" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2 text-right">
                <Building2 className="w-5 h-5 text-emerald-600" />
                إضافة شركة نقل بري كدليل
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 text-right">
                تسجيل شركة نقل بري جديدة في دليل الموردين والشركات الناقلة.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">اسم الشركة الناقلة *</label>
                <Input
                  value={quickCompanyForm.name}
                  onChange={e => setQuickCompanyForm({ ...quickCompanyForm, name: e.target.value })}
                  placeholder="مثال: شركة سابتكو SAPTCO أو النقل الجماعي الدولي"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">رقم الهاتف / الاتصال</label>
                <Input
                  value={quickCompanyForm.phone}
                  onChange={e => setQuickCompanyForm({ ...quickCompanyForm, phone: e.target.value })}
                  placeholder="9200XXXXX أو 011XXXXXXX"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setQuickCompanyModalOpen(false)}>إلغاء</Button>
              <Button
                id="btn-save-quick-company"
                onClick={() => {
                  if (!quickCompanyForm.name.trim()) return alert("يرجى إدخال اسم الشركة");
                  quickCompanyMutation.mutate(quickCompanyForm);
                }}
                disabled={quickCompanyMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {quickCompanyMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                حفظ وإدراج ➕
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: PRINT / PREVIEW OFFICIAL BUS TICKET & VOUCHER */}
        <Dialog open={!!printBooking} onOpenChange={open => !open && setPrintBooking(null)}>
          <DialogContent className="max-w-3xl text-right max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader className="text-right border-b pb-3 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-emerald-600" />
                  معاينة وطباعة تذكرة وسند النقل البري الرسمي
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  تذكرة نقل بري معتمدة مع كافة بيانات الطرفين، والمقعد، والمحطات، والمبالغ المالية.
                </DialogDescription>
              </div>
              <Button
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs"
              >
                <Printer className="w-4 h-4" />
                طباعة الآن
              </Button>
            </DialogHeader>

            {printBooking && (
              <div id="printable-bus-ticket" className="p-6 bg-white border border-slate-300 rounded-2xl space-y-6 shadow-sm font-sans text-slate-800">
                {/* Agency Header */}
                <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-emerald-950 flex items-center gap-2">
                      <Bus className="w-6 h-6 text-emerald-600" />
                      وكالة السعادة للسفريات والسياحة والنقل البري
                    </h2>
                    <p className="text-xs text-slate-500">
                      خدمات النقل الدولي والداخلي | ترخيص سياحي رقم: 778899 | الرقم الضريبي: 300998811200003
                    </p>
                  </div>
                  <div className="text-left font-mono text-xs text-slate-600">
                    <p className="font-bold text-slate-900 text-sm">{printBooking.booking_number}</p>
                    <p>التاريخ: {printBooking.issue_date || new Date().toISOString().slice(0, 10)}</p>
                  </div>
                </div>

                {/* Ticket Title Banner */}
                <div className="bg-gradient-to-l from-emerald-800 to-teal-800 text-white p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-emerald-200 block">OFFICIAL BOARDING PASS & BUS TICKET</span>
                    <h3 className="text-lg font-black text-white">تذكرة نقل بري وبطاقة صعود الحافلة</h3>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs text-emerald-200 block">رقم التذكرة Ticket No</span>
                    <span className="text-base font-black text-white">{printBooking.ticket_number || "TKT-BUS-VALID"}</span>
                  </div>
                </div>

                {/* Route Callout */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-around text-center">
                  <div>
                    <span className="text-xs text-slate-500 block">محطة الانطلاق (From)</span>
                    <span className="text-base font-black text-blue-900">{printBooking.origin_city}</span>
                    <p className="text-xs text-slate-600">{printBooking.origin_station || "المحطة الرئيسية"}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                      {printBooking.trip_type === "round_trip" ? "ذهاب وعودة 🔁" : "رحلة مباشرة ⬅️"}
                    </span>
                    <span className="text-lg text-slate-400 my-1">━━━━ 🚌 ━━━━</span>
                    <span className="text-xs text-slate-500 font-mono">
                      {printBooking.bus_type}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">محطة الوصول (To)</span>
                    <span className="text-base font-black text-emerald-900">{printBooking.destination_city}</span>
                    <p className="text-xs text-slate-600">{printBooking.destination_station || "المحطة المركزية"}</p>
                  </div>
                </div>

                {/* Two Parties Details */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Party 1: Customer */}
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-xs">
                    <h5 className="font-bold text-blue-950 flex items-center gap-1.5 text-sm border-b border-blue-200 pb-1">
                      <User className="w-4 h-4 text-blue-600" />
                      الطرف الأول: بيانات الراكب والعميل
                    </h5>
                    <p><b>اسم الراكب:</b> {printBooking.passenger_name || printBooking.customer_name || "عميل نقدي"}</p>
                    <p><b>العميل المتعاقد:</b> {printBooking.customer_name || "-"}</p>
                    <p><b>رقم الهوية / الجواز:</b> <span className="font-mono">{printBooking.passenger_national_id || "-"}</span></p>
                    <p><b>رقم الهاتف:</b> <span className="font-mono">{printBooking.passenger_phone || "-"}</span></p>
                    <p className="text-blue-900 bg-blue-100/60 p-1.5 rounded font-medium mt-1">
                      <b>البيان:</b> {printBooking.customer_statement || "قيمة تذكرة نقل بري"}
                    </p>
                  </div>

                  {/* Party 2: Company */}
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
                    <h5 className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm border-b border-emerald-200 pb-1">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      الطرف الثاني: شركة النقل البري الناقلة
                    </h5>
                    <p><b>اسم شركة النقل:</b> {printBooking.company_name || printBooking.company_name_joined || "الناقل المعتمد"}</p>
                    <p><b>رقم الحافلة:</b> <span className="font-mono font-bold">{printBooking.bus_number || "حسب الجدولة"}</span></p>
                    <p><b>رقم المقعد المخصص:</b> <span className="font-mono font-black text-emerald-800 text-sm bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">{printBooking.seat_number || "حر"}</span></p>
                    <p><b>الأمتعة المسموحة:</b> {printBooking.luggage_weight || 30} كجم ({printBooking.luggage_pieces || 2} حقيبة)</p>
                    <p className="text-emerald-900 bg-emerald-100/60 p-1.5 rounded font-medium mt-1">
                      <b>بيان الناقل:</b> {printBooking.supplier_statement || "تكلفة حجز مقعد حافلة نقل بري"}
                    </p>
                  </div>
                </div>

                {/* Schedule & Financial Summary */}
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="text-slate-500 block">تاريخ السفر</span>
                    <span className="font-bold text-slate-900 text-sm block mt-0.5">{printBooking.departure_date}</span>
                    <span className="text-emerald-700 font-mono font-bold">التحرك: {printBooking.departure_time || "08:00"}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="text-slate-500 block">وقت الحضور بالمحطة</span>
                    <span className="font-black text-red-700 text-sm block mt-0.5">{printBooking.boarding_time || "قبل الرحلة بـ 30 دقيقة"}</span>
                    <span className="text-slate-500">للصعود وشحن الأمتعة</span>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl">
                    <span className="text-emerald-800 font-semibold block">إجمالي المبلغ المطلوب</span>
                    <span className="font-black text-emerald-950 text-base block mt-0.5">
                      {Number(printBooking.selling_price || 0).toLocaleString()} {printBooking.customer_currency || "SAR"}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold">
                      {printBooking.payment_status === "paid" ? "✅ مدفوع بالكامل" : "⚠️ آجل على الحساب"}
                    </span>
                  </div>
                </div>

                {/* Terms and conditions */}
                <div className="text-[11px] text-slate-500 space-y-1 border-t pt-3">
                  <p className="font-bold text-slate-700">شروط وأحكام النقل البري:</p>
                  <p>1. يجب التواجد في محطة الانطلاق قبل موعد الرحلة بنصف ساعة على الأقل لتسليم الأمتعة واستلام بطاقة الصعود.</p>
                  <p>2. يُشترط إبراز أصل الهوية الوطنية أو الإقامة أو جواز السفر ساري المفعول لجميع الركاب قبل الصعود.</p>
                  <p>3. في حال الإلغاء أو الاسترجاع، يخضع الطلب لسياسة شركة النقل البري الناقلة.</p>
                </div>

                {/* Footer Signatures */}
                <div className="flex items-center justify-between pt-4 border-t text-xs font-semibold text-slate-600">
                  <div>توقيع وختم الوكالة: __________________</div>
                  <div>الموظف المصدر: {printBooking.issued_by || "مدير النظام"}</div>
                  <div>توقيع الراكب / المستلم: __________________</div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

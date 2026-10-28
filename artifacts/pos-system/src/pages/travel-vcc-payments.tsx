import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import {
  CreditCard,
  Sparkles,
  ShieldCheck,
  Lock,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Copy,
  DollarSign,
  Calendar,
  Building2,
  Plane,
  ArrowRight,
  TrendingDown,
  Layers,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VirtualCard {
  id: number;
  card_token: string;
  provider: string;
  masked_pan: string;
  cvv: string;
  expiry_month: string;
  expiry_year: string;
  currency: string;
  max_limit: number;
  spent_amount: number;
  remaining_balance: number;
  status: string;
  merchant_category_lock: string;
  supplier_name: string;
  booking_reference: string;
  purpose: string;
  created_at: string;
  valid_until: string;
}

export default function TravelVccPayments() {
  const { toast } = useToast();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealedCvv, setRevealedCvv] = useState<Record<number, boolean>>({});
  const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);

  // New VCC Generation State
  const [newCardModal, setNewCardModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [cardForm, setCardForm] = useState({
    provider: "MasterCard B2B",
    supplier_name: "Emirates Airlines",
    booking_reference: "PNR-DXB881",
    purpose: "شراء تذاكر طيران مباشرة",
    amount: 3200,
    currency: "USD",
    merchant_category_lock: "3000-3350 (Airlines)"
  });

  // Transaction Settle State
  const [settleAmount, setSettleAmount] = useState<number>(100);
  const [settling, setSettling] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/travel/vcc/cards");
      const data = await res.json();
      if (data.success) {
        setCards(data.data);
        if (data.data.length > 0 && !selectedCard) {
          setSelectedCard(data.data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch("/api/travel/vcc/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardForm)
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم إنشاء البطاقة الافتراضية بنجاح", description: data.message });
        setNewCardModal(false);
        loadData();
      }
    } catch (e) {
      toast({ title: "خطأ", description: "فشل توليد البطاقة", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSettleTransaction = async () => {
    if (!selectedCard) return;
    setSettling(true);
    try {
      const res = await fetch(`/api/travel/vcc/cards/${selectedCard.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: settleAmount,
          merchant: selectedCard.supplier_name
        })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تمت تسوية العملية بنجاح", description: data.message });
        loadData();
      } else {
        toast({ title: "فشل التسوية", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "خطأ", description: "تعذر تسجيل حركة البطاقة", variant: "destructive" });
    } finally {
      setSettling(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ", description: `تم نسخ ${label} إلى الحافظة` });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-violet-950 via-slate-900 to-purple-950 border border-violet-800/40 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-xl">
                  <CreditCard className="w-6 h-6" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">البطاقات الائتمانية الافتراضية B2B (Virtual Credit Cards)</h1>
                  <p className="text-slate-400 text-sm">
                    توليد بطاقات أحادية الاستخدام ومحمية برمز MCC محدد للدفع لخطوط الطيران والفنادق العالمية مع الحماية من الاحتيال وتجاوز الرصيد
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
                onClick={() => setNewCardModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                توليد بطاقة افتراضية جديدة VCC
              </button>
            </div>
          </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Cards List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-500" />
              البطاقات المصدرة والمتاحة ({cards.length})
            </span>
            <button
              onClick={loadData}
              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {cards.map((card) => {
            const isSelected = selectedCard?.id === card.id;
            const isRevealed = revealedCvv[card.id];
            return (
              <div
                key={card.id}
                onClick={() => setSelectedCard(card)}
                className={`cursor-pointer rounded-2xl border p-5 transition space-y-4 ${
                  isSelected
                    ? "bg-violet-50/40 dark:bg-violet-950/20 border-violet-500 shadow-md ring-2 ring-violet-500/20"
                    : "bg-card border-border hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Virtual Card Graphic */}
                <div className="bg-gradient-to-tr from-slate-950 via-slate-900 to-violet-950 border border-violet-500/30 rounded-2xl p-5 text-white space-y-4 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2.5 py-0.5 rounded-full font-bold">
                      {card.provider}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {card.status === "active" ? "Active / Single-Use" : "Used"}
                    </span>
                  </div>

                  <div className="font-mono text-lg tracking-widest text-slate-100 flex items-center justify-between">
                    <span>{card.masked_pan}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(card.masked_pan, "رقم البطاقة");
                      }}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block">الصلاحية EXP</span>
                      <span>{card.expiry_month}/{card.expiry_year}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">رمز الأمان CVV</span>
                      <div className="flex items-center gap-1">
                        <span>{isRevealed ? card.cvv : "•••"}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRevealedCvv(p => ({ ...p, [card.id]: !p[card.id] }));
                          }}
                          className="text-slate-400 hover:text-white"
                        >
                          {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block">الحد الأقصى</span>
                      <span className="text-violet-300 font-bold">{card.max_limit} {card.currency}</span>
                    </div>
                  </div>
                </div>

                {/* Card Target & Metadata */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-3 rounded-xl">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">المزود / المستفيد</span>
                    <span className="font-bold">{card.supplier_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">رقم الحجز PNR</span>
                    <span className="font-mono font-bold text-violet-600 dark:text-violet-400">{card.booking_reference}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Lock className="w-3 h-3 text-amber-500" />
                    قفل الفئة: {card.merchant_category_lock}
                  </span>
                  <span className="font-bold text-emerald-600">
                    الرصيد المتاح: {card.remaining_balance} {card.currency}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Settlement & Balance Controls */}
        <div className="lg:col-span-5 space-y-4">
          {selectedCard ? (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-lg space-y-4">
              <div className="border-b border-border pb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-violet-500" />
                  تسوية ومطابقة حركة الدفع للبطاقة
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  المرجع: <span className="font-mono font-bold text-foreground">{selectedCard.card_token}</span>
                </p>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الغرض من الإصدار:</span>
                  <span className="font-bold">{selectedCard.purpose}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تاريخ الإنشاء:</span>
                  <span className="font-mono">{selectedCard.created_at?.slice(0, 16)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">صالح حتى:</span>
                  <span className="font-mono text-rose-500">{selectedCard.valid_until}</span>
                </div>
              </div>

              {/* Settle Action */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-muted-foreground">
                  تسجيل حركة خصم من المزود (Simulate Charge):
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={settleAmount}
                    onChange={e => setSettleAmount(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-mono font-bold"
                  />
                  <button
                    onClick={handleSettleTransaction}
                    disabled={settling || selectedCard.remaining_balance <= 0}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {settling ? "جارِ التسوية..." : "تنفيذ الخصم"}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-500/20 rounded-xl text-xs space-y-1 text-violet-900 dark:text-violet-200">
                <div className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-violet-600" />
                  ميزات أمان VCC المتقدمة:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
                  <li>إلغاء فوري بعد انتهاء الحجز لمنع أي خصم احتيالي لاحق.</li>
                  <li>تحديد التاجر مسبقاً (MCC Lock) بحيث تُرفض أي محاولة خارج نطاق الطيران أو الفندق.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground">
              <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/40 stroke-1" />
              <h4 className="font-bold text-sm mt-2">اختر بطاقة افتراضية للاطلاع على تفاصيلها</h4>
            </div>
          )}
        </div>
      </div>

      {/* New VCC Modal */}
      {newCardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base border-b border-border pb-2">توليد بطاقة افتراضية VCC جديدة</h3>
            <form onSubmit={handleGenerateCard} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">مزود خدمة البطاقة:</label>
                <select
                  value={cardForm.provider}
                  onChange={e => setCardForm(p => ({ ...p, provider: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-medium"
                >
                  <option value="MasterCard B2B">MasterCard B2B (Global Settlement)</option>
                  <option value="Conferma Pay">Conferma Pay (Hotel Direct)</option>
                  <option value="WEX Virtual Payments">WEX Corporate Travel</option>
                  <option value="AirPlus International">AirPlus A.I.D.A.</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">اسم المزود أو الفندق المستفيد:</label>
                <input
                  type="text"
                  required
                  value={cardForm.supplier_name}
                  onChange={e => setCardForm(p => ({ ...p, supplier_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">رقم الحجز PNR:</label>
                  <input
                    type="text"
                    required
                    value={cardForm.booking_reference}
                    onChange={e => setCardForm(p => ({ ...p, booking_reference: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">المبلغ والعملة:</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      required
                      value={cardForm.amount}
                      onChange={e => setCardForm(p => ({ ...p, amount: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono font-bold"
                    />
                    <select
                      value={cardForm.currency}
                      onChange={e => setCardForm(p => ({ ...p, currency: e.target.value }))}
                      className="px-2 py-2 bg-muted/40 border border-border rounded-xl font-bold font-mono"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="SAR">SAR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">قفل فئة التاجر (MCC Category Lock):</label>
                <select
                  value={cardForm.merchant_category_lock}
                  onChange={e => setCardForm(p => ({ ...p, merchant_category_lock: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-medium"
                >
                  <option value="3000-3350 (Airlines)">3000-3350 (خطوط الطيران فقط)</option>
                  <option value="3501-3999 (Hotels)">3501-3999 (الفنادق والمنتجعات فقط)</option>
                  <option value="7512 (Car Rentals)">7512 (تأجير السيارات)</option>
                  <option value="4112 (Railways)">4112 (القطارات والمواصلات)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={generating}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {generating ? "جارِ إنشاء البطاقة والتشفير..." : "توليد وتأكيد البطاقة"}
                </button>
                <button
                  type="button"
                  onClick={() => setNewCardModal(false)}
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

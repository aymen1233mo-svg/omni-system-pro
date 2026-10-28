import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plane, Ticket, Users, Globe, Building2, Luggage, ArrowRight, ExternalLink, Phone, Hash, CreditCard } from "lucide-react";
import { useLocation } from "wouter";

interface SearchResults {
  customers?: any[];
  passengers?: any[];
  bookings?: any[];
  visas?: any[];
  hotels?: any[];
}

export function TravelGlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem("pos_token") ?? "";
        const res = await fetch(`/api/travel/global-search?q=${encodeURIComponent(query.trim())}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const navigateTo = (path: string) => {
    setLocation(path);
    onOpenChange(false);
  };

  const totalResults =
    (results?.customers?.length || 0) +
    (results?.passengers?.length || 0) +
    (results?.bookings?.length || 0) +
    (results?.visas?.length || 0) +
    (results?.hotels?.length || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl p-0 overflow-hidden shadow-2xl border-slate-200">
        <DialogHeader className="p-4 pb-2 border-b bg-slate-50/70">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
            <Search className="w-5 h-5 text-primary" />
            البحث الشامل في نظام السفريات والسياحة (Global Search)
          </DialogTitle>
          <div className="relative mt-2">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم، رقم التذكرة، PNR، رقم الجواز، رقم الحجز، التأشيرة، الفندق..."
              className="pr-9 h-11 text-sm bg-white border-slate-300 focus-visible:ring-primary shadow-inner"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute left-3 top-3 text-xs text-slate-400 hover:text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
              جاري البحث في قاعدة البيانات...
            </div>
          )}

          {!loading && query.length >= 2 && totalResults === 0 && (
            <div className="py-12 text-center text-slate-500">
              <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-sm">لم يتم العثور على نتائج تطابق "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">تأكد من كتابة الاسم أو رقم المستند بشكل صحيح</p>
            </div>
          )}

          {!loading && !results && query.length < 2 && (
            <div className="py-8 text-center text-slate-400 text-xs">
              <p>اكتب حرفين أو أكثر للبحث في كافة سجلات النظام فوراً</p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <span className="bg-slate-100 px-2 py-1 rounded text-[11px] text-slate-600">👤 أسماء العملاء</span>
                <span className="bg-slate-100 px-2 py-1 rounded text-[11px] text-slate-600">🎫 تذاكر الطيران وPNR</span>
                <span className="bg-slate-100 px-2 py-1 rounded text-[11px] text-slate-600">🌍 التأشيرات</span>
                <span className="bg-slate-100 px-2 py-1 rounded text-[11px] text-slate-600">🏨 حجوزات الفنادق</span>
                <span className="bg-slate-100 px-2 py-1 rounded text-[11px] text-slate-600">🛂 أرقام الجوازات</span>
              </div>
            </div>
          )}

          {/* Bookings & Flight Tickets */}
          {results?.bookings && results.bookings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Ticket className="w-3.5 h-3.5 text-blue-600" />
                حجوزات وتذاكر الطيران ({results.bookings.length})
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.bookings.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => navigateTo("/travel-bookings")}
                    className="p-2.5 bg-blue-50/50 hover:bg-blue-100/70 border border-blue-100 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{b.customer_name || "عميل بدون اسم"}</span>
                        {b.passenger_name && (
                          <span className="text-[11px] text-slate-600">({b.passenger_name})</span>
                        )}
                        {b.destination && (
                          <span className="text-[10px] bg-blue-200/70 text-blue-900 font-semibold px-1.5 py-0.5 rounded">
                            ✈️ {b.destination}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                        {b.pnr && <span>PNR: <strong className="text-blue-800">{b.pnr}</strong></span>}
                        {b.ticket_number && <span>تذكرة: {b.ticket_number}</span>}
                        {b.code && <span>رمز: {b.code}</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-blue-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers */}
          {results?.customers && results.customers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                العملاء والشركات ({results.customers.length})
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.customers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigateTo("/customers")}
                    className="p-2.5 bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-100 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900">{c.name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                        {c.phone && <span>📞 {c.phone}</span>}
                        {c.passport_number && <span>جواز: {c.passport_number}</span>}
                        {c.nationality && <span>الجنسية: {c.nationality}</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passengers */}
          {results?.passengers && results.passengers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Luggage className="w-3.5 h-3.5 text-indigo-600" />
                المسافرون Passengers ({results.passengers.length})
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.passengers.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigateTo("/passengers")}
                    className="p-2.5 bg-indigo-50/50 hover:bg-indigo-100/70 border border-indigo-100 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900">{p.name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                        {p.passport_number && <span>جواز: <strong className="text-indigo-800">{p.passport_number}</strong></span>}
                        {p.phone && <span>هاتف: {p.phone}</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-indigo-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visas */}
          {results?.visas && results.visas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5 text-amber-600" />
                معاملات التأشيرات ({results.visas.length})
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.visas.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => navigateTo("/travel-visas")}
                    className="p-2.5 bg-amber-50/50 hover:bg-amber-100/70 border border-amber-100 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{v.passenger_name || "مسافر"}</span>
                        <span className="text-[11px] bg-amber-200 text-amber-900 font-semibold px-1.5 py-0.5 rounded">
                          {v.country} - {v.visa_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                        {v.code && <span>رقم المعاملة: {v.code}</span>}
                        {v.passport_number && <span>جواز: {v.passport_number}</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hotels */}
          {results?.hotels && results.hotels.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5 text-purple-600" />
                الفنادق والدليل الفندقي ({results.hotels.length})
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {results.hotels.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => navigateTo("/travel-hotels-db")}
                    className="p-2.5 bg-purple-50/50 hover:bg-purple-100/70 border border-purple-100 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900">{h.name}</p>
                      <p className="text-[11px] text-slate-500">{h.city} {h.country ? ` - ${h.country}` : ""}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-purple-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-50 border-t text-[11px] text-slate-500 flex items-center justify-between">
          <span>اضغط <kbd className="px-1.5 py-0.5 bg-white border rounded font-mono text-[10px]">Esc</kbd> للإغلاق</span>
          <span>إجمالي النتائج: {totalResults}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

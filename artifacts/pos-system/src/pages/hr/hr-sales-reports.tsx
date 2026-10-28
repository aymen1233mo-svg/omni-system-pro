import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, FileText, Search, Calendar, Users, ShoppingBag, Landmark, ArrowLeftRight, HelpCircle, ChevronDown } from "lucide-react";
import { fmt } from "./api";

export function SalesReportsTab({ initialReport }: { initialReport?: string }) {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<string>(initialReport || "general_sales");
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-20");

  useEffect(() => {
    if (initialReport) {
      setSelectedReport(initialReport);
    }
  }, [initialReport]);

  // Report Types and Lists matching Image 3 requirements
  const reportTypes = [
    { id: "general_sales", label: "تقارير المبيعات العامة", description: "إجمالي المبيعات، الضرائب، والربحية" },
    { id: "cashier_sales", label: "تقارير مبيعات الكاشيرات", description: "أداء الكاشيرات ومبيعات كل مستخدم" },
    { id: "control_sales", label: "تقارير رقابية للمبيعات", description: "تعديلات الأسعار، الفواتير الملغية والمرتجعة" },
    { id: "returns_sales", label: "تقارير مرتجع المبيعات", description: "تفاصيل المرتجعات والمبالغ المستردة" },
    { id: "print_menu", label: "طباعة المنيو وقوائم الأصناف", description: "قوائم الطعام والأسعار النشطة" },
    { id: "delegates_orders", label: "طباعة الطلبيات والمندوبين", description: "إحصائيات المناديب وتسليم الطلبات" },
    { id: "reservations", label: "تقارير حجوزات الصالات", description: "حجوزات الطاولات والمناسبات" },
    { id: "tools_insurance", label: "تقرير تأمين الأدوات", description: "تأمين حافظات الطعام المستردة وغير المستردة" },
    { id: "delivery_sales", label: "تقرير مبيعات التوصيل", description: "مبيعات الدليفري ومناطق التوزيع" },
  ];

  const handlePrint = () => {
    toast({ title: "جاري توليد ملف PDF للتقرير للطباعة المباشرة" });
    window.print();
  };

  // Render Mock Report Data Tables dynamically
  const renderReportContent = () => {
    switch (selectedReport) {
      case "general_sales":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-slate-900 border border-indigo-100 rounded-lg">
                <span className="text-xs text-muted-foreground">إجمالي المبيعات الإجمالية</span>
                <div className="text-xl font-bold font-mono text-indigo-700 mt-1">{fmt(845000)} ر.س</div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-slate-900 border border-green-100 rounded-lg">
                <span className="text-xs text-muted-foreground">الضرائب المحصلة (15%)</span>
                <div className="text-xl font-bold font-mono text-green-700 mt-1">{fmt(126750)} ر.س</div>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-slate-900 border border-emerald-100 rounded-lg">
                <span className="text-xs text-muted-foreground">صافي الأرباح المقدرة</span>
                <div className="text-xl font-bold font-mono text-emerald-700 mt-1">{fmt(415000)} ر.س</div>
              </div>
            </div>
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-right font-bold">التاريخ</th>
                    <th className="p-2.5 text-right font-bold">عدد الفواتير</th>
                    <th className="p-2.5 text-right font-bold">إجمالي المبيعات</th>
                    <th className="p-2.5 text-right font-bold">الضريبة</th>
                    <th className="p-2.5 text-right font-bold">صافي النقدية</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  <tr><td className="p-2.5">2026-07-20</td><td className="p-2.5">42 فاتورة</td><td className="p-2.5 font-bold">{fmt(35000)}</td><td className="p-2.5">{fmt(5250)}</td><td className="p-2.5 text-green-600">{fmt(29750)}</td></tr>
                  <tr><td className="p-2.5">2026-07-19</td><td className="p-2.5">58 فاتورة</td><td className="p-2.5 font-bold">{fmt(49000)}</td><td className="p-2.5">{fmt(7350)}</td><td className="p-2.5 text-green-600">{fmt(41650)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "cashier_sales":
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-sm">مبيعات الكاشيرات النشطة</h4>
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-right font-bold">اسم الكاشير</th>
                    <th className="p-2.5 text-right font-bold">عدد الفواتير المكتملة</th>
                    <th className="p-2.5 text-right font-bold">المبيعات النقدية</th>
                    <th className="p-2.5 text-right font-bold">المبيعات بطاقة (شبكة)</th>
                    <th className="p-2.5 text-right font-bold">إجمالي الكاش (ر.س)</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  <tr><td className="p-2.5 font-sans font-bold">الكاشير عمر</td><td className="p-2.5">38 فاتورة</td><td className="p-2.5">{fmt(12000)}</td><td className="p-2.5">{fmt(23000)}</td><td className="p-2.5 text-indigo-600 font-bold">{fmt(35000)}</td></tr>
                  <tr><td className="p-2.5 font-sans font-bold">الكاشير أحمد</td><td className="p-2.5">45 فاتورة</td><td className="p-2.5">{fmt(25000)}</td><td className="p-2.5">{fmt(15000)}</td><td className="p-2.5 text-indigo-600 font-bold">{fmt(40000)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "control_sales":
        return (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-bold">
              ⚠ تقرير الرقابة مخصص لرصد الفواتير الملغاة يدوياً وتعديلات الأسعار السريعة المعتمدة من الكاشيرات.
            </div>
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-right font-bold">رقم الفاتورة</th>
                    <th className="p-2.5 text-right font-bold">الكاشير</th>
                    <th className="p-2.5 text-right font-bold">الحدث الرقابي</th>
                    <th className="p-2.5 text-right font-bold">السبب المدخل</th>
                    <th className="p-2.5 text-right font-bold">قيمة الفاتورة الملغية</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  <tr><td className="p-2.5 text-red-600 font-bold">INV-9921</td><td className="p-2.5 font-sans">عمر الكاشير</td><td className="p-2.5 font-sans text-red-600">إلغاء فاتورة بالكامل</td><td className="p-2.5 font-sans">طلب خاطئ من العميل قبل الدفع</td><td className="p-2.5 font-bold">{fmt(15000)}</td></tr>
                  <tr><td className="p-2.5 text-amber-600 font-bold">INV-9801</td><td className="p-2.5 font-sans">أحمد الكاشير</td><td className="p-2.5 font-sans text-amber-600">تعديل سعر يدوي خصم</td><td className="p-2.5 font-sans">خصم خاص بموافقة المدير</td><td className="p-2.5 font-bold">{fmt(5000)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "returns_sales":
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-sm">سجل مرتجع مبيعات الصالات والتوصيل</h4>
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-right font-bold">رقم المرتجع</th>
                    <th className="p-2.5 text-right font-bold">الفاتورة الأصلية</th>
                    <th className="p-2.5 text-right font-bold">الأصناف المرتجعة</th>
                    <th className="p-2.5 text-right font-bold">قيمة الاسترداد</th>
                    <th className="p-2.5 text-right font-bold">تاريخ المرتجع</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  <tr><td className="p-2.5 font-bold text-red-600">RET-401</td><td className="p-2.5">INV-90112</td><td className="p-2.5 font-sans">1 برجر لحم دبل، 1 بطاطس</td><td className="p-2.5 font-bold text-red-600">{fmt(3600)}</td><td className="p-2.5">2026-07-20</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "print_menu":
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-lg border">
              <span className="text-xs font-bold">قوائم المنيو النشطة حالياً في المطعم</span>
              <Button size="sm" onClick={handlePrint} className="gap-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"><Printer className="w-4 h-4" /> طباعة المنيو الكامل للزبائن</Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="border shadow-sm p-4 space-y-2">
                <h5 className="font-bold text-sm text-indigo-700 border-b pb-1">قسم المشويات والشاورما</h5>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span>شاورما دجاج سوبر</span><span className="font-mono font-bold">15.00 ر.س</span></div>
                  <div className="flex justify-between"><span>شاورما لحم عربي كبير</span><span className="font-mono font-bold">22.00 ر.س</span></div>
                </div>
              </Card>
              <Card className="border shadow-sm p-4 space-y-2">
                <h5 className="font-bold text-sm text-indigo-700 border-b pb-1">المقبلات والعصائر</h5>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span>بطاطس مقلية مقرمشة</span><span className="font-mono font-bold">8.00 ر.س</span></div>
                  <div className="flex justify-between"><span>عصير ليمون بالنعناع فريش</span><span className="font-mono font-bold">10.00 ر.س</span></div>
                </div>
              </Card>
            </div>
          </div>
        );

      case "delegates_orders":
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-sm">كشف مبيعات وتوصيل مناديب التوصيل</h4>
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-right font-bold">اسم المندوب</th>
                    <th className="p-2.5 text-right font-bold">عدد الطلبات المسلمة</th>
                    <th className="p-2.5 text-right font-bold">إجمالي قيمة التوصيل</th>
                    <th className="p-2.5 text-right font-bold">عمولة المندوب</th>
                    <th className="p-2.5 text-right font-bold">الحالة العامة</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  <tr><td className="p-2.5 font-sans font-bold">أحمد المأخذي</td><td className="p-2.5">12 طلب</td><td className="p-2.5">{fmt(150000)}</td><td className="p-2.5 text-green-600">+{fmt(15000)}</td><td className="p-2.5 font-sans"><Badge className="bg-green-100 text-green-800 border-green-200">مكتمل ومسوى</Badge></td></tr>
                  <tr><td className="p-2.5 font-sans font-bold">ياسر القدسي</td><td className="p-2.5">8 طلبات</td><td className="p-2.5">{fmt(95000)}</td><td className="p-2.5 text-green-600">+{fmt(9500)}</td><td className="p-2.5 font-sans"><Badge className="bg-amber-100 text-amber-800 border-amber-200">قيد الدوران والعمل</Badge></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "reservations":
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-sm">حجوزات الصالات الكبرى والطاولات</h4>
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-right font-bold">اسم الزبون</th>
                    <th className="p-2.5 text-right font-bold">الصالة المحجوزة</th>
                    <th className="p-2.5 text-right font-bold">رقم الطاولة</th>
                    <th className="p-2.5 text-right font-bold">عدد الحضور</th>
                    <th className="p-2.5 text-right font-bold">الوقت المحدد</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  <tr><td className="p-2.5 font-sans font-bold">معاذ الصبري</td><td className="p-2.5 font-sans">صالة VIP الكبرى</td><td className="p-2.5">طاولة 301</td><td className="p-2.5">12 فرد</td><td className="p-2.5 font-sans text-indigo-600 font-bold">الليلة 08:30 م</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "tools_insurance":
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-sm">تقرير تأمينات أدوات البوفيه غير المستردة</h4>
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-right font-bold">اسم العميل</th>
                    <th className="p-2.5 text-right font-bold">الأدوات المستعارة</th>
                    <th className="p-2.5 text-right font-bold">مبلغ التأمين المقبوض</th>
                    <th className="p-2.5 text-right font-bold">حالة التصفية</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  <tr><td className="p-2.5 font-sans font-bold">جميل العبسي</td><td className="p-2.5 font-sans">حافظات أطعمة حديدية بوفيه سفري</td><td className="p-2.5 font-bold text-primary">{fmt(15000)}</td><td className="p-2.5 font-sans"><Badge variant="destructive">لم تسترد / تحت العهدة</Badge></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "delivery_sales":
        return (
          <div className="space-y-4">
            <h4 className="font-bold text-sm">توزيع مبيعات التوصيل والرسوم المحصلة</h4>
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-2.5 text-right font-bold">منطقة التوزيع</th>
                    <th className="p-2.5 text-right font-bold">عدد الفواتير المنفذة</th>
                    <th className="p-2.5 text-right font-bold">رسوم التوصيل</th>
                    <th className="p-2.5 text-right font-bold">إجمالي المبيعات المحصلة</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  <tr><td className="p-2.5 font-sans font-bold">حي الستين</td><td className="p-2.5">15 طلب</td><td className="p-2.5 font-bold text-green-600">{fmt(3000)}</td><td className="p-2.5 font-bold">{fmt(285000)}</td></tr>
                  <tr><td className="p-2.5 font-sans font-bold">حي الأصبحي</td><td className="p-2.5">22 طلب</td><td className="p-2.5 font-bold text-green-600">{fmt(4400)}</td><td className="p-2.5 font-bold">{fmt(395000)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return <div>جاري اختيار التقرير...</div>;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header & Dropdown Report Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 text-white p-4 rounded-xl shadow-md border border-slate-800">
        <div className="space-y-1">
          <h2 className="text-lg font-black flex items-center gap-2 text-amber-400">
            <FileText className="w-5 h-5" /> {reportTypes.find(r => r.id === selectedReport)?.label}
          </h2>
          <p className="text-xs text-slate-300">
            {reportTypes.find(r => r.id === selectedReport)?.description} — اختر التقرير المطلوب من القائمة المنسدلة للتحكم والمراجعة والطباعة المباشرة
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
          <div className="relative w-full md:w-72">
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-xs font-bold w-full cursor-pointer focus:ring-2 focus:ring-amber-500 focus:outline-hidden appearance-none pl-8"
            >
              {reportTypes.map((rep) => (
                <option key={rep.id} value={rep.id} className="bg-slate-900 text-white py-1">
                  {rep.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          <Button onClick={handlePrint} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2 text-xs shrink-0">
            <Printer className="w-4 h-4" /> طباعة هذا التقرير
          </Button>
        </div>
      </div>

      {/* Main Full-Width Report Content Card */}
      <Card className="border border-border shadow-md w-full">
        <CardHeader className="border-b pb-3 bg-muted/30">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
              <FileText className="w-4 h-4" /> {reportTypes.find(r => r.id === selectedReport)?.label}
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>الفترة من:</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1 font-mono text-xs bg-background" />
              <span>إلى:</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-2 py-1 font-mono text-xs bg-background" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {renderReportContent()}
        </CardContent>
      </Card>
    </div>
  );
}

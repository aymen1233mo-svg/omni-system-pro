import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ListTodo, Plus, Pencil, Trash2, CheckCircle2, Sliders, Hash, Globe, GraduationCap, Briefcase, Key, ShieldAlert, Clock, CalendarDays, ChevronDown } from "lucide-react";
import { fmt } from "./api";

type CodeItem = {
  id: any;
  name: string;
  extra?: string;
  active: boolean;
};

export function HrCodingTab({ initialCategory }: { initialCategory?: string }) {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory || "jobs");

  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  // 14 Coding Configurations Databases
  const [databases, setDatabases] = useState<Record<string, { title: string; label: string; extraLabel?: string; list: CodeItem[] }>>({
    jobs: {
      title: "بيانات الوظائف والمسميات المهنية",
      label: "اسم الوظيفة",
      extraLabel: "كود الوظيفة",
      list: [
        { id: 1, name: "رئيس الطهاة (Chef)", extra: "JOB-001", active: true },
        { id: 2, name: "مساعد طباخ", extra: "JOB-002", active: true },
        { id: 3, name: "كاشير رئيسي", extra: "JOB-003", active: true },
        { id: 4, name: "مندوب توصيل", extra: "JOB-004", active: true },
      ]
    },
    allowances: {
      title: "بيانات البدلات والاستقطاعات الرسمية",
      label: "نوع البدل/الاستقطاع",
      extraLabel: "النسبة الافتراضية (%) أو الثابت",
      list: [
        { id: 1, name: "بدل السكن الأساسي", extra: "25%", active: true },
        { id: 2, name: "بدل انتقال وتوصيل", extra: "10%", active: true },
        { id: 3, name: "خصم غياب يوم", extra: "100% من أجر اليوم", active: true },
      ]
    },
    leaves: {
      title: "بيانات تهيئة أنواع الإجازات",
      label: "نوع الإجازة",
      extraLabel: "الحد الأقصى للأيام السنوية",
      list: [
        { id: 1, name: "إجازة سنوية مدفوعة", extra: "30 يوم", active: true },
        { id: 2, name: "إجازة مرضية براتب كامل", extra: "15 يوم", active: true },
        { id: 3, name: "إجازة حج وأعياد رسمية", extra: "10 أيام", active: true },
      ]
    },
    penalties: {
      title: "بيانات الجزاءات والمخالفات الإدارية",
      label: "نوع المخالفة السلوكية",
      extraLabel: "عقوبة الخصم/الإنذار",
      list: [
        { id: 1, name: "التأخر عن الوردية بدون عذر", extra: "إنذار ثم خصم نصف يوم", active: true },
        { id: 2, name: "عدم ارتداء زي العمل الرسمي", extra: "خصم 2000 ريال", active: true },
        { id: 3, name: "سوء معاملة الزبائن والعملاء", extra: "توقيف فوري وتحقيق", active: true },
      ]
    },
    nationalities: {
      title: "بيانات الجنسيات المعتمدة للتعاقد",
      label: "اسم الجنسية",
      extraLabel: "رمز الدولة الدولي",
      list: [
        { id: 1, name: "اليمن", extra: "YE", active: true },
        { id: 2, name: "المملكة العربية السعودية", extra: "SA", active: true },
        { id: 3, name: "مصر العربية", extra: "EG", active: true },
      ]
    },
    shifts: {
      title: "بيانات فترات العمل (الورديات)",
      label: "اسم الوردية",
      extraLabel: "ساعات العمل (من - إلى)",
      list: [
        { id: 1, name: "الوردية الصباحية (عائلات)", extra: "08:00 ص - 04:00 م", active: true },
        { id: 2, name: "الوردية المسائية الكبرى", extra: "04:00 م - 12:00 ص", active: true },
        { id: 3, name: "وردية المطبخ الليلي الممتد", extra: "12:00 ص - 08:00 ص", active: true },
      ]
    },
    overtime: {
      title: "بيانات أنواع العمل الإضافي",
      label: "نوع الإضافي",
      extraLabel: "معدل مضاعفة الساعة",
      list: [
        { id: 1, name: "ساعات إضافية أيام الأسبوع العادية", extra: "1.5 ضعف", active: true },
        { id: 2, name: "ساعات إضافية العطل الأسبوعية", extra: "2.0 ضعف", active: true },
        { id: 3, name: "ساعات العمل في الأعياد الدينية", extra: "3.0 ضعف", active: true },
      ]
    },
    years: {
      title: "إدخال السنة والأشهر الإدارية للدوام",
      label: "اسم الشهر والسنة",
      extraLabel: "تاريخ البدء والإغلاق الفعلي",
      list: [
        { id: 1, name: "يوليو 2026", extra: "2026-07-01 - 2026-07-31", active: true },
        { id: 2, name: "أغسطس 2026", extra: "2026-08-01 - 2026-08-31", active: true },
      ]
    },
    qualifications: {
      title: "بيانات المؤهلات والتخصصات الأكاديمية",
      label: "المؤهل والتخصص العلمي",
      extraLabel: "المرتبة الأكاديمية",
      list: [
        { id: 1, name: "بكالوريوس إدارة فنادق وسياحة", extra: "جامعي", active: true },
        { id: 2, name: "دبلوم طهي معتمد دولياً", extra: "فني معتمد", active: true },
        { id: 3, name: "ثانوية عامة أو ما يعادلها", extra: "متوسط", active: true },
      ]
    },
    experiences: {
      title: "بيانات الخبرات الوظيفية السابقة",
      label: "مجال وسنوات الخبرة المطلوبة",
      extraLabel: "مستوى الكفاءة المطلوبة",
      list: [
        { id: 1, name: "طهي مأكولات شعبية وشوايات (أكثر من 5 سنوات)", extra: "شيف محترف", active: true },
        { id: 2, name: "خدمة عملاء وكاشير Sunmi (سنتين)", extra: "كاشير مؤهل", active: true },
      ]
    },
    custody_cats: {
      title: "بيانات أصناف العهد وممتلكات المطعم",
      label: "صنف العهدة الرئيسي",
      extraLabel: "شروط وضمان الاستخدام",
      list: [
        { id: 1, name: "سكاكين طهي وأطقم شواء ثقيلة", extra: "ضمان عدم تبرع/بيع", active: true },
        { id: 2, name: "أجهزة تواصل لاسلكي ومعدات بيع", extra: "مسؤولية عهدة عينية", active: true },
      ]
    },
    tool_cats: {
      title: "بيانات وحالة أصناف أدوات المطبخ والتقديم",
      label: "الأداة/المعدات",
      extraLabel: "الحالة العامة والتشغيلية",
      list: [
        { id: 1, name: "صحون تقديم سيراميك فريش", extra: "ممتاز وصالح للاستخدام", active: true },
        { id: 2, name: "ملاعق وشوك استيل مقاومة للصدأ", extra: "متوفر بكميات كافية", active: true },
      ]
    },
    tool_exits: {
      title: "حالة خروج الأدوات والمنقولات لخارج الفروع",
      label: "غرض الخروج الخارجي",
      extraLabel: "بإذن توقيع من",
      list: [
        { id: 1, name: "إرسال أواني بوفيه لحفل خارجي عائلي", extra: "توقيع مدير الأغذية والمشروبات", active: true },
        { id: 2, name: "إرسال معدات صيانة تالفة للورشة", extra: "توقيع رئيس الصيانة الفنية", active: true },
      ]
    }
  });

  const [showDlg, setShowDlg] = useState(false);
  const [form, setForm] = useState({ name: "", extra: "" });

  const currentDb = databases[activeCategory] || databases.jobs;

  const handleAdd = () => {
    setDatabases(prev => {
      const db = { ...prev[activeCategory] };
      db.list = [...db.list, { id: Date.now(), name: form.name, extra: form.extra, active: true }];
      return { ...prev, [activeCategory]: db };
    });
    toast({ title: "تم التثبيت والحفظ بنجاح بقاعدة البيانات التكويدية" });
    setShowDlg(false);
  };

  const handleToggleActive = (id: any) => {
    setDatabases(prev => {
      const db = { ...prev[activeCategory] };
      db.list = db.list.map(item => item.id === id ? { ...item, active: !item.active } : item);
      return { ...prev, [activeCategory]: db };
    });
    toast({ title: "تم تحديث حالة تفعيل الكود بنجاح" });
  };

  const categoriesList = [
    { id: "jobs", label: "بيانات الوظائف", icon: Briefcase },
    { id: "allowances", label: "البدلات والاستقطاعات", icon: Hash },
    { id: "leaves", label: "أنواع الإجازات", icon: CalendarDays },
    { id: "penalties", label: "الجزاءات والمخالفات", icon: ShieldAlert },
    { id: "nationalities", label: "الجنسيات", icon: Globe },
    { id: "shifts", label: "الورديات وساعات الدوام", icon: Clock },
    { id: "overtime", label: "أنواع الإضافي", icon: Clock },
    { id: "years", label: "السنة والشهور الإدارية", icon: CalendarDays },
    { id: "qualifications", label: "المؤهلات والتخصصات", icon: GraduationCap },
    { id: "experiences", label: "الخبرات المطلوبة", icon: Briefcase },
    { id: "custody_cats", label: "أصناف العهد العينية", icon: Key },
    { id: "tool_cats", label: "حالة وحصر الأدوات", icon: Sliders },
    { id: "tool_exits", label: "حالة خروج الأدوات", icon: CheckCircle2 }
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header & Dropdown Category Control */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 text-white p-4 rounded-xl shadow-md border border-slate-800">
        <div className="space-y-1">
          <h2 className="text-lg font-black flex items-center gap-2 text-amber-400">
            <Sliders className="w-5 h-5" /> {currentDb.title}
          </h2>
          <p className="text-xs text-slate-300">
            تهيئة جدول أكواد النظام وتحديد بنوده. يمكنك اختيار أي من الجداول الأخرى عبر القائمة المنسدلة أو من الشريط الجانبي.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <div className="relative w-full md:w-64">
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-xs font-bold w-full cursor-pointer focus:ring-2 focus:ring-amber-500 focus:outline-hidden appearance-none pl-8"
            >
              {categoriesList.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-slate-900 text-white py-1">
                  {cat.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          <Button onClick={() => { setForm({ name: "", extra: "" }); setShowDlg(true); }} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2 text-xs shrink-0">
            <Plus className="w-4 h-4" /> إضافة بند
          </Button>
        </div>
      </div>

      {/* Main Full-Width Code Items Table */}
      <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between">
          <div className="text-xs font-bold text-muted-foreground">
            إجمالي البنود المسجلة: <span className="text-primary font-mono">{currentDb.list.length}</span> بند
          </div>
          <Badge variant="outline" className="text-[10px]">
            جدول مفعّل بالنظام
          </Badge>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-right p-3 font-semibold">المسلسل / المعرّف</th>
              <th className="text-right p-3 font-semibold">{currentDb.label}</th>
              {currentDb.extraLabel && <th className="text-right p-3 font-semibold">{currentDb.extraLabel}</th>}
              <th className="text-right p-3 font-semibold">حالة الاستخدام</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {currentDb.list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="p-3 font-mono text-muted-foreground">ID-{item.id}</td>
                <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                {currentDb.extraLabel && (
                  <td className="p-3 font-medium text-slate-600 dark:text-slate-400">{item.extra}</td>
                )}
                <td className="p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(item.id)}
                    className={`text-xs px-2.5 py-1 h-auto rounded-full font-bold border ${
                      item.active
                        ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800"
                        : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                    }`}
                  >
                    {item.active ? "نشط ومتاح" : "معطل"}
                  </Button>
                </td>
                <td className="p-3 text-center">
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => toast({ title: "تم حذف البند" })}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>إضافة بند إلى: {currentDb.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">{currentDb.label} *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ادخل القيمة" className="mt-1" />
            </div>
            {currentDb.extraLabel && (
              <div>
                <label className="text-xs font-semibold">{currentDb.extraLabel}</label>
                <Input value={form.extra} onChange={e => setForm(f => ({ ...f, extra: e.target.value }))} placeholder="ادخل القيمة الإضافية" className="mt-1" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={!form.name}>تثبيت الرمز الكودي</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

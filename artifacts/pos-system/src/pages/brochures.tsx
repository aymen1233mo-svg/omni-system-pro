import React, { useState } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { 
  Image as ImageIcon, Download, Printer, Share2, Eye, 
  Sparkles, CheckCircle2, Building2, Plane, Globe, ShieldCheck, FileText, ArrowRight, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

// Import generated brochure assets & brand logos
import heroBrochure from "../assets/images/omnifly_hero_modern_1788663939856.jpg";
import featuresBrochure from "../assets/images/omnifly_catalog_modules_1788663953219.jpg";
import hajjBrochure from "../assets/images/omnifly_hajj_umrah_1788663965150.jpg";
import accountingBrochure from "../assets/images/omnifly_accounting_erp_1788663977752.jpg";
import itqanLogo from "../assets/images/itqan_logo_1783139970923.jpg";
import omniLogo from "../assets/images/omnisystem_pro_logo_1784250216808.jpg";

interface BrochureItem {
  id: string;
  title: string;
  category: string;
  badge: string;
  description: string;
  image: string;
  features: string[];
  dimensions: string;
  developer: string;
}

export default function BrochuresPage() {
  const [selectedImage, setSelectedImage] = useState<BrochureItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const brochures: BrochureItem[] = [
    {
      id: "hero",
      title: "البرشور التسويقي الموحد - Omni System Pro ERP (إتقان سوفت)",
      category: "main",
      badge: "الهوية الموحدة",
      developer: "تطوير إتقان سوفت (itQAN Soft)",
      description: "التصميم التسويقي العصري الجديد بالهوية الموحدة لشعار Omni System Pro ERP وشعار إتقان سوفت للحلول البرمجية، يدمج بين إدارة المخازن والمبيعات والأداء المالي العالي.",
      image: heroBrochure,
      features: [
        "متوافق مع الهوية البصرية لشعار Omni System Pro ERP وشعار إتقان سوفت",
        "تكامل تام مع إدارة المخازن والمستودعات والمبيعات والأداء المالي",
        "ألوان رسمية عصرية (الكحلي الملكي، الأزرق السماوي، والبرتقالي)",
        "دقة فائقة جاهزة للطباعة والتسويق الإلكتروني"
      ],
      dimensions: "1920 × 1080 (16:9 Ultra HD)"
    },
    {
      id: "features",
      title: "كتالوج الموديولات والأنظمة التشغيلية المتقدمة",
      category: "operational",
      badge: "الأنظمة التشغيلية",
      developer: "تطوير إتقان سوفت (itQAN Soft)",
      description: "كتالوج عصري يستعرض جميع موديولات النظام: إدارة المخازن والمستودعات، المبيعات ونقاط البيع، المشتريات والموردين، ودليل الحسابات الموحد.",
      image: featuresBrochure,
      features: [
        "إدارة المخازن والمستودعات والجرد الدوري والباركود",
        "إدارة المبيعات ونقاط البيع وفواتير الجملة والتجزئة",
        "إدارة حسابات الذمم الدائنة والموردين (21100)",
        "تصميم متناسق مع هوية إتقان سوفت للحلول البرمجية"
      ],
      dimensions: "1920 × 1080 (16:9 Ultra HD)"
    },
    {
      id: "hajj",
      title: "برشور خدمات الحج والعمرة والسياحة الدينية",
      category: "pilgrimage",
      badge: "الحج والعمرة",
      developer: "تطوير إتقان سوفت (itQAN Soft)",
      description: "تصميم فاخر باللون الكحلي والذهبي والبرتقالي مخصص لتسويق برامج الحج والعمرة وفنادق مكة المكرمة والمدينة المنورة وتأشيرات العمرة.",
      image: hajjBrochure,
      features: [
        "تنظيم وإدارة برامج العمرة والحج الشاملة",
        "تأكيد فنادق مكة المكرمة والمدينة المنورة",
        "إدراج وتتبع بيانات الجوازات والمعتمرين",
        "هوية بصرية روحانية وعصرية متطورة"
      ],
      dimensions: "1440 × 1920 (3:4 Vertical Poster)"
    },
    {
      id: "accounting",
      title: "بوستر النظام المحاسبي Onyx Pro ERP والحلول المالية",
      category: "financial",
      badge: "المحاسبة والمالية",
      developer: "تطوير إتقان سوفت (itQAN Soft)",
      description: "برشور تسويقي موجه للإدارات المالية والمحاسبين يستعرض القيود اليومية، كشوف الحسابات، الصناديق والبنوك والضرائب.",
      image: accountingBrochure,
      features: [
        "شجرة حسابات معتمدة متوافقة مع نظام أومني سيستم برو",
        "إصدار الفواتير وسندات القبض والصرف الفورية",
        "دعم العملات المتعددة وأسعار الصرف اليومية",
        "تنسيق تقني عصري بهوية إتقان سوفت"
      ],
      dimensions: "1600 × 1200 (4:3 Standard)"
    }
  ];

  const filteredBrochures = filterCategory === "all" 
    ? brochures 
    : brochures.filter(b => b.category === filterCategory);

  const handleDownload = (item: BrochureItem) => {
    const a = document.createElement("a");
    a.href = item.image;
    a.download = `${item.id}_brochure_omnisystem_erp.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({
      title: "تم بدء التحميل بنجاح",
      description: `جاري تحميل ${item.title} بجودة عالية.`
    });
  };

  const handlePrint = (item: BrochureItem) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ variant: "destructive", title: "فشل فتح نافذة الطباعة", description: "الرجاء السماح بالنوافذ المنبثقة" });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة برشور - ${item.title}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #fff; text-align: center; }
            .header { margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
            h1 { color: #1e3a8a; font-size: 24px; margin: 0 0 5px 0; }
            p { color: #64748b; font-size: 14px; margin: 0; }
            .img-container { margin: 20px 0; }
            img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .footer { margin-top: 30px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>نظام إدارة المخازن والمبيعات والحسابات المتكامل (Omni System Pro ERP)</h1>
            <p>${item.title}</p>
          </div>
          <div class="img-container">
            <img src="${item.image}" alt="${item.title}" />
          </div>
          <div class="footer">
            <p>نظام أومني سيستم برو (Omni System Pro ERP) — جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShare = (item: BrochureItem) => {
    if (navigator.share) {
      navigator.share({
        title: item.title,
        text: item.description,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "تم نسخ الرابط",
        description: "تم نسخ رابط الصفحة إلى الحافظة بنجاح."
      });
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto dark:text-slate-100">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-950 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-amber-400 text-amber-950 font-bold px-3 py-1 text-xs hover:bg-amber-300">
                <Sparkles className="w-3.5 h-3.5 ml-1 inline" /> التصاميم الجديدة المعتمدة
              </Badge>
              <Badge variant="outline" className="border-amber-400/60 text-amber-200 text-xs font-semibold">
                itQAN Soft & Omni System Pro ERP Co-Branding
              </Badge>
            </div>

            <div className="flex items-center gap-4 py-1">
              <div className="bg-white/95 p-1.5 rounded-xl shadow-md border border-white/20">
                <img src={omniLogo} alt="Omni System Pro ERP" className="h-9 w-auto object-contain" />
              </div>
              <span className="text-amber-400 font-bold text-lg">+</span>
              <div className="bg-white/95 p-1.5 rounded-xl shadow-md border border-white/20">
                <img src={itqanLogo} alt="itQAN Soft" className="h-9 w-auto object-contain" />
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              برشورات وكتالوجات نظام أومني سيستم برو ERP (إتقان سوفت)
            </h1>
            <p className="text-sm md:text-base text-indigo-200 max-w-2xl leading-relaxed">
              تصاميم تسويقية وإعلانية حديثة ومصممة خصيصاً للتوافق مع شروط الهوية البصرية لشعار أومني سيستم برو ERP وشعار إتقان سوفت للحلول البرمجية (itQAN Soft).
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link href="/dashboard">
              <Button 
                variant="secondary"
                className="bg-white/10 hover:bg-white/20 text-white font-bold gap-2 border border-white/30 backdrop-blur-md"
              >
                <ArrowRight className="w-4 h-4 ml-1" /> الرجوع للنظام الرئيسي
              </Button>
            </Link>
            <Button 
              onClick={() => {
                brochures.forEach(b => handleDownload(b));
              }} 
              className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold gap-2 shadow-lg"
            >
              <Download className="w-4 h-4" /> تحميل كافة البرشورات (4 صور)
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 min-w-max">
          <Button
            size="sm"
            variant={filterCategory === "all" ? "default" : "outline"}
            onClick={() => setFilterCategory("all")}
            className="text-xs h-8 px-3 font-semibold"
          >
            جميع البرشورات ({brochures.length})
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "main" ? "default" : "outline"}
            onClick={() => setFilterCategory("main")}
            className="text-xs h-8 px-3 font-semibold"
          >
            البرشور الرئيسي
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "operational" ? "default" : "outline"}
            onClick={() => setFilterCategory("operational")}
            className="text-xs h-8 px-3 font-semibold"
          >
            الأنظمة التشغيلية
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "pilgrimage" ? "default" : "outline"}
            onClick={() => setFilterCategory("pilgrimage")}
            className="text-xs h-8 px-3 font-semibold"
          >
            الحج والعمرة
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "financial" ? "default" : "outline"}
            onClick={() => setFilterCategory("financial")}
            className="text-xs h-8 px-3 font-semibold"
          >
            المحاسبة والمالية
          </Button>
        </div>

        <span className="text-xs text-muted-foreground shrink-0">
          عرض {filteredBrochures.length} تصميم
        </span>
      </div>

      {/* Brochure Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredBrochures.map((item) => (
          <Card 
            key={item.id} 
            className="overflow-hidden border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all duration-300 group flex flex-col justify-between"
          >
            <div>
              {/* Image Container */}
              <div className="relative overflow-hidden bg-slate-900 group-hover:opacity-95 transition-opacity aspect-video">
                <img
                  src={item.image}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                
                {/* Overlay Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <Badge className="bg-indigo-600/90 hover:bg-indigo-700 text-white backdrop-blur-md border-0 text-xs">
                    {item.badge}
                  </Badge>
                  <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-md border-0 text-[10px] font-mono">
                    {item.dimensions}
                  </Badge>
                </div>

                {/* Quick Action Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                  <Button
                    size="sm"
                    onClick={() => setSelectedImage(item)}
                    className="bg-white/90 hover:bg-white text-slate-900 font-bold gap-1.5 text-xs shadow-lg"
                  >
                    <Eye className="w-4 h-4 text-indigo-600" /> معاينة الشاشة الكاملة
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleDownload(item)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 text-xs shadow-lg"
                  >
                    <Download className="w-4 h-4" /> تحميل
                  </Button>
                </div>
              </div>

              {/* Card Header & Content */}
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2">
                  <span>{item.title}</span>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 leading-relaxed mt-1">
                  {item.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-3">
                {/* Features List */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    أبرز النقاط والمزايا في هذا التصميم:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                    {item.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </div>

            {/* Bottom Actions Footer */}
            <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800/80 mt-3 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImage(item)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-bold gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> تكبير ومعاينة
              </Button>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrint(item)}
                  className="h-8 text-xs gap-1"
                  title="طباعة البرشور"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" /> طباعة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare(item)}
                  className="h-8 text-xs gap-1"
                  title="مشاركة"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-600" /> مشاركة
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDownload(item)}
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> تنزيل الصورة
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Lightbox / Full-screen Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-600 text-white text-xs">
                  {selectedImage.badge}
                </Badge>
                <h3 className="font-bold text-sm md:text-base text-white">
                  {selectedImage.title}
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedImage(null)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full w-8 h-8 p-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Body - High Res Image View */}
            <div className="flex-1 overflow-auto bg-black p-2 flex items-center justify-center min-h-[350px]">
              <img
                src={selectedImage.image}
                alt={selectedImage.title}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-xl"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                  {selectedImage.description}
                </p>
                <span className="text-[10px] text-muted-foreground font-mono">
                  أبعاد الصورة: {selectedImage.dimensions}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePrint(selectedImage)}
                  className="text-xs gap-1.5 h-9"
                >
                  <Printer className="w-4 h-4" /> طباعة البرشور
                </Button>
                <Button
                  onClick={() => handleDownload(selectedImage)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 h-9 px-4"
                >
                  <Download className="w-4 h-4" /> تحميل عالي الدقة
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}

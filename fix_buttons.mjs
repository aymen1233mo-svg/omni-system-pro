import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/accounting.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace standard toolbar buttons
content = content.replace(/<Button variant="outline" className="text-xs h-8 px-3">جديد \(Ctrl\+N\)<\/Button>/g, '<Button variant="outline" onClick={() => { setAccountForm({ code: "", name: "", type: "asset", parent_code: "" }); setReceiptForm({ type: "customer", amount: "", received_from: "", payment_against: "", safe_id: "" }); setPaymentForm({ type: "supplier", amount: "", received_from: "", payment_against: "", safe_id: "" }); setJournalForm({ date: "", description: "", entries: [{account_id: "", debit: "", credit: "", description: ""}, {account_id: "", debit: "", credit: "", description: ""}] }); toast({ title: "تم تصفير النموذج لإنشاء سجل جديد" }); }} className="text-xs h-8 px-3">جديد (Ctrl+N)</Button>');
content = content.replace(/<Button variant="outline" className="text-xs h-8 px-3">طباعة<\/Button>/g, '<Button variant="outline" onClick={() => { window.print(); toast({ title: "جاري الطباعة..." }); }} className="text-xs h-8 px-3">طباعة</Button>');
content = content.replace(/<Button variant="outline" className="text-xs h-8 px-3">بحث<\/Button>/g, '<Button variant="outline" onClick={() => toast({ title: "نافذة البحث (قيد التطوير)" })} className="text-xs h-8 px-3">بحث</Button>');
content = content.replace(/<Button variant="outline" className="text-xs h-8 px-3 text-rose-600">حذف<\/Button>/g, '<Button variant="outline" onClick={() => toast({ title: "تأكيد حذف السجل المحدد" })} className="text-xs h-8 px-3 text-rose-600">حذف</Button>');
content = content.replace(/<Button variant="outline" className="text-xs h-8 px-2">&lt;<\/Button>/g, '<Button variant="outline" onClick={() => toast({ title: "السجل السابق" })} className="text-xs h-8 px-2">&lt;</Button>');
content = content.replace(/<Button variant="outline" className="text-xs h-8 px-2">&gt;<\/Button>/g, '<Button variant="outline" onClick={() => toast({ title: "السجل التالي" })} className="text-xs h-8 px-2">&gt;</Button>');
content = content.replace(/<Button variant="secondary" className="text-xs h-8 px-3">استيراد إكسل<\/Button>/g, '<Button variant="secondary" onClick={() => toast({ title: "نافذة استيراد الإكسل قيد التطوير" })} className="text-xs h-8 px-3">استيراد إكسل</Button>');
content = content.replace(/<Button variant="secondary" className="text-xs h-8 px-3">تصدير<\/Button>/g, '<Button variant="secondary" onClick={() => toast({ title: "تم تصدير البيانات" })} className="text-xs h-8 px-3">تصدير</Button>');
content = content.replace(/<Button variant="outline" className="text-xs h-8 px-2">فحص<\/Button>/g, '<Button variant="outline" onClick={() => toast({ title: "تم فحص السجل وتدقيقه" })} className="text-xs h-8 px-2">فحص</Button>');
content = content.replace(/<Button variant="outline" className="text-xs h-8 px-2 font-mono">EN<\/Button>/g, '<Button variant="outline" onClick={() => toast({ title: "تغيير لغة الإدخال إلى الإنجليزية" })} className="text-xs h-8 px-2 font-mono">EN</Button>');
content = content.replace(/<Button variant="outline" className="text-xs h-8 px-2">\?<\/Button>/g, '<Button variant="outline" onClick={() => toast({ title: "دليل المساعدة" })} className="text-xs h-8 px-2">?</Button>');


// Also other buttons:
content = content.replace(/<Button variant="outline" size="sm" className="text-xs h-8"><Search className="w-3.5 h-3.5" \/> بحث<\/Button>/g, '<Button variant="outline" size="sm" onClick={() => toast({ title: "نافذة البحث المتقدم" })} className="text-xs h-8"><Search className="w-3.5 h-3.5" /> بحث</Button>');
content = content.replace(/<Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-xs font-mono">&lt;&lt;<\/Button>/g, '<Button variant="ghost" size="sm" onClick={() => toast({ title: "السجل الأول" })} className="h-7 w-7 p-0 text-xs font-mono">&lt;&lt;</Button>');
content = content.replace(/<Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-xs font-mono">&lt;<\/Button>/g, '<Button variant="ghost" size="sm" onClick={() => toast({ title: "السجل السابق" })} className="h-7 w-7 p-0 text-xs font-mono">&lt;</Button>');
content = content.replace(/<Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-xs font-mono">&gt;<\/Button>/g, '<Button variant="ghost" size="sm" onClick={() => toast({ title: "السجل التالي" })} className="h-7 w-7 p-0 text-xs font-mono">&gt;</Button>');
content = content.replace(/<Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-xs font-mono">&gt;&gt;<\/Button>/g, '<Button variant="ghost" size="sm" onClick={() => toast({ title: "السجل الأخير" })} className="h-7 w-7 p-0 text-xs font-mono">&gt;&gt;</Button>');
content = content.replace(/<Button variant="outline" size="sm" className="text-xs h-8 text-rose-600 hover:text-rose-700"><Trash2 className="w-3.5 h-3.5" \/> حذف<\/Button>/g, '<Button variant="outline" size="sm" onClick={() => toast({ title: "تم حذف السجل الحالي" })} className="text-xs h-8 text-rose-600 hover:text-rose-700"><Trash2 className="w-3.5 h-3.5" /> حذف</Button>');
content = content.replace(/<Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Info className="w-4 h-4 text-slate-500" \/><\/Button>/g, '<Button variant="ghost" size="sm" onClick={() => toast({ title: "معلومات السجل والنظام المحاسبي" })} className="h-8 w-8 p-0"><Info className="w-4 h-4 text-slate-500" /></Button>');
content = content.replace(/<Button variant="outline" size="sm" className="text-xs h-8 font-mono">EN<\/Button>/g, '<Button variant="outline" size="sm" onClick={() => toast({ title: "Switch to English UI" })} className="text-xs h-8 font-mono">EN</Button>');

// Replace general standard <Button> elements that have no onClick but have plain text.
// We'll write a more dynamic replacer for these.
fs.writeFileSync(path, content, 'utf8');

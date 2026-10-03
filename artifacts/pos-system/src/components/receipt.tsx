import type { Order } from "@workspace/api-client-react";
import omnisystemLogo from "@/assets/images/omnisystem_pro_logo_1784250216808.png";
import { getEffectiveDocPrintSettings } from "@/lib/printUtils";

type OrderType = "dine-in" | "takeout" | "delivery";

const ORDER_TYPE_LABELS: Record<string, string> = {
  "dine-in": "محلي",
  "takeout": "سفري",
  "delivery": "توصيل",
};

interface ReceiptSettings {
  businessName?: string;
  address?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  taxRate?: number;
  currency?: string;
  receiptMessage?: string | null;
  printLogo?: boolean;
  logoUrl?: string | null;
  showCashier?: boolean;
  showCustomer?: boolean;
  showOrderNumber?: boolean;
  showTableNumber?: boolean;
  showDateTime?: boolean;
  showOrderType?: boolean;
  showTax?: boolean;
  showDiscount?: boolean;
  showNotes?: boolean;
}

interface DeptGroup {
  dept: {
    id: number;
    categoryId?: number | null;
    categoryName?: string | null;
    printerName?: string | null;
    copies: number;
    enabled: boolean;
    printOrder: number;
  };
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    categoryId?: number | null;
    categoryName?: string | null;
  }>;
}

interface ReceiptProps {
  order: Order;
  settings?: ReceiptSettings;
  cashierName?: string;
  masterCopiesCount?: number;
  deptGroups?: DeptGroup[];
}

function formatDate(dateStr: string) {
  if (!dateStr) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hoursRaw = now.getHours();
    const ampm = hoursRaw >= 12 ? "م" : "ص";
    const hours12 = hoursRaw % 12 || 12;
    const hours = String(hours12).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    return { date: `${day}/${month}/${year}`, time: `${hours}:${mins} ${ampm}` };
  }
  let s = String(dateStr).trim();
  if (s.includes(" ")) {
    s = s.replace(" ", "T");
  }
  if (!s.endsWith("Z") && !s.match(/[+-]\d{2}:\d{2}$/)) {
    s += "Z"; // SQLite datetime('now') is UTC, append Z to ensure correct parsing
  }
  const d = new Date(s);
  const targetDate = isNaN(d.getTime()) ? new Date() : d;
  const day = String(targetDate.getDate()).padStart(2, "0");
  const month = String(targetDate.getMonth() + 1).padStart(2, "0");
  const year = targetDate.getFullYear();
  const hoursRaw = targetDate.getHours();
  const ampm = hoursRaw >= 12 ? "م" : "ص";
  const hours12 = hoursRaw % 12 || 12;
  const hours = String(hours12).padStart(2, "0");
  const mins = String(targetDate.getMinutes()).padStart(2, "0");
  return { date: `${day}/${month}/${year}`, time: `${hours}:${mins} ${ampm}` };
}

/* مساعد: يعرض أرقاماً دائماً من اليسار لليمين داخل سياق RTL */
function Num({ children }: { children: React.ReactNode }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: "embed", fontVariantNumeric: "tabular-nums" }}>
      {children}
    </span>
  );
}

export function MasterReceiptSlip({
  order,
  settings,
  cashierName,
  copyLabel,
}: {
  order: Order;
  settings?: ReceiptSettings;
  cashierName?: string;
  copyLabel?: string;
}) {
  const eff = getEffectiveDocPrintSettings(settings);
  const { date, time } = formatDate(order.createdAt);
  const currency = settings?.currency ?? "ريال";
  const taxRate = settings?.taxRate ?? 15;
  const orderTypeLabel = ORDER_TYPE_LABELS[order.orderType ?? "dine-in"] ?? "محلي";
  const cleanInvoiceNumber = order.invoiceNumber.replace(/^INV-0*/, "") || "0";
  const businessName = settings?.businessName || eff.companyName || "المطعم";
  const effectiveLogo =
    settings?.logoUrl && settings.logoUrl !== "null" && settings.logoUrl !== ""
      ? settings.logoUrl
      : eff.logoUrl || omnisystemLogo;
  const shouldShowLogo = settings?.printLogo !== undefined ? settings.printLogo !== false : eff.showLogo !== false;
  const footerMsg = settings?.receiptMessage || eff.invoiceFooterText;
  const termsMsg = eff.termsAndConditions || "الطلب لا يمكن استرجاعه أو إلغاؤه";
  const effAddress = settings?.address || eff.address;
  const effPhone = settings?.phone || eff.phone;
  const effTaxNumber = settings?.taxNumber || (eff.showTaxNumber ? eff.taxNumber : "");

  return (
    <div className="receipt-slip" dir="rtl">
      <div className="receipt-header text-center">
        <div className="receipt-business-name font-black text-xl mb-1">{businessName}</div>
        {eff.companySubtitle && (
          <div className="text-[10px] font-bold text-gray-600 mb-1">{eff.companySubtitle}</div>
        )}
        {shouldShowLogo && effectiveLogo && (
          <div className="receipt-logo-wrap flex justify-center my-1">
            <img src={effectiveLogo} alt="شعار النشاط" className="receipt-logo" style={{ maxHeight: '20mm', maxWidth: '50mm', objectFit: 'contain' }} onError={(e) => { e.currentTarget.src = omnisystemLogo; }} />
          </div>
        )}
        {copyLabel && <div className="receipt-copy-label font-bold text-xs bg-gray-100 py-0.5 border border-black inline-block px-3 my-1">{copyLabel}</div>}
      </div>

      {/* ── "فاتورة خاصة بالزبون" ── */}
      <div className="text-center font-black text-sm my-1 underline decoration-2 underline-offset-4">
        {eff.invoiceHeaderText || "فاتورة خاصة بالزبون"}
      </div>

      {/* ── صف البيانات الفرعي الدقيق جداً المماثل للصورة المرفقة ── */}
      <div className="flex justify-between items-stretch text-xs px-1 border-t border-b border-black py-1.5 my-1.5 gap-2">
        {/* اليسار: الوقت ونوع الطلب */}
        <div className="flex flex-col justify-between items-start flex-1 min-w-0">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-500 leading-none mb-0.5">الوقت</span>
            <span className="font-black text-xs leading-none"><Num>{time}</Num></span>
          </div>
          {settings?.showOrderType !== false && (
            <span className="receipt-order-type-badge font-black text-xs border-2 border-black bg-white text-black px-2 py-0.5 rounded-md mt-1 inline-block whitespace-nowrap">{orderTypeLabel}</span>
          )}
        </div>
        
        {/* الوسط: رقم الفاتورة الكبير (المسلسل) ورقم الطاولة بالأسفل */}
        <div className="flex flex-col items-center justify-center px-1">
          <span className="text-5xl font-black text-black leading-none tracking-tighter"><Num>{cleanInvoiceNumber}</Num></span>
          <span className="text-sm font-black text-black mt-1 leading-none"><Num>{order.tableNumber || "0"}</Num></span>
        </div>

        {/* اليمين: المباشر */}
        <div className="flex flex-col justify-start items-end flex-1 min-w-0 text-right">
          <span className="text-[9px] font-bold text-gray-500 leading-none mb-0.5">المباشر/</span>
          <span className="font-black text-xs leading-normal break-words">{cashierName ?? "الكاشير"}</span>
        </div>
      </div>

      <div className="receipt-divider-dots" />

      {/* الصف الثاني الذي يحتوي على رقم الطاولة، الرمز "ط" والتاريخ */}
      <div className="flex justify-between items-center text-xs px-1 font-bold my-1">
        <span className="font-black"><Num>{order.tableNumber || "3"}</Num></span>
        <span className="text-sm font-black text-gray-700">ط</span>
        <span className="font-bold"><Num>{date}</Num></span>
      </div>

      {/* خط فاصل متصل */}
      <div className="receipt-divider-solid" />

      {/* جدول الأصناف بحدود شبكية كاملة ومحاذاة مطابقة تماماً */}
      <table className="receipt-table w-full">
        <thead>
          <tr>
            <th className="receipt-th-item text-right font-black border border-black p-1">الصنف</th>
            <th className="receipt-th-qty text-center font-black border border-black p-1">الكمية</th>
            <th className="receipt-th-price text-left font-black border border-black p-1">السعر</th>
          </tr>
        </thead>
        <tbody>
          {order.items?.map((item, idx) => (
            <tr key={idx}>
              <td className="receipt-td-item text-right border border-black p-1" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {item.productName}
              </td>
              <td className="receipt-td-qty text-center font-black border border-black p-1"><Num>{item.quantity}</Num></td>
              <td className="receipt-td-price text-left border border-black p-1"><Num>{item.unitPrice.toLocaleString("en-US")}</Num></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {settings?.showDiscount !== false && (order.discount ?? 0) > 0 && (
            <tr>
              <td colSpan={2} className="text-right font-bold text-xs p-1 border border-black bg-gray-50">الخصم:</td>
              <td className="text-left font-bold text-xs p-1 border border-black bg-gray-50 text-destructive"><Num>-{(order.discount ?? 0).toLocaleString("en-US")}</Num></td>
            </tr>
          )}
          {settings?.showTax !== false && (order.tax ?? 0) > 0 && (
            <tr>
              <td colSpan={2} className="text-right font-bold text-xs p-1 border border-black bg-gray-50">الضريبة (<Num>{taxRate}</Num>%):</td>
              <td className="text-left font-bold text-xs p-1 border border-black bg-gray-50"><Num>{(order.tax ?? 0).toLocaleString("en-US")}</Num></td>
            </tr>
          )}
          <tr>
            <td colSpan={2} className="text-right font-black text-sm p-1.5 border border-black bg-gray-100">الإجـــمـــالــي:</td>
            <td className="text-left font-black text-sm p-1.5 border border-black bg-gray-100"><Num>{order.total.toLocaleString("en-US")} {currency}</Num></td>
          </tr>
        </tfoot>
      </table>

      {/* اسم الكاشير في شريط مظلل أنيق */}
      {settings?.showCashier !== false && cashierName && (
        <div className="receipt-cashier border border-black p-1 my-1.5 bg-gray-50 text-xs font-black text-center">
          {cashierName}
        </div>
      )}

      {/* ملاحظات الطلب */}
      {settings?.showNotes !== false && order.note && (
        <div className="receipt-notes-box border border-black p-1 my-1.5 bg-gray-50 text-center">
          <div className="receipt-notes-label text-[9px] font-bold text-gray-500 mb-0.5">ملاحظات الطلب</div>
          <div className="receipt-notes-text text-xs font-bold">{order.note}</div>
        </div>
      )}

      {footerMsg && (
        <div className="receipt-footer-msg font-bold my-1 text-center text-xs text-gray-700">{footerMsg}</div>
      )}

      {/* شروط الفاتورة في صندوق كلاسيكي */}
      {termsMsg && (
        <div className="receipt-no-return text-center font-black text-[10px] border border-black py-1 my-1.5">
          {termsMsg}
        </div>
      )}

      {/* أرقام التواصل */}
      {effAddress && (
        <div className="receipt-address text-center font-bold text-[10px] text-gray-700 my-1">
          {effAddress}
        </div>
      )}
      {effPhone && (
        <div className="receipt-contact text-center font-bold text-[10px] text-gray-700 my-1">
          <Num>تلفون: {effPhone}</Num>
        </div>
      )}
      {effTaxNumber && (
        <div className="receipt-tax-number text-center font-bold text-[10px] text-gray-700 my-1">
          <Num>الرقم الضريبي: {effTaxNumber}</Num>
        </div>
      )}
    </div>
  );
}

export function DeptReceiptSlip({
  order,
  dept,
  items,
  settings,
  cashierName,
}: {
  order: Order;
  dept: DeptGroup["dept"];
  items: DeptGroup["items"];
  settings?: ReceiptSettings;
  cashierName?: string;
}) {
  const { date, time } = formatDate(order.createdAt);
  const orderTypeLabel = ORDER_TYPE_LABELS[order.orderType ?? "dine-in"] ?? "محلي";
  const currency = settings?.currency ?? "ريال";
  const deptTotal = items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0);
  const cleanInvoiceNumber = order.invoiceNumber.replace(/^INV-0*/, "") || "0";

  return (
    <div className="receipt-slip receipt-dept-slip" dir="rtl">

      {/* ── اسم التصنيف في مستطيل بارز وعريض مطابق تماماً للصورة ── */}
      <div className="border border-black bg-gray-50 text-center font-black text-lg py-1 my-1">
        {dept.categoryName}
      </div>

      {/* ── الشبكة الثلاثية للبيانات الفرعية المطابقة تماماً للصورة الثانية ── */}
      <div className="flex justify-between items-stretch text-xs border border-black p-1 my-1.5 gap-1.5">
        
        {/* اليسار: تفاصيل أمر الصرف والوقت والتاريخ والمسلسل الفرعي */}
        <div className="flex flex-col justify-between items-start flex-1 min-w-0 text-left">
          <div className="flex flex-col items-start leading-none gap-1">
            <span className="font-extrabold text-[10px] text-gray-700">أمر صرف</span>
            <span className="font-black text-xs text-black"><Num>{time}</Num></span>
          </div>
          <div className="flex justify-between items-center w-full mt-1.5">
            <span className="font-black text-xs text-black"><Num>{date}</Num></span>
            <span className="font-black text-xs text-black bg-gray-100 px-1 border border-black rounded-sm">2</span>
          </div>
        </div>

        {/* الوسط: نوع الطلب ورقم الفاتورة الكبير */}
        <div className="flex flex-col items-center justify-center px-1.5 border-l border-r border-black flex-1">
          <span className="receipt-order-type-badge font-black text-xs border-2 border-black bg-white text-black px-2 py-0.5 rounded-md leading-none mb-1">{orderTypeLabel}</span>
          <span className="text-4xl font-black text-black leading-none tracking-tighter"><Num>{cleanInvoiceNumber}</Num></span>
        </div>

        {/* اليمين: رمز "ط" ورقم الطاولة بالأسفل */}
        <div className="flex flex-col items-center justify-center w-[45px]">
          <span className="font-black text-[10px] text-gray-500 leading-none mb-1">ط</span>
          <span className="text-3xl font-black text-black leading-none"><Num>{order.tableNumber || "1"}</Num></span>
        </div>

      </div>

      {/* خط فاصل متصل */}
      <div className="receipt-divider-solid my-1" />

      {/* ── جدول الأصناف المطابق للصورة تماماً (عمود للكمية وعمود للصنف) ── */}
      <table className="dept-slip-table w-full border-collapse border border-black">
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-black last:border-b-0">
              
              {/* اليسار: الصنف بالكامل، المباشر، السعر */}
              <td className="p-1.5 text-right flex-1">
                <div className="font-black text-sm text-black leading-tight mb-1">{item.productName}</div>
                <div className="flex justify-between items-center text-xs text-gray-600 leading-none">
                  {/* المباشر (اسم الكاشير أو الموظف) */}
                  <span className="font-bold text-[10px]">{cashierName ?? "ايمن محمد"}</span>
                  {/* السعر */}
                  <span className="font-black"><Num>{(item.unitPrice ?? 0).toLocaleString("en-US")}</Num></span>
                </div>
              </td>

              {/* اليمين: الكمية بداخل مربع محدد بخط رأسي كما بالصورة */}
              <td className="w-[50px] text-center font-black text-3xl border-r border-black bg-gray-50 p-1">
                <Num>{item.quantity}</Num>
              </td>

            </tr>
          ))}
        </tbody>
      </table>

      {/* خط فاصل متصل */}
      <div className="receipt-divider-solid my-1" />

      {/* إجمالي القسم (اختياري/صغير للحفاظ على حجم الورق) */}
      <div className="flex justify-between items-center text-xs px-1 font-bold my-1">
        <span>الإجمالي فرعي:</span>
        <span className="font-black"><Num>{deptTotal.toLocaleString("en-US")} {currency}</Num></span>
      </div>

      {/* ── ملاحظات الطلب ── */}
      {order.note && settings?.showNotes !== false && (
        <div className="dept-slip-notes border border-black p-1 my-1 bg-gray-50 text-center">
          <div className="dept-slip-notes-label text-[9px] font-bold text-gray-500 mb-0.5">ملاحظات الطلب</div>
          <div className="text-xs font-bold text-black">{order.note}</div>
        </div>
      )}
    </div>
  );
}

export function ReceiptPrintArea({
  order,
  settings,
  cashierName,
  masterCopiesCount = 1,
  copyLabels = [],
  deptGroups = [],
}: ReceiptProps & { copyLabels?: string[] }) {
  const isDelivery = order?.orderType === "delivery";
  const effectiveMasterCopiesCount = isDelivery ? 2 : masterCopiesCount;
  const effectiveCopyLabels = isDelivery
    ? ["نسخة الكاشير", "نسخة للموصل"]
    : copyLabels;

  const slips: React.ReactNode[] = [];

  for (let i = 0; i < effectiveMasterCopiesCount; i++) {
    const label = effectiveCopyLabels[i] || (effectiveMasterCopiesCount > 1 ? `نسخة ${i + 1}` : "نسخة العميل");
    slips.push(
      <div key={`master-${i}`} className="print-page" data-slip-type="master">
        <MasterReceiptSlip
          order={order}
          settings={settings}
          cashierName={cashierName}
          copyLabel={label}
        />
      </div>
    );
  }

  for (const { dept, items } of deptGroups) {
    if (!items || items.length === 0) continue;
    const copiesToPrint = Math.max(1, dept.copies || 1);
    for (let c = 0; c < copiesToPrint; c++) {
      slips.push(
        <div key={`dept-${dept.id}-${dept.categoryName}-${c}`} className="print-page" data-slip-type="dept">
          <DeptReceiptSlip
            order={order}
            dept={dept}
            items={items}
            settings={settings}
            cashierName={cashierName}
          />
        </div>
      );
    }
  }

  return (
    <div id="receipt-print-area">
      {slips}
    </div>
  );
}

export function ReceiptPreview({
  order,
  settings,
  cashierName,
  masterCopiesCount = 1,
  copyLabels = [],
  deptGroups = [],
}: ReceiptProps & { copyLabels?: string[] }) {
  const isDelivery = order?.orderType === "delivery";
  const effectiveMasterCopiesCount = isDelivery ? 2 : masterCopiesCount;
  const effectiveCopyLabels = isDelivery
    ? ["نسخة الكاشير", "نسخة للموصل"]
    : copyLabels;

  return (
    <div dir="rtl" className="space-y-6 p-4 bg-slate-100 rounded-xl border border-slate-200">
      <div className="text-xs font-extrabold text-slate-500 tracking-wider mb-2 text-center uppercase">
        👀 معاينة شكل ومحتوى الفواتير قبل الطباعة
      </div>
      
      {/* 1) الفاتورة الرئيسية */}
      {Array.from({ length: effectiveMasterCopiesCount }).map((_, i) => {
        const label = effectiveCopyLabels[i] || `نسخة ${i + 1}`;
        return (
          <div key={`preview-master-${i}`} className="bg-white border border-slate-300 rounded-lg shadow-md max-w-sm mx-auto relative overflow-hidden">
            <div className="bg-amber-500 text-white font-extrabold text-[10px] px-3 py-1 text-center border-b border-amber-600">
              فاتورة العميل المباشرة ({label})
            </div>
            <div className="p-4 bg-white">
              <MasterReceiptSlip
                order={order}
                settings={settings}
                cashierName={cashierName}
                copyLabel={label}
              />
            </div>
          </div>
        );
      })}

      {/* 2) فواتير الأقسام */}
      {deptGroups.map(({ dept, items }) => (
        <div key={`preview-dept-${dept.id}`} className="bg-white border border-slate-300 rounded-lg shadow-md max-w-sm mx-auto relative overflow-hidden">
          <div className="bg-blue-600 text-white font-extrabold text-[10px] px-3 py-1 text-center border-b border-blue-700">
            بون تجهيز لقسم التحضير: {dept.categoryName} ({dept.copies} نسخة)
          </div>
          <div className="p-4 bg-white">
            <DeptReceiptSlip
              order={order}
              dept={dept}
              items={items}
              settings={settings}
              cashierName={cashierName}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

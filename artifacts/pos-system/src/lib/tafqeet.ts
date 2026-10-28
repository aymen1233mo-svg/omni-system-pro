// Comprehensive Arabic Number to Words Converter (Tafqeet) for Accounting & Vouchers
const units = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const teens = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];
const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const hundreds = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

function convertGroup(num: number): string {
  let result = "";
  const h = Math.floor(num / 100);
  const remainder = num % 100;
  const t = Math.floor(remainder / 10);
  const u = remainder % 10;

  if (h > 0) {
    result += hundreds[h];
  }

  if (remainder > 0) {
    if (result !== "") result += " و ";

    if (remainder < 10) {
      result += units[remainder];
    } else if (remainder < 20) {
      result += teens[remainder - 10];
    } else {
      if (u > 0) {
        result += units[u] + " و " + tens[t];
      } else {
        result += tens[t];
      }
    }
  }

  return result;
}

export function tafqeet(amount: number, currency = "YER"): string {
  if (!amount || isNaN(amount) || amount === 0) {
    return "صفر";
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const decimalPart = Math.round((absAmount - integerPart) * 100);

  const currencyMap: Record<string, { main: string; mainPlural: string; sub: string; subPlural: string }> = {
    YER: { main: "ريال يمني", mainPlural: "ريالات يمنية", sub: "فلس", subPlural: "فلوس" },
    SAR: { main: "ريال سعودي", mainPlural: "ريالات سعودية", sub: "هللة", subPlural: "هللات" },
    USD: { main: "دولار أمريكي", mainPlural: "دولارات أمريكية", sub: "سنت", subPlural: "سنتات" },
    EUR: { main: "يورو", mainPlural: "يوروهات", sub: "سنت", subPlural: "سنتات" },
    AED: { main: "درهم إماراتي", mainPlural: "دراهم إماراتية", sub: "فلس", subPlural: "فلوس" },
    OMR: { main: "ريال عماني", mainPlural: "ريالات عمانية", sub: "بيسة", subPlural: "بيسات" },
    QAR: { main: "ريال قطري", mainPlural: "ريالات قطري", sub: "درهم", subPlural: "دراهم" },
    KWD: { main: "دينار كويتي", mainPlural: "دنانير كويتية", sub: "فلس", subPlural: "فلوس" },
    BHD: { main: "دينار بحريني", mainPlural: "دنانير بحرينية", sub: "فلس", subPlural: "فلوس" },
  };

  const curr = currencyMap[currency.toUpperCase()] || {
    main: currency,
    mainPlural: currency,
    sub: "جزء",
    subPlural: "أجزاء",
  };

  if (integerPart === 0 && decimalPart === 0) return "صفر";

  const billions = Math.floor(integerPart / 1_000_000_000);
  const millions = Math.floor((integerPart % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((integerPart % 1_000_000) / 1_000);
  const ones = integerPart % 1000;

  const parts: string[] = [];

  if (billions > 0) {
    if (billions === 1) parts.push("مليار");
    else if (billions === 2) parts.push("ملياران");
    else if (billions >= 3 && billions <= 10) parts.push(convertGroup(billions) + " مليارات");
    else parts.push(convertGroup(billions) + " مليار");
  }

  if (millions > 0) {
    if (millions === 1) parts.push("مليون");
    else if (millions === 2) parts.push("مليونان");
    else if (millions >= 3 && millions <= 10) parts.push(convertGroup(millions) + " ملايين");
    else parts.push(convertGroup(millions) + " مليون");
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) parts.push(convertGroup(thousands) + " آلاف");
    else parts.push(convertGroup(thousands) + " ألف");
  }

  if (ones > 0) {
    parts.push(convertGroup(ones));
  }

  let text = parts.join(" و ");

  // Main currency label
  if (integerPart > 0) {
    if (integerPart >= 3 && integerPart <= 10) {
      text += " " + curr.mainPlural;
    } else {
      text += " " + curr.main;
    }
  }

  // Decimal / Subunits
  if (decimalPart > 0) {
    const subText = convertGroup(decimalPart);
    const subCurrency = (decimalPart >= 3 && decimalPart <= 10) ? curr.subPlural : curr.sub;
    if (text !== "") {
      text += " و " + subText + " " + subCurrency;
    } else {
      text = subText + " " + subCurrency;
    }
  }

  return (isNegative ? "سالب " : "") + text + " فقط لا غير";
}

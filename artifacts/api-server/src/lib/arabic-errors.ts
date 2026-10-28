/**
 * مترجم رسائل الأخطاء التقنية وقاعدة البيانات إلى اللغة العربية
 * يحول رسائل SQLite والأخطاء الداخلية إلى إشعارات مفهومة للمستخدم
 */

export function translateErrorToArabic(err: any): string {
  if (!err) return "حدث خطأ غير متوقع أثناء معالجة الطلب";
  const msg = typeof err === "string" ? err : (err.message || String(err));

  if (msg.includes("has no column named voucher_number")) {
    return "حقل رقم قسيمة الفندق (Voucher Number) غير متوفر في جدول الحجوزات الفندقية، تم تدارك الأمر وتحديث قاعدة البيانات";
  }

  if (msg.includes("has no column named")) {
    const match = msg.match(/has no column named\s+(\w+)/i);
    const col = match ? match[1] : "";
    return `حقل البيانات المطلوبة (${col}) غير متوفر في هيكل الجدول. يرجى إعادة المحاولة`;
  }

  if (msg.includes("no such table")) {
    const match = msg.match(/no such table:\s*(\w+)/i);
    const tbl = match ? match[1] : "";
    return `جدول البيانات (${tbl}) غير متوفر في قاعدة البيانات`;
  }

  if (msg.includes("UNIQUE constraint failed")) {
    const match = msg.match(/UNIQUE constraint failed:\s*([\w\.]+)/i);
    const field = match ? match[1] : "";
    return `هذا السجل مسجل مسبقاً (رقم مكرر: ${field}). يرجى استخدام رقم فريد`;
  }

  if (msg.includes("FOREIGN KEY constraint failed")) {
    return "تعذر إتمام العملية لوجود ارتباطات غير صالحة بسجل عميل أو مورد أو جواز سفر غير موجود";
  }

  if (msg.includes("NOT NULL constraint failed")) {
    const match = msg.match(/NOT NULL constraint failed:\s*([\w\.]+)/i);
    const field = match ? match[1] : "";
    return `يرجى تعبئة كافة الحقول الإلزامية المطلوبة (حقل إلزامي: ${field})`;
  }

  if (msg.includes("database is locked")) {
    return "قاعدة البيانات مشغولة بعملية كتابة أخرى حالياً. يرجى المحاولة بعد ثوانٍ قليلة";
  }

  if (msg.includes("cannot commit transaction") || msg.includes("cannot rollback transaction")) {
    return "تعذر حفظ المعاملة المالية في القيود المحاسبية. يرجى مراجعة الحسابات المرتبطة";
  }

  // Fallback if message is already in Arabic (contains Arabic characters)
  if (/[\u0600-\u06FF]/.test(msg)) {
    return msg;
  }

  return "تعذر حفظ البيانات بسبب خطأ في الخادم أو قاعدة البيانات. يرجى المحاولة مرة أخرى";
}

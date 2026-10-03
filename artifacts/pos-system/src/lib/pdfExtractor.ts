import * as pdfjsLib from "pdfjs-dist";

// Configure pdfjs worker
if (typeof window !== "undefined") {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || "4.10.38"}/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn("Could not set pdf.workerSrc:", e);
  }
}

export interface ExtractedPassenger {
  name_ar: string;
  name_en: string;
  passport_number: string;
  visa_type: string;
  program_duration_days: number;
  travel_date: string;
  expected_exit_date: string;
  remaining_days: number | null;
  nationality: string;
  phone: string;
  travel_status: string;
}

/**
 * Extract plain text from PDF ArrayBuffer
 */
export async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      disableFontFace: false
    });
    const pdfDoc = await loadingTask.promise;
    let fullText = "";

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      let lastY: number | null = null;
      let pageText = "";

      for (const item of textContent.items as any[]) {
        if (!item.str) continue;
        // Group items on roughly the same line or insert newline
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 6) {
          pageText += "\n";
        } else if (pageText.length > 0 && !pageText.endsWith(" ") && !pageText.endsWith("\n")) {
          pageText += " ";
        }
        pageText += item.str;
        lastY = item.transform[5];
      }

      fullText += pageText + "\n--- PAGE BREAK ---\n";
    }

    if (fullText.trim().length > 0) {
      return fullText;
    }
  } catch (err) {
    console.warn("pdfjs-dist extraction failed, falling back to raw stream parsing:", err);
  }

  // Fallback: extract plain ASCII / readable UTF-8 strings from binary buffer
  return extractRawStringsFromPdfBuffer(arrayBuffer);
}

/**
 * Fallback parser for extracting visible text tokens from raw PDF streams
 */
function extractRawStringsFromPdfBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = "";
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const rawText = decoder.decode(bytes);

  // Match text in Tj or TJ operators: (text) Tj or [(t)(e)(x)(t)] TJ
  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let match;
  while ((match = tjRegex.exec(rawText)) !== null) {
    result += match[1] + " ";
  }

  const tjBracketRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((match = tjBracketRegex.exec(rawText)) !== null) {
    const inner = match[1];
    const subMatches = inner.match(/\(([^)]+)\)/g);
    if (subMatches) {
      result += subMatches.map(s => s.slice(1, -1)).join("") + "\n";
    }
  }

  return result;
}

/**
 * Calculate expected exit date based on travel date and duration
 */
function calcExitDate(travelDate: string, days: number): string {
  if (!travelDate) return "";
  try {
    const d = new Date(travelDate);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + (days || 90));
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/**
 * Calculate remaining days until expected exit date
 */
function calcRemainingDays(exitDate: string): number | null {
  if (!exitDate) return null;
  try {
    const exit = new Date(exitDate);
    const now = new Date();
    if (isNaN(exit.getTime())) return null;
    const diffTime = exit.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Clean and standardize date format to YYYY-MM-DD
 */
function normalizeDate(raw: string): string {
  if (!raw) return "";
  const clean = raw.trim().replace(/\//g, "-").replace(/\./g, "-");
  // If YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(clean)) {
    const [y, m, d] = clean.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // If DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return clean;
}

/**
 * Parse lines of extracted PDF text into structured passenger objects
 */
export function parsePassengersFromText(text: string): ExtractedPassenger[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const passengers: ExtractedPassenger[] = [];

  // Regex patterns
  const passportRegex = /\b([A-Z][0-9]{7,9}|[0-9]{8,10}|[A-Z0-9]{6,10})\b/i;
  const dateRegex = /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/;
  const phoneRegex = /\b(05\d{8}|966\d{9}|967\d{8,9}|\+?\d{9,14})\b/;
  const durationRegex = /\b(90|30|14|15|21|60|120|180)\b/;
  const arabicWordRegex = /[\u0600-\u06FF]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip page breaks and headers
    if (line.includes("PAGE BREAK") || line.includes("رقم الجواز") && line.includes("الاسم")) {
      continue;
    }

    // Try splitting by tabs or pipes or multiple spaces
    const parts = line.split(/\t+|\||\s{3,}/).map(p => p.trim()).filter(Boolean);

    let passportNumber = "";
    let nameAr = "";
    let nameEn = "";
    let travelDate = "";
    let duration = 90;
    let phone = "";
    let visaType = "تأشيرة عمره";
    let nationality = "يمني";

    // 1. Find passport number
    const passMatch = line.match(passportRegex);
    if (passMatch) {
      passportNumber = passMatch[1].toUpperCase();
    }

    // 2. Find date
    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      travelDate = normalizeDate(dateMatch[1]);
    }

    // 3. Find phone
    const phoneMatch = line.match(phoneRegex);
    if (phoneMatch) {
      phone = phoneMatch[1];
    }

    // 4. Find duration
    const durMatch = line.match(durationRegex);
    if (durMatch) {
      duration = Number(durMatch[1]);
    }

    // 5. Find visa type
    if (line.includes("سياحة") || line.includes("Tourist")) visaType = "تأشيرة سياحة";
    else if (line.includes("زيارة") || line.includes("Visit")) visaType = "تأشيرة زيارة";
    else if (line.includes("عمل") || line.includes("Work")) visaType = "تأشيرة عمل";
    else if (line.includes("عمرة") || line.includes("Umrah")) visaType = "تأشيرة عمره";

    // 6. Find nationality
    if (line.includes("سعودي") || line.includes("Saudi")) nationality = "سعودي";
    else if (line.includes("مصري") || line.includes("Egyptian")) nationality = "مصري";
    else if (line.includes("أردني") || line.includes("Jordanian")) nationality = "أردني";
    else if (line.includes("سوداني") || line.includes("Sudanese")) nationality = "سوداني";
    else if (line.includes("يمني") || line.includes("Yemeni")) nationality = "يمني";

    // 7. Extract Arabic name (words containing Arabic letters)
    const arabicWords = line
      .split(/\s+/)
      .filter(w => arabicWordRegex.test(w) && !w.includes("تأشيرة") && !w.includes("عمرة") && !w.includes("سياحة") && !w.includes("يوم") && !w.includes("مكة"));
    
    if (arabicWords.length >= 2) {
      nameAr = arabicWords.join(" ");
    }

    // 8. Extract English name if available
    const englishWords = line
      .split(/\s+/)
      .filter(w => /^[A-Za-z]+$/.test(w) && w.length > 1 && !["PASSPORT", "VISA", "UMRAH", "TOURIST", "DAYS", "YEMEN"].includes(w.toUpperCase()));
    
    if (englishWords.length >= 2) {
      nameEn = englishWords.join(" ");
    }

    // If we have either a passport number or an Arabic name
    if (passportNumber || nameAr) {
      // Default dates if missing
      if (!travelDate) {
        travelDate = new Date().toISOString().slice(0, 10);
      }
      const exitDate = calcExitDate(travelDate, duration);
      const remaining = calcRemainingDays(exitDate);

      passengers.push({
        name_ar: nameAr || nameEn || `مسافر جواز ${passportNumber}`,
        name_en: nameEn || nameAr || "",
        passport_number: passportNumber || "---",
        visa_type: visaType,
        program_duration_days: duration,
        travel_date: travelDate,
        expected_exit_date: exitDate,
        remaining_days: remaining,
        nationality: nationality,
        phone: phone,
        travel_status: "داخل مكة"
      });
    }
  }

  return passengers;
}

/**
 * Generate a printable/downloadable Blank Passenger Manifest PDF / HTML template
 */
export function generateSamplePassengerPdfHtml(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>نموذج بيان ركاب وجوازات سفر فارغ</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 20px; direction: rtl; color: #1e293b; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 22px; color: #0f172a; }
    .header p { margin: 5px 0 0; font-size: 13px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 12px; }
    th { background: #f1f5f9; font-weight: bold; color: #334155; text-align: center; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #475569; }
    .sig-box { width: 180px; text-align: center; border-top: 1px dashed #94a3b8; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>نموذج كشف وبيان ركاب وجوازات السفر المعتمد</h1>
    <p>للاستخدام في استيراد وتسجيل المعتمرين والمسافرين - تاريخ الإصدار: ${today}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th>اسم المعتمر / المسافر (بالعربي)</th>
        <th>الاسم بالإنجليزي (حسب الجواز)</th>
        <th>رقم الجواز</th>
        <th>نوع التأشيرة</th>
        <th>المدة (أيام)</th>
        <th>تاريخ السفر</th>
        <th>رقم الجوال</th>
        <th>الجنسية</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from({ length: 10 }).map((_, i) => `
      <tr>
        <td style="text-align: center; color: #94a3b8;">${i + 1}</td>
        <td></td>
        <td></td>
        <td></td>
        <td style="text-align: center;">تأشيرة عمره</td>
        <td style="text-align: center;">90</td>
        <td style="text-align: center;"></td>
        <td></td>
        <td style="text-align: center;">يمني</td>
      </tr>`).join("")}
    </tbody>
  </table>
  <div class="footer" style="margin-top: 50px;">
    <div class="sig-box">توقيع مسؤول الجوازات</div>
    <div class="sig-box">توقيع المشرف الميداني</div>
    <div class="sig-box">ختم واعتماد الوكالة</div>
  </div>
</body>
</html>`;
}

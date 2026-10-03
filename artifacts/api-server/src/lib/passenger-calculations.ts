/**
 * Centralized, High-Precision Passenger & Passport Date Calculations
 * Prevents timezone discrepancies, off-by-one errors, and stale database values.
 */

export function parseDateParts(dateStr: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const clean = String(dateStr).trim().split("T")[0].replace(/\//g, "-");
  const parts = clean.split("-");
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

export function dateToUtcEpoch(dateStr: string | null | undefined): number | null {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

export function calcDaysBetween(fromDateStr: string, toDateStr: string): number | null {
  const fromEpoch = dateToUtcEpoch(fromDateStr);
  const toEpoch = dateToUtcEpoch(toDateStr);
  if (fromEpoch === null || toEpoch === null) return null;
  return Math.round((toEpoch - fromEpoch) / (1000 * 60 * 60 * 24));
}

export function calcExitDate(entryDateStr: string, durationDays: number | string): string {
  const parts = parseDateParts(entryDateStr);
  if (!parts) return "";
  const numDays = Number(durationDays) || 0;
  if (numDays <= 0) return "";
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + numDays));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function calcRemainingDays(exitDateStr: string | null | undefined, refDateStr?: string | null): number | null {
  if (!exitDateStr) return null;
  const todayRef = refDateStr ? refDateStr.trim().split("T")[0].replace(/\//g, "-") : new Date().toISOString().slice(0, 10);
  return calcDaysBetween(todayRef, exitDateStr);
}

export function calcDaysSpent(entryDateStr: string | null | undefined, refDateStr?: string | null): number {
  if (!entryDateStr) return 0;
  const todayRef = refDateStr ? refDateStr.trim().split("T")[0].replace(/\//g, "-") : new Date().toISOString().slice(0, 10);
  const diff = calcDaysBetween(entryDateStr, todayRef);
  return diff !== null && diff > 0 ? diff : 0;
}

export function formatRemainingDaysArabic(remainingDays: number | null | undefined): string {
  if (remainingDays === null || remainingDays === undefined) {
    return "غير محدد";
  }
  if (remainingDays < 0) {
    return `متجاوز (${Math.abs(remainingDays)} يوم)`;
  }
  if (remainingDays === 0) {
    return "اليوم هو موعد المغادرة";
  }
  if (remainingDays === 1) {
    return "يوم واحد متبقي";
  }
  if (remainingDays === 2) {
    return "يومان متبقيان";
  }
  if (remainingDays >= 3 && remainingDays <= 10) {
    return `${remainingDays} أيام متبقية`;
  }
  return `${remainingDays} يوم متبقي`;
}

/**
 * Enriches a passenger record with live, precise date calculations.
 */
export function enrichPassengerWithLiveDates(pax: any, refDateStr?: string | null): any {
  if (!pax) return pax;

  let expectedExit = pax.expected_exit_date || "";
  let duration = pax.program_duration_days ? Number(pax.program_duration_days) : 90;

  if (pax.travel_date && (!expectedExit || duration > 0)) {
    const calculatedExit = calcExitDate(pax.travel_date, duration);
    if (calculatedExit) {
      expectedExit = calculatedExit;
    }
  }

  const remainingDays = calcRemainingDays(expectedExit, refDateStr);
  const daysSpent = calcDaysSpent(pax.travel_date, refDateStr);
  const passportRemaining = pax.passport_expiry_date ? calcRemainingDays(pax.passport_expiry_date, refDateStr) : null;

  return {
    ...pax,
    program_duration_days: duration,
    expected_exit_date: expectedExit || pax.expected_exit_date || "",
    remaining_days: remainingDays,
    days_spent: daysSpent,
    passport_remaining_days: passportRemaining,
    remaining_days_text: formatRemainingDaysArabic(remainingDays),
  };
}

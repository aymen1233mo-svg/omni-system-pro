import { db } from "./sqlite";

export type SystemModule = "accounting" | "travel" | "travel-services" | "sales" | "purchases" | "hr";

export interface BusinessDayConfig {
  enabled: boolean;
  cutoffTime: string; // "HH:mm" e.g. "03:00"
  rolloverHour: number; // e.g. 3
  rolloverMinute: number; // e.g. 0
  offsetMinutes: number; // total minutes from midnight e.g. 180
  applyCutoffToAccounting: boolean;
  applyCutoffToTravel: boolean;
  applyCutoffToTravelServices: boolean;
  applyCutoffToSales: boolean;
  applyCutoffToPurchases: boolean;
  applyCutoffToHR: boolean;
}

let cachedConfig: BusinessDayConfig | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds cache to avoid heavy DB hits on every transaction

export function invalidateBusinessDayConfigCache(): void {
  cachedConfig = null;
  lastCacheTime = 0;
}

export function getBusinessDayConfig(): BusinessDayConfig {
  const now = Date.now();
  if (cachedConfig && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  let rows: { key: string; value: string }[] = [];
  try {
    rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'businessDay%' OR key LIKE 'applyCutoff%'").all() as any[];
  } catch (err) {
    console.error("Error fetching business day settings:", err);
  }

  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  const enabled = map["businessDayCutoffEnabled"] !== "false";
  const cutoffTime = map["businessDayCutoffTime"] || "03:00";
  const [hStr, mStr] = cutoffTime.split(":");
  const rolloverHour = parseInt(hStr || "3", 10) || 0;
  const rolloverMinute = parseInt(mStr || "0", 10) || 0;
  const offsetMinutes = rolloverHour * 60 + rolloverMinute;

  const config: BusinessDayConfig = {
    enabled,
    cutoffTime,
    rolloverHour,
    rolloverMinute,
    offsetMinutes,
    applyCutoffToAccounting: map["applyCutoffToAccounting"] !== "false",
    applyCutoffToTravel: map["applyCutoffToTravel"] !== "false",
    applyCutoffToTravelServices: map["applyCutoffToTravelServices"] !== "false",
    applyCutoffToSales: map["applyCutoffToSales"] !== "false",
    applyCutoffToPurchases: map["applyCutoffToPurchases"] !== "false",
    applyCutoffToHR: map["applyCutoffToHR"] !== "false",
  };

  cachedConfig = config;
  lastCacheTime = now;
  return config;
}

function isModuleEnabled(config: BusinessDayConfig, moduleName?: SystemModule): boolean {
  if (!config.enabled) return false;
  if (!moduleName) return true;

  switch (moduleName) {
    case "accounting":
      return config.applyCutoffToAccounting;
    case "travel":
      return config.applyCutoffToTravel;
    case "travel-services":
      return config.applyCutoffToTravelServices;
    case "sales":
      return config.applyCutoffToSales;
    case "purchases":
      return config.applyCutoffToPurchases;
    case "hr":
      return config.applyCutoffToHR;
    default:
      return true;
  }
}

/**
 * Pure function to calculate the business date given an optional date, cutoff time ("HH:mm"), and enabled flag.
 */
export function calculateBusinessDate(
  dateInput?: Date | string | number | null,
  cutoffTime: string = "03:00",
  enabled: boolean = true
): { businessDate: string; isPastMidnight: boolean; cutoffTime: string } {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  if (!enabled || !cutoffTime || cutoffTime === "00:00") {
    const y = validDate.getFullYear();
    const m = String(validDate.getMonth() + 1).padStart(2, "0");
    const day = String(validDate.getDate()).padStart(2, "0");
    return {
      businessDate: `${y}-${m}-${day}`,
      isPastMidnight: false,
      cutoffTime: "00:00",
    };
  }

  const [hStr, mStr] = cutoffTime.split(":");
  const cutoffMinutes = (parseInt(hStr || "3", 10) || 0) * 60 + (parseInt(mStr || "0", 10) || 0);
  const curMinutes = validDate.getHours() * 60 + validDate.getMinutes();

  const isPastMidnight = curMinutes < cutoffMinutes;
  const targetDate = new Date(validDate.getTime());

  if (isPastMidnight) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, "0");
  const day = String(targetDate.getDate()).padStart(2, "0");

  return {
    businessDate: `${y}-${m}-${day}`,
    isPastMidnight,
    cutoffTime,
  };
}

/**
 * Calculates the active business date (YYYY-MM-DD) for a given date/time and module.
 * If time is after midnight (00:00) but before cutoff time (e.g. 03:00),
 * it returns yesterday's calendar date as the active business date!
 */
export function getBusinessDate(
  moduleName?: SystemModule,
  dateInput?: Date | string | number | null
): string {
  const config = getBusinessDayConfig();
  const d = dateInput ? new Date(dateInput) : new Date();

  // If invalid date, fallback to now
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  if (!isModuleEnabled(config, moduleName) || config.offsetMinutes <= 0) {
    const y = validDate.getFullYear();
    const m = String(validDate.getMonth() + 1).padStart(2, "0");
    const day = String(validDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const curMinutes = validDate.getHours() * 60 + validDate.getMinutes();
  const targetDate = new Date(validDate.getTime());

  if (curMinutes < config.offsetMinutes) {
    // Current time is past midnight (00:00) but before cutoff time (e.g. 03:00)
    // Rollover has not occurred yet -> still counts as previous business day
    targetDate.setDate(targetDate.getDate() - 1);
  }

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, "0");
  const day = String(targetDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normalizes any SQLite or ISO timestamp string and calculates its active business date (YYYY-MM-DD)
 * for the given module according to current business day rollover settings.
 */
export function getOrderBusinessDate(
  createdAtInput?: Date | string | number | null,
  moduleName: SystemModule = "sales"
): string {
  if (!createdAtInput) {
    return getBusinessDate(moduleName);
  }
  if (typeof createdAtInput === "string") {
    let s = createdAtInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return s;
    }
    if (s.includes(" ") && !s.includes("T")) {
      s = s.replace(" ", "T");
    }
    return getBusinessDate(moduleName, s);
  }
  return getBusinessDate(moduleName, createdAtInput);
}

/**
 * Returns the SQLite datetime modifier for querying/grouping by business day.
 * Example: if cutoff is 03:00 (180 minutes), returns "localtime', '-180 minutes".
 * In SQLite: date(datetime(created_at, 'localtime', '-180 minutes')) converts UTC timestamps
 * to local time and groups transactions made between 00:00 and 03:00 AM into the previous day!
 */
export function getSqlBusinessDateModifier(moduleName?: SystemModule): string {
  const config = getBusinessDayConfig();
  if (!isModuleEnabled(config, moduleName) || config.offsetMinutes <= 0) {
    return "localtime', '-0 minutes";
  }
  return `localtime', '-${config.offsetMinutes} minutes`;
}

/**
 * Returns comprehensive status of the business day for UI and API diagnostics.
 */
export function getBusinessDayStatus() {
  const config = getBusinessDayConfig();
  const now = new Date();

  const curMinutes = now.getHours() * 60 + now.getMinutes();
  const isPastMidnight = config.enabled && config.offsetMinutes > 0 && curMinutes < config.offsetMinutes;

  const calY = now.getFullYear();
  const calM = String(now.getMonth() + 1).padStart(2, "0");
  const calD = String(now.getDate()).padStart(2, "0");
  const calendarDate = `${calY}-${calM}-${calD}`;

  const calH = String(now.getHours()).padStart(2, "0");
  const calMin = String(now.getMinutes()).padStart(2, "0");
  const calSec = String(now.getSeconds()).padStart(2, "0");
  const calendarTime = `${calH}:${calMin}:${calSec}`;

  const activeBusinessDate = getBusinessDate();
  const salesBusinessDate = getBusinessDate("sales");

  // Next rollover time
  const rolloverToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), config.rolloverHour, config.rolloverMinute, 0);
  let nextRollover: Date;
  if (now.getTime() < rolloverToday.getTime()) {
    nextRollover = rolloverToday;
  } else {
    // Tomorrow at cutoff
    nextRollover = new Date(rolloverToday.getTime() + 24 * 60 * 60 * 1000);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const nextRolloverStr = `${nextRollover.getFullYear()}-${pad(nextRollover.getMonth() + 1)}-${pad(nextRollover.getDate())} ${pad(nextRollover.getHours())}:${pad(nextRollover.getMinutes())}:00`;

  return {
    businessDate: activeBusinessDate,
    salesBusinessDate,
    cutoffTime: config.cutoffTime,
    enabled: config.enabled,
    calendarDate,
    calendarTime,
    activeBusinessDate,
    isPastMidnightExtension: isPastMidnight,
    config,
    nextRollover: nextRolloverStr,
    modules: {
      accounting: {
        enabled: isModuleEnabled(config, "accounting"),
        activeDate: getBusinessDate("accounting"),
      },
      travel: {
        enabled: isModuleEnabled(config, "travel"),
        activeDate: getBusinessDate("travel"),
      },
      travelServices: {
        enabled: isModuleEnabled(config, "travel-services"),
        activeDate: getBusinessDate("travel-services"),
      },
      sales: {
        enabled: isModuleEnabled(config, "sales"),
        activeDate: salesBusinessDate,
      },
      purchases: {
        enabled: isModuleEnabled(config, "purchases"),
        activeDate: getBusinessDate("purchases"),
      },
      hr: {
        enabled: isModuleEnabled(config, "hr"),
        activeDate: getBusinessDate("hr"),
      },
    },
  };
}

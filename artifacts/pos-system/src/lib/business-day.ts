import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@workspace/api-client-react";
import { useState, useEffect } from "react";

export type SystemModule = "accounting" | "travel" | "travel-services" | "sales" | "purchases" | "hr";

export interface BusinessDaySettings {
  businessDayCutoffEnabled?: boolean;
  businessDayCutoffTime?: string;
  businessDayRolloverHour?: number;
  applyCutoffToAccounting?: boolean;
  applyCutoffToTravel?: boolean;
  applyCutoffToTravelServices?: boolean;
  applyCutoffToSales?: boolean;
  applyCutoffToPurchases?: boolean;
  applyCutoffToHR?: boolean;
}

/**
 * Pure function to calculate the business date given an optional date, cutoff time ("HH:mm"), and enabled flag.
 * If time is past midnight (00:00) but before cutoffTime (e.g. 03:00), it returns the previous calendar day.
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
 * Synchronously determines the business date using cached or default settings.
 */
export function getClientBusinessDate(
  moduleName?: SystemModule,
  dateInput?: Date | string | null
): string {
  // Read local settings if stored or fallback to defaults
  let cutoffTime = "03:00";
  let enabled = true;

  try {
    const raw = localStorage.getItem("system_business_day_config");
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.cutoffTime) cutoffTime = cfg.cutoffTime;
      if (cfg.enabled !== undefined) enabled = cfg.enabled;
      if (moduleName) {
        const modKey = `applyCutoffTo${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`;
        if (cfg[modKey] === false) enabled = false;
      }
    }
  } catch {}

  return calculateBusinessDate(dateInput, cutoffTime, enabled).businessDate;
}

/**
 * React hook to access real-time business day info, live clock, and module specific dates.
 */
export function useBusinessDay() {
  const { data: settings } = useQuery<any>({
    queryKey: ["settings"],
    queryFn: () => fetchWithAuth("/api/settings"),
    staleTime: 60000,
  });

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Tick every minute to stay up to date
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const enabled = settings?.businessDayCutoffEnabled !== false;
  const cutoffTime = settings?.businessDayCutoffTime || "03:00";

  // Sync to localStorage for fast synchronous fallbacks
  useEffect(() => {
    if (settings) {
      try {
        localStorage.setItem(
          "system_business_day_config",
          JSON.stringify({
            enabled,
            cutoffTime,
            applyCutoffToAccounting: settings.applyCutoffToAccounting !== false,
            applyCutoffToTravel: settings.applyCutoffToTravel !== false,
            applyCutoffToTravelServices: settings.applyCutoffToTravelServices !== false,
            applyCutoffToSales: settings.applyCutoffToSales !== false,
            applyCutoffToPurchases: settings.applyCutoffToPurchases !== false,
            applyCutoffToHR: settings.applyCutoffToHR !== false,
          })
        );
      } catch {}
    }
  }, [settings, enabled, cutoffTime]);

  const { businessDate, isPastMidnight } = calculateBusinessDate(now, cutoffTime, enabled);

  const calY = now.getFullYear();
  const calM = String(now.getMonth() + 1).padStart(2, "0");
  const calD = String(now.getDate()).padStart(2, "0");
  const calendarDate = `${calY}-${calM}-${calD}`;

  const calH = String(now.getHours()).padStart(2, "0");
  const calMin = String(now.getMinutes()).padStart(2, "0");
  const calendarTime = `${calH}:${calMin}`;

  const getModuleDate = (mod: SystemModule, inputDate?: Date | string | null) => {
    let modEnabled = enabled;
    if (settings) {
      if (mod === "accounting" && settings.applyCutoffToAccounting === false) modEnabled = false;
      if (mod === "travel" && settings.applyCutoffToTravel === false) modEnabled = false;
      if (mod === "travel-services" && settings.applyCutoffToTravelServices === false) modEnabled = false;
      if (mod === "sales" && settings.applyCutoffToSales === false) modEnabled = false;
      if (mod === "purchases" && settings.applyCutoffToPurchases === false) modEnabled = false;
      if (mod === "hr" && settings.applyCutoffToHR === false) modEnabled = false;
    }
    return calculateBusinessDate(inputDate || now, cutoffTime, modEnabled).businessDate;
  };

  return {
    businessDate,
    calendarDate,
    calendarTime,
    isPastMidnight,
    cutoffTime,
    enabled,
    settings,
    getModuleDate,
  };
}

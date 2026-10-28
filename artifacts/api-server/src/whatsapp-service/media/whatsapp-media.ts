import fs from "node:fs";
import path from "node:path";
import { logger } from "../../lib/logger";

const UPLOADS_DIR = path.resolve(process.cwd(), "public/uploads/passengers_pdfs");

export function getPassengerPdfPath(travelerId: number, bookingNumber: string): string {
  const filename = `passenger_${travelerId}_${bookingNumber.replace(/[\s\/]/g, "_")}.pdf`;
  return path.join(UPLOADS_DIR, filename);
}

export function checkPassengerPdfExists(travelerId: number, bookingNumber: string): boolean {
  try {
    const filePath = getPassengerPdfPath(travelerId, bookingNumber);
    return fs.existsSync(filePath);
  } catch (e) {
    return false;
  }
}

export interface OfflinePrintJob {
  id: string;
  printerName: string;
  content: string;
  orderId: number;
  invoiceNumber: string;
  receiptType: string;
  departmentName: string;
  copies: number;
  createdAt: string;
  attempts: number;
  error?: string | null;
}

const STORAGE_KEY = "pos_offline_print_queue";

export function getOfflinePrintQueue(): OfflinePrintJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to read offline print queue:", e);
    return [];
  }
}

export function saveOfflinePrintQueue(queue: OfflinePrintJob[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("print-queue-updated", { detail: { count: queue.length } }));
  } catch (e) {
    console.error("Failed to save offline print queue:", e);
  }
}

export function addOfflinePrintJob(jobData: Omit<OfflinePrintJob, "id" | "createdAt" | "attempts" | "error">): OfflinePrintJob {
  const queue = getOfflinePrintQueue();
  // Prevent duplicate jobs for same order & department/receiptType
  const existingIndex = queue.findIndex(j => j.orderId === jobData.orderId && j.receiptType === jobData.receiptType && j.departmentName === jobData.departmentName);
  if (existingIndex !== -1) {
    // update existing or keep
    return queue[existingIndex];
  }

  const newJob: OfflinePrintJob = {
    ...jobData,
    id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
    error: null,
  };
  queue.push(newJob);
  saveOfflinePrintQueue(queue);
  return newJob;
}

export function removeOfflinePrintJob(id: string): void {
  const queue = getOfflinePrintQueue();
  const filtered = queue.filter(j => j.id !== id);
  saveOfflinePrintQueue(filtered);
}

export function clearOfflinePrintQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("print-queue-updated", { detail: { count: 0 } }));
}

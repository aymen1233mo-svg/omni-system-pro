import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let baseUrl = "";
let tokenGetter: () => string | null = () => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token");
};

export function setBaseUrl(url: string) {
  baseUrl = url;
}

export function setAuthTokenGetter(getter: () => string | null) {
  tokenGetter = getter;
}

// Helper function for API requests
export async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenGetter();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    let errMsg = "Request failed";
    try {
      const errJson = await res.json();
      errMsg = errJson.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

export const fetchWithAuth = apiRequest;

// Shared Interfaces/Types
export interface User {
  id: number;
  username: string;
  name: string;
  role: "admin" | "cashier";
  active: boolean;
}

export interface UserInput {
  username: string;
  password?: string;
  name: string;
  role: string;
  active: boolean;
}

export interface UserUpdate {
  username?: string;
  password?: string;
  name?: string;
  role?: string;
  active?: boolean;
}

export interface Category {
  id: number;
  name: string;
  color?: string | null;
}

export interface CategoryInput {
  name: string;
  color?: string | null;
}

export interface Product {
  id: number;
  number: number;
  name: string;
  price: number;
  cost?: number | null;
  barcode?: string | null;
  categoryId?: number | null;
  active: boolean;
  stock?: number | null;
  categoryName?: string | null;
  is_sellable?: boolean;
  show_in_pos?: boolean;
  item_type?: string;
  // Extra fields that may be present
  min_stock?: number;
  max_stock?: number;
  unit?: string;
  multi_units?: string | null;
  supplier_id?: number;
  supplier_name?: string | null;
  warehouse_id?: number;
  warehouse_name?: string | null;
}

export interface ProductInput {
  number: number;
  name: string;
  price: number;
  cost?: number | null;
  barcode?: string | null;
  categoryId?: number | null;
  active: boolean;
  stock?: number | null;
  is_sellable?: boolean;
  show_in_pos?: boolean;
  item_type?: string;
  min_stock?: number;
  max_stock?: number;
  unit?: string;
  multi_units?: string | null;
  supplier_id?: number;
  supplier_name?: string | null;
  warehouse_id?: number;
  warehouse_name?: string | null;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  createdAt: string;
  totalPurchases?: number;
}

export interface CustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  categoryId?: number | null;
  categoryName?: string | null;
}

export interface OrderItemInput {
  productId: number;
  productName?: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  categoryId?: number | null;
  categoryName?: string | null;
}

export interface Order {
  id: number;
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  cashAmount?: number | null;
  cardAmount?: number | null;
  customerId?: number | null;
  userId: number;
  note?: string | null;
  orderType: string;
  tableNumber?: string | null;
  createdAt: string;
  items?: OrderItem[];
  userName?: string;
  customerName?: string | null;
}

export interface SettingsInput {
  businessName: string;
  address: string | null;
  phone: string | null;
  taxNumber: string | null;
  taxRate: number;
  currency: string;
  receiptMessage: string | null;
  printLogo: boolean;
  printQr: boolean;
  showCashier: boolean;
  showCustomer: boolean;
  receiptPaperSize: string;
  showOrderNumber: boolean;
  showTableNumber: boolean;
  showDateTime: boolean;
  showBarcode: boolean;
  showOrderType: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showNotes: boolean;
  autoPrintTrigger: string;
  maxReprintCount: number;
  masterCopiesCount: number;
  logoUrl: string | null;
}

export interface ReceiptCopyConfig {
  id: number;
  copyNumber: number;
  label: string;
  enabled: boolean;
}

export interface DepartmentPrintConfig {
  id: number;
  categoryId: number;
  categoryName?: string;
  printerName?: string | null;
  copies: number;
  enabled: boolean;
  printOrder: number;
}

export interface PrinterSettingsInput {
  paperWidth: number;
  leftMargin: number;
  rightMargin: number;
  topMargin: number;
  bottomMargin: number;
  fontSize: number;
  lineSpacing: number;
  charactersPerLine: number;
  mainPrinterName?: string | null;
}

// Authentication Hooks
export function getGetMeQueryKey() { return ["auth", "me"]; }
export function useGetMe(options: { query?: any } = {}) {
  return useQuery<User>({
    queryKey: getGetMeQueryKey(),
    queryFn: () => apiRequest<User>("/api/auth/me"),
    ...options.query,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation<{ token: string; user: User }, Error, { data: any }>({
    mutationFn: (variables) => apiRequest<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    onSuccess: (data) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pos_token", data.token);
        localStorage.setItem("pos_token", data.token);
      }
      qc.setQueryData(getGetMeQueryKey(), data.user);
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation<any, Error, void>({
    mutationFn: () => apiRequest("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pos_token");
        localStorage.removeItem("pos_token");
      }
      qc.setQueryData(getGetMeQueryKey(), null);
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
  });
}

// Customers Hooks
export function getGetCustomersQueryKey(search?: string) { return ["customers", search]; }
export function useGetCustomers(params: { search?: string } = {}) {
  return useQuery<Customer[]>({
    queryKey: getGetCustomersQueryKey(params.search),
    queryFn: () => {
      const q = params.search ? `?q=${encodeURIComponent(params.search)}` : "";
      return apiRequest<Customer[]>(`/api/customers${q}`);
    },
  });
}

export function useCreateCustomer() {
  return useMutation<Customer, Error, { data: CustomerInput }>({
    mutationFn: (variables) => apiRequest<Customer>("/api/customers", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useUpdateCustomer() {
  return useMutation<Customer, Error, { id: number; data: CustomerInput }>({
    mutationFn: (variables) => apiRequest<Customer>(`/api/customers/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useDeleteCustomer() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: (variables) => apiRequest<void>(`/api/customers/${variables.id}`, {
      method: "DELETE",
    }),
  });
}

// Categories Hooks
export function getGetCategoriesQueryKey() { return ["categories"]; }
export function useGetCategories() {
  return useQuery<Category[]>({
    queryKey: getGetCategoriesQueryKey(),
    queryFn: () => apiRequest<Category[]>("/api/categories"),
  });
}

export function useCreateCategory() {
  return useMutation<Category, Error, { data: CategoryInput }>({
    mutationFn: (variables) => apiRequest<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useUpdateCategory() {
  return useMutation<Category, Error, { id: number; data: CategoryInput }>({
    mutationFn: (variables) => apiRequest<Category>(`/api/categories/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useDeleteCategory() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: (variables) => apiRequest<void>(`/api/categories/${variables.id}`, {
      method: "DELETE",
    }),
  });
}

// Products Hooks
export function getGetProductsQueryKey(params?: { search?: string; show_in_pos?: boolean | string; is_sellable?: boolean | string; item_type?: string }) { 
  return ["products", params]; 
}
export function useGetProducts(params: { search?: string; show_in_pos?: boolean | string; is_sellable?: boolean | string; item_type?: string } = {}) {
  return useQuery<Product[]>({
    queryKey: getGetProductsQueryKey(params),
    queryFn: () => {
      const parts: string[] = [];
      if (params.search) parts.push(`q=${encodeURIComponent(params.search)}`);
      if (params.show_in_pos !== undefined) parts.push(`show_in_pos=${params.show_in_pos}`);
      if (params.is_sellable !== undefined) parts.push(`is_sellable=${params.is_sellable}`);
      if (params.item_type) parts.push(`item_type=${encodeURIComponent(params.item_type)}`);
      const q = parts.length > 0 ? `?${parts.join("&")}` : "";
      return apiRequest<Product[]>(`/api/products${q}`);
    },
  });
}

export function useCreateProduct() {
  return useMutation<Product, Error, { data: ProductInput }>({
    mutationFn: (variables) => apiRequest<Product>("/api/products", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useUpdateProduct() {
  return useMutation<Product, Error, { id: number; data: ProductInput }>({
    mutationFn: (variables) => apiRequest<Product>(`/api/products/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useDeleteProduct() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: (variables) => apiRequest<void>(`/api/products/${variables.id}`, {
      method: "DELETE",
    }),
  });
}

// Orders Hooks
export function getGetOrdersQueryKey() { return ["orders"]; }
export function useGetOrders(params: { startDate?: string; endDate?: string; limit?: number; offset?: number } = {}) {
  return useQuery<Order[]>({
    queryKey: [getGetOrdersQueryKey(), params.startDate, params.endDate],
    queryFn: () => {
      const urlParams = new URLSearchParams();
      if (params.startDate) urlParams.append("startDate", params.startDate);
      if (params.endDate) urlParams.append("endDate", params.endDate);
      if (params.limit) urlParams.append("limit", String(params.limit));
      if (params.offset) urlParams.append("offset", String(params.offset));
      const q = urlParams.toString();
      return apiRequest<Order[]>(`/api/orders${q ? `?${q}` : ""}`);
    },
  });
}

export function useCreateOrder() {
  return useMutation<Order, Error, { data: any }>({
    mutationFn: (variables) => apiRequest<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useDeleteOrder() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: (variables) => apiRequest<void>(`/api/orders/${variables.id}`, {
      method: "DELETE",
    }),
  });
}

// Users Hooks
export function getGetUsersQueryKey() { return ["users"]; }
export function useGetUsers() {
  return useQuery<User[]>({
    queryKey: getGetUsersQueryKey(),
    queryFn: () => apiRequest<User[]>("/api/users"),
  });
}

export function useCreateUser() {
  return useMutation<User, Error, { data: UserInput }>({
    mutationFn: (variables) => apiRequest<User>("/api/users", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useUpdateUser() {
  return useMutation<User, Error, { id: number; data: UserUpdate }>({
    mutationFn: (variables) => apiRequest<User>(`/api/users/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useDeleteUser() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: (variables) => apiRequest<void>(`/api/users/${variables.id}`, {
      method: "DELETE",
    }),
  });
}

// Settings Hooks
export function getGetSettingsQueryKey() { return ["settings"]; }
export function useGetSettings() {
  return useQuery<SettingsInput>({
    queryKey: getGetSettingsQueryKey(),
    queryFn: () => apiRequest<SettingsInput>("/api/settings"),
  });
}

export function useUpdateSettings() {
  return useMutation<SettingsInput, Error, { data: SettingsInput }>({
    mutationFn: (variables) => apiRequest<SettingsInput>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
  });
}

// Receipt Copy Configs Hooks
export function getGetReceiptCopyConfigsQueryKey() { return ["receipt-copy-configs"]; }
export function useGetReceiptCopyConfigs() {
  return useQuery<ReceiptCopyConfig[]>({
    queryKey: getGetReceiptCopyConfigsQueryKey(),
    queryFn: () => apiRequest<ReceiptCopyConfig[]>("/api/print-config/receipt-copies"),
  });
}

export function useCreateReceiptCopyConfig() {
  return useMutation<ReceiptCopyConfig, Error, { data: any }>({
    mutationFn: (variables) => apiRequest<ReceiptCopyConfig>("/api/print-config/receipt-copies", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useUpdateReceiptCopyConfig() {
  return useMutation<ReceiptCopyConfig, Error, { id: number; data: any }>({
    mutationFn: (variables) => apiRequest<ReceiptCopyConfig>(`/api/print-config/receipt-copies/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useDeleteReceiptCopyConfig() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: (variables) => apiRequest<void>(`/api/print-config/receipt-copies/${variables.id}`, {
      method: "DELETE",
    }),
  });
}

// Department Print Configs Hooks
export function getGetDepartmentPrintConfigsQueryKey() { return ["department-print-configs"]; }
export function useGetDepartmentPrintConfigs() {
  return useQuery<DepartmentPrintConfig[]>({
    queryKey: getGetDepartmentPrintConfigsQueryKey(),
    queryFn: () => apiRequest<DepartmentPrintConfig[]>("/api/print-config/departments"),
  });
}

export function useCreateDepartmentPrintConfig() {
  return useMutation<DepartmentPrintConfig, Error, { data: any }>({
    mutationFn: (variables) => apiRequest<DepartmentPrintConfig>("/api/print-config/departments", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useUpdateDepartmentPrintConfig() {
  return useMutation<DepartmentPrintConfig, Error, { id: number; data: any }>({
    mutationFn: (variables) => apiRequest<DepartmentPrintConfig>(`/api/print-config/departments/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function useDeleteDepartmentPrintConfig() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: (variables) => apiRequest<void>(`/api/print-config/departments/${variables.id}`, {
      method: "DELETE",
    }),
  });
}

// Printer Settings Hooks
export function getGetPrinterSettingsQueryKey() { return ["printer-settings"]; }
export function useGetPrinterSettings() {
  return useQuery<PrinterSettingsInput>({
    queryKey: getGetPrinterSettingsQueryKey(),
    queryFn: () => apiRequest<PrinterSettingsInput>("/api/printer-settings"),
  });
}

export function useUpdatePrinterSettings() {
  return useMutation<PrinterSettingsInput, Error, { data: PrinterSettingsInput }>({
    mutationFn: (variables) => apiRequest<PrinterSettingsInput>("/api/printer-settings", {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
  });
}

// Printers List Hooks
export function useGetPrintersList() {
  return useQuery<string[]>({
    queryKey: ["printers-list"],
    queryFn: () => apiRequest<string[]>("/api/printers/list"),
  });
}

// Print Log Hooks
export function useGetPrintLogs(params: { orderId?: number; startDate?: string; endDate?: string } = {}) {
  return useQuery<any[]>({
    queryKey: ["print-logs", params.orderId, params.startDate, params.endDate],
    queryFn: () => {
      let q = "";
      const urlParams = new URLSearchParams();
      if (params.orderId) urlParams.append("orderId", String(params.orderId));
      if (params.startDate) urlParams.append("startDate", params.startDate);
      if (params.endDate) urlParams.append("endDate", params.endDate);
      const str = urlParams.toString();
      if (str) q = `?${str}`;
      return apiRequest<any[]>(`/api/print-log${q}`);
    },
  });
}

export function useCreatePrintLog() {
  return useMutation<any, Error, { data: any }>({
    mutationFn: (variables) => apiRequest<any>("/api/print-log", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
  });
}

export function usePrintReceiptDirect() {
  return useMutation<any, Error, { data: { printerName?: string | null; content: string; copies?: number } }>({
    mutationFn: (variables) => apiRequest<any>("/api/printers/print", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
  });
}

// Dashboard Summary & Analytics
export function useGetDashboardSummary() {
  return useQuery<any>({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiRequest<any>("/api/dashboard/summary"),
  });
}

export function useGetTopProducts() {
  return useQuery<any[]>({
    queryKey: ["top-products"],
    queryFn: () => apiRequest<any[]>("/api/dashboard/top-products"),
  });
}

export function useGetSalesByHour() {
  return useQuery<any[]>({
    queryKey: ["sales-by-hour"],
    queryFn: () => apiRequest<any[]>("/api/dashboard/sales-by-hour"),
  });
}

// Reports
export function useGetSalesReport(params: { startDate?: string; endDate?: string; groupBy?: string } = {}) {
  return useQuery<any>({
    queryKey: ["sales-report", params.startDate, params.endDate, params.groupBy],
    queryFn: () => {
      let q = "";
      const urlParams = new URLSearchParams();
      if (params.startDate) urlParams.append("startDate", params.startDate);
      if (params.endDate) urlParams.append("endDate", params.endDate);
      if (params.groupBy) urlParams.append("groupBy", params.groupBy);
      const str = urlParams.toString();
      if (str) q = `?${str}`;
      return apiRequest<any>(`/api/reports/sales${q}`);
    },
  });
}

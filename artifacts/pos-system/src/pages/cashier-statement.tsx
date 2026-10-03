import React, { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Printer, Search, FileText } from "lucide-react";
import { PrintHeader } from "@/components/print-header";
import { format } from "date-fns";

export default function CashierStatement() {
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cashierId, setCashierId] = useState("all");

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const token = sessionStorage.getItem("pos_token") || "";
      const r = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data)
        ? data.filter((u: any) => u.role !== "developer" && u.username !== "developer" && !String(u.name || "").includes("مطور"))
        : [];
    },
  });

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ["cashierStatement", startDate, endDate, cashierId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (cashierId && cashierId !== "all") params.append("cashierId", cashierId);
      
      const token = sessionStorage.getItem("pos_token") || "";
      const r = await fetch(`/api/reports/cashier-statement?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Group data by date
  const groupedData: Record<string, any[]> = {};
  if (reportData && Array.isArray(reportData)) {
    reportData.forEach((row: any) => {
      if (String(row.cashier || "").includes("مطور") || row.cashier === "developer") {
        return;
      }
      if (!groupedData[row.date]) groupedData[row.date] = [];
      groupedData[row.date].push(row);
    });
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-full mx-auto space-y-6" dir="rtl">
        <div className="flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">تقرير جرد ومطابقة الكاشير</h1>
              <p className="text-sm text-slate-500">تفصيل المبيعات، المرتجعات، المقبوضات، والرصيد</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Printer className="w-4 h-4" />
            طباعة التقرير
          </Button>
        </div>

        <Card className="print:hidden">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-semibold">من تاريخ</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">إلى تاريخ</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">الكاشير</label>
              <Select value={cashierId} onValueChange={setCashierId}>
                <SelectTrigger>
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الجميع</SelectItem>
                  {users?.map((u: any) => (
                    <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => refetch()} className="gap-2">
              <Search className="w-4 h-4" />
              عرض التقرير
            </Button>
          </CardContent>
        </Card>

        {/* Printable Report Title */}
        <div className="hidden print:block mb-6">
          <PrintHeader 
            documentTitle="تقرير حركة الصناديق والمبيعات اليومي" 
            dateStr={`من: ${startDate} إلى: ${endDate}`}
          />
        </div>

        <div className="bg-white rounded-lg shadow border overflow-x-auto print:shadow-none print:border-none">
          <Table className="min-w-max text-sm">
            <TableHeader className="bg-slate-100 print:bg-slate-200">
              <TableRow>
                <TableHead className="text-right w-24">التاريخ</TableHead>
                <TableHead className="text-right">الكاشير</TableHead>
                <TableHead className="text-center w-16">فاتورة</TableHead>
                <TableHead className="text-center w-20">نوع البيع</TableHead>
                <TableHead className="text-center">المبيعات</TableHead>
                <TableHead className="text-center">المرتجع</TableHead>
                <TableHead className="text-center">الخصم</TableHead>
                <TableHead className="text-center">المورد والمقبوضات</TableHead>
                <TableHead className="text-center">ق. شبكات</TableHead>
                <TableHead className="text-center">القيود المحاسبية</TableHead>
                <TableHead className="text-center font-bold text-slate-900 bg-slate-200/50 print:bg-slate-300">الرصيد المبلغ</TableHead>
                <TableHead className="text-right w-32">التوجيه</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">جاري تحميل البيانات...</TableCell>
                </TableRow>
              )}
              {!isLoading && (!reportData || reportData.length === 0) && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-slate-500">لا توجد حركات في هذه الفترة</TableCell>
                </TableRow>
              )}
              {Object.entries(groupedData).map(([date, rows]) => (
                <React.Fragment key={date}>
                  {rows.map((row, idx) => (
                    <TableRow key={`${date}-${row.cashier}-${row.sale_type}`} className="hover:bg-slate-50">
                      <TableCell className="font-semibold text-slate-700">{idx === 0 ? row.date : ""}</TableCell>
                      <TableCell>{row.cashier}</TableCell>
                      <TableCell className="text-center">{row.invoice_count}</TableCell>
                      <TableCell className="text-center">{row.sale_type}</TableCell>
                      <TableCell className="text-center">{row.sales.toLocaleString()}</TableCell>
                      <TableCell className="text-center text-red-500">{row.returns > 0 ? row.returns.toLocaleString() : ""}</TableCell>
                      <TableCell className="text-center text-amber-600">{row.discount > 0 ? row.discount.toLocaleString() : ""}</TableCell>
                      <TableCell className="text-center text-emerald-600 font-medium">{row.deposits > 0 ? row.deposits.toLocaleString() : ""}</TableCell>
                      <TableCell className="text-center text-blue-600">{row.network > 0 ? row.network.toLocaleString() : ""}</TableCell>
                      <TableCell className="text-center text-purple-600">{row.accounting_entries > 0 ? row.accounting_entries.toLocaleString() : ""}</TableCell>
                      <TableCell className="text-center font-bold text-slate-900 bg-slate-100/50 print:bg-slate-200/50">
                        {row.balance !== null ? row.balance.toLocaleString() : ""}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  {/* Group Summary Row */}
                  <TableRow className="bg-indigo-50/50 print:bg-slate-100 font-bold border-t-2 border-slate-300">
                    <TableCell colSpan={4} className="text-left text-indigo-800">إجمالي حسب التاريخ {date}</TableCell>
                    <TableCell className="text-center">{(rows || []).reduce((sum, r) => sum + r.sales, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-center text-red-600">{(rows || []).reduce((sum, r) => sum + r.returns, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-center text-amber-700">{(rows || []).reduce((sum, r) => sum + r.discount, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-center text-emerald-700">{(rows || []).reduce((sum, r) => sum + r.deposits, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-center text-blue-700">{(rows || []).reduce((sum, r) => sum + r.network, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-center text-purple-700">{(rows || []).reduce((sum, r) => sum + r.accounting_entries, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-center text-slate-900 bg-indigo-100/50">
                      {(rows || []).reduce((sum, r) => sum + (r.balance || 0), 0).toLocaleString()}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}

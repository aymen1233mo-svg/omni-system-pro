import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, AlertTriangle, CheckCircle2, UserCheck, Lock, ArrowRight, Settings2, Sparkles, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmployeeBalanceBlockModalProps {
  open: boolean;
  onClose: () => void;
  employee: any;
  orderTotal: number;
  currency?: string;
  isPrivilegedUser: boolean;
  onAuthorizeAndProceed: (options?: { permanentAllow?: boolean; newCreditLimit?: number }) => void;
}

export function EmployeeBalanceBlockModal({
  open,
  onClose,
  employee,
  orderTotal,
  currency = "ريال",
  isPrivilegedUser,
  onAuthorizeAndProceed,
}: EmployeeBalanceBlockModalProps) {
  const { toast } = useToast();
  const [supervisorUsername, setSupervisorUsername] = useState("");
  const [supervisorPassword, setSupervisorPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [supervisorVerified, setSupervisorVerified] = useState(false);
  const [showCreditEdit, setShowCreditEdit] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState(String(employee?.credit_limit ?? 20000));
  const [isSavingPermission, setIsSavingPermission] = useState(false);

  if (!employee) return null;

  const balance = Number(employee.balance || 0);
  const creditLimit = employee.credit_limit !== null && employee.credit_limit !== undefined ? Number(employee.credit_limit) : 20000;
  const mealDeductions = Number(employee.meal_deductions_this_month || 0);
  const availableBalance = balance + creditLimit - mealDeductions;
  const shortfall = Math.max(0, orderTotal - availableBalance);

  const canManage = isPrivilegedUser || supervisorVerified;

  const handleVerifySupervisor = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!supervisorUsername.trim() || !supervisorPassword.trim()) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى إدخال اسم المستخدم وكلمة المرور للمشرف" });
      return;
    }
    setIsVerifying(true);
    try {
      const resp = await fetch("/api/auth/verify-supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: supervisorUsername.trim(),
          password: supervisorPassword.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "بيانات المشرف غير صحيحة أو غير مصرح له");
      }
      setSupervisorVerified(true);
      toast({ title: "✅ تم التحقق من صلاحية المشرف بنجاح", description: `المشرف: ${data.user?.name || supervisorUsername}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "فشل التحقق من المشرف", description: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePermanentAllow = async () => {
    setIsSavingPermission(true);
    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const resp = await fetch(`/api/hr/employees/${employee.id}/credit-controls`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          allow_exceed_balance: 1,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "فشل تحديث صلاحية الموظف");
      toast({
        title: "✅ تم منح الموظف صلاحية التجاوز الدائمة",
        description: `أصبح بإمكان الموظف ${employee.name} قطع الطلبات حتى لو كان الرصيد غير كافٍ.`,
      });
      onAuthorizeAndProceed({ permanentAllow: true });
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ في حفظ الصلاحية", description: err.message });
    } finally {
      setIsSavingPermission(false);
    }
  };

  const handleUpdateCreditLimit = async () => {
    const limitNum = Number(newCreditLimit);
    if (isNaN(limitNum) || limitNum < 0) {
      toast({ variant: "destructive", title: "قيمة غير صالحة", description: "يرجى إدخال حد ائتمان صحيح" });
      return;
    }
    setIsSavingPermission(true);
    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const resp = await fetch(`/api/hr/employees/${employee.id}/credit-controls`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          credit_limit: limitNum,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "فشل تحديث سقف الائتمان");
      toast({
        title: "✅ تم تعديل سقف الائتمان بنجاح",
        description: `الحد الجديد للموظف: ${limitNum.toLocaleString()} ${currency}`,
      });
      onAuthorizeAndProceed({ newCreditLimit: limitNum });
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ في تحديث الحد", description: err.message });
    } finally {
      setIsSavingPermission(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent dir="rtl" className="max-w-lg p-0 overflow-hidden border-2 border-red-500/30 rounded-2xl shadow-2xl bg-white">
        {/* Modern Alert Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 text-white relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
              <ShieldAlert className="w-7 h-7 text-white animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-950/40 text-amber-200 border border-white/20 mb-1">
                <AlertTriangle className="w-3 h-3 text-amber-300" />
                تنبيه مالي صارم
              </div>
              <DialogTitle className="text-xl font-black text-white tracking-wide">
                تم منع قطع الطلب للموظف
              </DialogTitle>
              <p className="text-xs text-white/90 font-medium mt-0.5">
                رصيد الموظف وسقف الائتمان المخصص لا يسمحان بإتمام هذا الطلب
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Employee Identity Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{employee.name}</span>
                <span className="text-[11px] bg-slate-200/80 font-mono font-bold px-2 py-0.5 rounded-md text-slate-700">
                  #{employee.employee_number || employee.id}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-3">
                {employee.position && <span>المسمى: <strong>{employee.position}</strong></span>}
                {employee.department_name && <span>القسم: <strong>{employee.department_name}</strong></span>}
              </div>
            </div>
            <div className="text-left shrink-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                رصيد غير كافٍ
              </span>
            </div>
          </div>

          {/* Financial Breakdown Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <div className="text-[11px] font-medium text-slate-500 mb-1">قيمة الطلب الحالي</div>
              <div className="font-mono text-base font-black text-slate-900">
                {orderTotal.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} {currency}
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-center">
              <div className="text-[11px] font-medium text-amber-800 mb-1">الرصيد المتاح للقطع</div>
              <div className={`font-mono text-base font-black ${availableBalance <= 0 ? "text-red-600" : "text-amber-700"}`}>
                {availableBalance.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} {currency}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <div className="text-[11px] font-medium text-slate-500 mb-1">سقف الائتمان المسموح</div>
              <div className="font-mono text-sm font-bold text-slate-700">
                {creditLimit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} {currency}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">حد السحب الأقصى</div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <div className="text-[11px] font-bold text-red-700 mb-1">مبلغ العجز المطلوب</div>
              <div className="font-mono text-base font-black text-red-600">
                {shortfall.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} {currency}
              </div>
              <div className="text-[10px] text-red-500 mt-0.5">يتجاوز الرصيد المتاح</div>
            </div>
          </div>

          {/* Reason explanation text box */}
          <div className="bg-amber-50/60 border border-amber-200/90 rounded-xl p-3.5 text-xs text-amber-950 space-y-1 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              سبب المنع:
            </div>
            <p>
              يُمنع قطع هذا الطلب تلقائياً لأن إجمالي قيمة الطلب ({orderTotal.toLocaleString()} {currency}) يتجاوز الرصيد المتاح وسقف الائتمان المخصص للموظف ({creditLimit.toLocaleString()} {currency}).
            </p>
            <p className="text-[11px] text-amber-800">
              لإتمام العملية، يلزم الحصول على إذن استثنائي من مدير النظام أو تعديل صلاحية هذا الموظف.
            </p>
          </div>

          {/* Admin / Supervisor Control Panel */}
          {canManage ? (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-4 space-y-3 shadow-md border border-slate-700">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-white">لوحة تحكم مدير النظام والمشرف</span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  صلاحية مدير معتمدة
                </span>
              </div>

              <div className="space-y-2">
                {/* 1. One-time Manager Override */}
                <Button
                  onClick={() => onAuthorizeAndProceed()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 justify-center gap-2 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  تجاوز استثنائي من مدير النظام والسماح بالقطع (لهذا الطلب فقط)
                </Button>

                {/* 2. Permanent Exceed Permission */}
                <Button
                  onClick={handlePermanentAllow}
                  disabled={isSavingPermission}
                  variant="outline"
                  className="w-full bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-400/40 font-bold text-xs h-9 justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  منح الموظف صلاحية دائمة: السماح بالقطع دائماً حتى ولو رصيده لا يسمح
                </Button>

                {/* 3. Quick Credit Limit Adjustment */}
                {!showCreditEdit ? (
                  <Button
                    onClick={() => setShowCreditEdit(true)}
                    variant="ghost"
                    className="w-full text-slate-300 hover:text-white hover:bg-slate-700/50 text-xs h-8 justify-center gap-1.5"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    تعديل سقف الائتمان للموظف (رفع الحد من {creditLimit.toLocaleString()})
                  </Button>
                ) : (
                  <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-2.5 space-y-2">
                    <label className="text-[11px] font-bold text-slate-300">سقف الائتمان الجديد (ريال):</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={newCreditLimit}
                        onChange={e => setNewCreditLimit(e.target.value)}
                        className="h-8 text-xs font-mono font-bold bg-slate-900 border-slate-600 text-white text-center"
                        autoFocus
                      />
                      <Button
                        onClick={handleUpdateCreditLimit}
                        disabled={isSavingPermission}
                        size="sm"
                        className="h-8 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shrink-0"
                      >
                        حفظ ومتابعة
                      </Button>
                      <Button
                        onClick={() => setShowCreditEdit(false)}
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-slate-400 hover:text-white"
                      >
                        إلغاء
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Cashier Login Prompt for Supervisor Override */
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>إذن وتفويض مدير النظام / المشرف:</span>
              </div>
              <p className="text-[11px] text-slate-500">
                إذا كان المشرف أو مدير النظام حاضراً، يمكنه إدخال بياناته للتجاوز والسماح بالقطع فوراً:
              </p>
              <form onSubmit={handleVerifySupervisor} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="text"
                    placeholder="اسم المستخدم للمشرف"
                    value={supervisorUsername}
                    onChange={e => setSupervisorUsername(e.target.value)}
                    className="h-8 text-xs bg-white"
                    dir="ltr"
                  />
                  <Input
                    type="password"
                    placeholder="كلمة المرور"
                    value={supervisorPassword}
                    onChange={e => setSupervisorPassword(e.target.value)}
                    className="h-8 text-xs bg-white"
                    dir="ltr"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isVerifying || !supervisorUsername.trim() || !supervisorPassword.trim()}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs h-8 gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isVerifying ? "جاري التحقق..." : "تأكيد صلاحية المشرف وتجاوز المنع"}
                </Button>
              </form>
            </div>
          )}
        </div>

        <DialogFooter className="bg-slate-50 p-3.5 border-t border-slate-200 flex justify-between items-center sm:justify-between">
          <Button
            variant="outline"
            onClick={onClose}
            className="text-xs h-9 font-bold text-slate-700 hover:bg-slate-100 gap-1.5"
          >
            <XCircle className="w-4 h-4 text-slate-500" />
            إلغاء الطلب والتراجع
          </Button>

          <span className="text-[11px] text-slate-400 font-mono">
            Omni System Pro Credit Control
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

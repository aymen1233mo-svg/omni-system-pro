import React, { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Phone,
  Sparkles,
  Layers,
  FileText,
  CheckCheck,
  Zap,
  KeyRound,
  Wifi,
  Radio,
  Mail,
  Edit2,
  Trash2,
  Search,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Eye,
  EyeOff,
  Copy,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers
    }
  }).then(async (r) => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ في الخادم");
    }
    return r.json();
  });
}

export default function TravelNotificationsHubPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"instant" | "automations" | "templates" | "gateways" | "logs">("instant");

  // Instant Send Form
  const [sendForm, setSendForm] = useState({
    channel: "whatsapp",
    recipient_phone: "0505544332",
    recipient_name: "عبدالله العتيبي",
    template_code: "TPL-FLIGHT-CONFIRM",
    gateway_id: "",
    message_body: `عزيزنا المسافر عبدالله العتيبي 👋
يسعدنا إبلاغك بتأكيد حجز رحلتك بنجاح ✈️
رقم الحجز (PNR): 6X9ZKL
رقم التذكرة: 065-2415896321
الرحلة: SV 112 من الرياض إلى دبي
المغادرة: 10 سبتمبر 2026 الساعة 08:10 صباحاً
نتمنى لكم رحلة سعيدة وموفقة! 🌟
وكالة أومني فلاي للسفر والسياحة`
  });

  // Filters & State
  const [logFilter, setLogFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Record<number, boolean>>({});

  // Modals State
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<any | null>(null);
  const [gwModalOpen, setGwModalOpen] = useState(false);
  const [editingGw, setEditingGw] = useState<any | null>(null);
  const [testPhone, setTestPhone] = useState("0505544332");

  // Queries
  const { data: templates = [], isLoading: tplLoading } = useQuery<any[]>({
    queryKey: ["notification-templates"],
    queryFn: () => fetchWithAuth("/api/travel/notifications/templates")
  });

  const { data: automations = [], isLoading: autoLoading } = useQuery<any[]>({
    queryKey: ["notification-automations"],
    queryFn: () => fetchWithAuth("/api/travel/notifications/automations")
  });

  const { data: gateways = [], isLoading: gwLoading } = useQuery<any[]>({
    queryKey: ["travel-gateways"],
    queryFn: () => fetchWithAuth("/api/travel/notifications/gateways")
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["notification-logs"],
    queryFn: () => fetchWithAuth("/api/travel/notifications/logs")
  });

  // Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: any) =>
      fetchWithAuth<any>("/api/travel/notifications/send", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
      toast({
        title: "تم إرسال الرسالة بنجاح! 📱",
        description: res.message
      });
    },
    onError: (err: any) => toast({ title: "فشل الإرسال", description: err.message, variant: "destructive" })
  });

  // Trigger Pre-Flight Batch Mutation
  const triggerBatchMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth<any>("/api/travel/notifications/trigger-preflight-batch", {
        method: "POST"
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
      toast({
        title: "تم إطلاق تذكيرات الرحلات بنجاح! ✈️",
        description: res.message
      });
    },
    onError: (err: any) => toast({ title: "فشل الإرسال الجماعي", description: err.message, variant: "destructive" })
  });

  // Update Gateway Mutation
  const updateGatewayMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      fetchWithAuth(`/api/travel/notifications/gateways/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel-gateways"] });
      setGwModalOpen(false);
      toast({ title: "تم حفظ إعدادات البوابة بنجاح 🔑" });
    },
    onError: (err: any) => toast({ title: "فشل الحفظ", description: err.message, variant: "destructive" })
  });

  // Test Gateway Mutation
  const testGatewayMutation = useMutation({
    mutationFn: ({ id, phone }: { id: number; phone?: string }) =>
      fetchWithAuth<any>(`/api/travel/notifications/gateways/${id}/test`, {
        method: "POST",
        body: JSON.stringify({ test_phone: phone })
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["travel-gateways"] });
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
      if (res.success) {
        toast({
          title: "نجح اختبار الاتصال بالبوابة! 🌐⚡",
          description: `زمن الاستجابة: ${res.latency_ms}ms - معرف الإرسال: ${res.gateway_message_id}`
        });
      } else {
        toast({
          title: "فشل اختبار البوابة",
          description: res.error || res.message,
          variant: "destructive"
        });
      }
    }
  });

  // Toggle Automation Mutation
  const toggleAutomationMutation = useMutation({
    mutationFn: ({ id, is_enabled }: { id: number; is_enabled: number }) =>
      fetchWithAuth(`/api/travel/notifications/automations/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_enabled })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-automations"] });
      toast({ title: "تم تحديث حالة الأتمتة بنجاح" });
    }
  });

  // Save Template Mutation
  const saveTemplateMutation = useMutation({
    mutationFn: (data: any) =>
      editingTpl
        ? fetchWithAuth(`/api/travel/notifications/templates/${editingTpl.id}`, { method: "PUT", body: JSON.stringify(data) })
        : fetchWithAuth("/api/travel/notifications/templates", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      setTplModalOpen(false);
      setEditingTpl(null);
      toast({ title: "تم حفظ قالب الرسالة بنجاح 📝" });
    },
    onError: (err: any) => toast({ title: "خطأ في حفظ القالب", description: err.message, variant: "destructive" })
  });

  const filteredLogs = logs.filter((log) => {
    if (logFilter !== "all" && log.status !== logFilter) return false;
    if (logSearch) {
      const q = logSearch.toLowerCase();
      return (
        log.recipient_name?.toLowerCase().includes(q) ||
        log.recipient_phone?.includes(q) ||
        log.message_body?.toLowerCase().includes(q) ||
        log.gateway_message_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Main Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 bg-emerald-600/30 border border-emerald-400/30 rounded-2xl">
              <MessageSquare className="w-8 h-8 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">مركز التنبيهات والواتساب والـ API Hub</h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 text-[10px]">
                  Multi-Gateway Cloud API
                </Badge>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                إرسال التذاكر وتأكيدات الحجز وتحديثات التأشيرات وتذكيرات ما قبل الإقلاع بـ 24 ساعة عبر Infobip، WhatsApp Meta، Twilio، Unifonic، و Google Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/travel-dashboard">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                الرجوع للواجهة الرئيسية
              </button>
            </Link>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 shadow-lg cursor-pointer"
              onClick={() => triggerBatchMutation.mutate()}
              disabled={triggerBatchMutation.isPending}
            >
              {triggerBatchMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin ml-1.5" /> : <Zap className="w-4 h-4 ml-1.5" />}
              إطلاق تذكيرات رحلات الغد آلياً ⚡
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("instant")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "instant"
                ? "bg-emerald-700 text-white shadow-md shadow-emerald-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Send className="w-4 h-4" />
            مركز الإرسال والمحاكي التفاعلي
          </button>

          <button
            onClick={() => setActiveTab("gateways")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "gateways"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-500" />
            بوابات ومفاتيح الـ API ({gateways.length})
          </button>

          <button
            onClick={() => setActiveTab("automations")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "automations"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Zap className="w-4 h-4 text-amber-500" />
            قواعد الأتمتة والمحفزات الذكية ({automations.length})
          </button>

          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "templates"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            قوالب الرسائل الديناميكية ({templates.length})
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "logs"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            سجل وتتبع التسليم ({logs.length})
          </button>
        </div>

        {/* TAB 1: INSTANT SENDER & WHATSAPP PHONE SIMULATOR */}
        {activeTab === "instant" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Send className="w-5 h-5 text-emerald-600" />
                    إرسال رسالة فورية للمسافر
                  </CardTitle>
                  <CardDescription>اختر القالب الجاهز وعدل النص للإرسال عبر واتساب أو الرسائل القصيرة</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">القناة المستخدمة:</label>
                      <select
                        className="w-full h-9 border rounded-lg px-3 bg-white text-xs"
                        value={sendForm.channel}
                        onChange={(e) => setSendForm({ ...sendForm, channel: e.target.value })}
                      >
                        <option value="whatsapp">واتساب (WhatsApp Cloud API)</option>
                        <option value="sms">رسالة قصيرة (SMS Gateway)</option>
                        <option value="email">بريد إلكتروني (Email)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1">البوابة ومزود الخدمة:</label>
                      <select
                        className="w-full h-9 border rounded-lg px-3 bg-white text-xs"
                        value={sendForm.gateway_id}
                        onChange={(e) => setSendForm({ ...sendForm, gateway_id: e.target.value })}
                      >
                        <option value="">تلقائي (البوابة الافتراضية النشطة)</option>
                        {gateways.filter(g => g.is_enabled === 1).map(g => (
                          <option key={g.id} value={g.id}>{g.provider_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1">اختر قالباً جاهزاً:</label>
                      <select
                        className="w-full h-9 border rounded-lg px-3 bg-white text-xs"
                        onChange={(e) => {
                          const tpl = templates?.find((t) => t.template_code === e.target.value);
                          if (tpl) {
                            setSendForm({
                              ...sendForm,
                              template_code: tpl.template_code,
                              message_body: tpl.message_body
                            });
                          }
                        }}
                      >
                        {templates?.map((t) => (
                          <option key={t.id} value={t.template_code}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">اسم المسافر أو العميل:</label>
                      <Input
                        className="h-9 text-xs"
                        value={sendForm.recipient_name}
                        onChange={(e) => setSendForm({ ...sendForm, recipient_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">رقم الهاتف (الواتساب) أو البريد:</label>
                      <Input
                        dir="ltr"
                        className="h-9 text-xs font-mono text-left"
                        value={sendForm.recipient_phone}
                        onChange={(e) => setSendForm({ ...sendForm, recipient_phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">نص الرسالة:</label>
                    <Textarea
                      rows={8}
                      className="font-sans text-xs leading-relaxed"
                      value={sendForm.message_body}
                      onChange={(e) => setSendForm({ ...sendForm, message_body: e.target.value })}
                    />
                  </div>

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-sm shadow-md"
                    onClick={() => sendMessageMutation.mutate(sendForm)}
                    disabled={sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
                    إرسال الرسالة الآن عبر WhatsApp / SMS API 📱
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Live Phone Simulator */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-[340px] bg-slate-900 border-[10px] border-slate-800 rounded-[44px] shadow-2xl p-4 overflow-hidden relative">
                {/* Phone Speaker & Camera Notch */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full z-20 flex items-center justify-center">
                  <div className="w-3 h-3 bg-slate-950 rounded-full mr-2" />
                  <div className="w-10 h-1.5 bg-slate-900 rounded-full" />
                </div>

                {/* WhatsApp Chat UI */}
                <div className="bg-[#0b141a] text-[#e9edef] rounded-3xl pt-8 pb-4 px-3 min-h-[500px] flex flex-col justify-between font-sans text-xs">
                  {/* Chat Header */}
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#202c33]">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                      ✈️
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-[13px] flex items-center gap-1">
                        <span>Omni System Pro 🌍</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00a884]" />
                      </div>
                      <span className="text-[10px] text-[#8696a0]">حساب أعمال تجاري موثق</span>
                    </div>
                  </div>

                  {/* Message Bubble */}
                  <div className="my-auto py-2">
                    <div className="bg-[#005c4b] text-[#e9edef] p-3 rounded-2xl rounded-tr-none shadow-sm relative space-y-2">
                      <p className="whitespace-pre-wrap leading-relaxed text-[11.5px] font-sans">
                        {sendForm.message_body}
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0] pt-1">
                        <span>{new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      </div>
                    </div>
                  </div>

                  {/* Input Simulation Bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#202c33] text-[#8696a0]">
                    <div className="flex-1 bg-[#202c33] px-3 py-1.5 rounded-full text-[11px] text-slate-400">
                      اكتب رسالة...
                    </div>
                    <div className="w-7 h-7 bg-[#00a884] rounded-full flex items-center justify-center text-white">
                      <Send className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: API GATEWAYS & KEYS */}
        {activeTab === "gateways" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  موفرو الخدمات السحابية وبوابات الإشعارات (Notification Gateways)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  قم بإدخال وتحديث مفاتيح الـ API ورموز الوصول لتفعيل الاتصال الفوري بمزودي الخدمة
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  dir="ltr"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="رقم هاتف الفحص"
                  className="h-8 text-xs font-mono w-40 text-left"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gateways.map((gw: any) => {
                const isKeyVisible = visibleKeys[gw.id] || false;
                const isTesting = testGatewayMutation.isPending && (testGatewayMutation.variables as any)?.id === gw.id;

                let icon = <MessageSquare className="w-5 h-5 text-emerald-600" />;
                if (gw.channel_types.includes("email")) icon = <Mail className="w-5 h-5 text-blue-600" />;
                else if (gw.provider_key === "unifonic") icon = <Radio className="w-5 h-5 text-amber-600" />;
                else if (gw.provider_key === "twilio") icon = <Cpu className="w-5 h-5 text-red-600" />;

                return (
                  <div
                    key={gw.id}
                    className={`bg-white border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between gap-4 ${
                      gw.is_enabled ? "border-slate-200 hover:border-indigo-300" : "border-slate-200/60 bg-slate-50 opacity-75"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-slate-100 rounded-xl">
                            {icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900 text-sm">{gw.provider_name}</h3>
                              {gw.is_default === 1 && (
                                <Badge className="bg-indigo-600 text-white text-[10px] py-0 px-1.5 font-bold">
                                  البوابة الافتراضية
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">{gw.provider_key}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => updateGatewayMutation.mutate({
                            id: gw.id,
                            data: { is_enabled: gw.is_enabled ? 0 : 1 }
                          })}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                            gw.is_enabled
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${gw.is_enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {gw.is_enabled ? "مفعل (Active)" : "معطل (Disabled)"}
                        </button>
                      </div>

                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-slate-500 font-medium">مفتاح الـ API:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-800 font-bold">
                              {gw.api_key ? (isKeyVisible ? gw.api_key : gw.api_key_masked) : <span className="text-red-400 text-[11px]">غير مضبوط</span>}
                            </span>
                            {gw.api_key && (
                              <button
                                type="button"
                                onClick={() => setVisibleKeys(p => ({ ...p, [gw.id]: !p[gw.id] }))}
                                className="text-slate-400 hover:text-slate-600 p-0.5"
                              >
                                {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">Account SID / WABA:</span>
                            <span className="font-mono font-bold text-slate-700 truncate block">
                              {gw.account_id || "تلقائي"}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">Sender ID / From:</span>
                            <span className="font-mono font-bold text-slate-700 truncate block">
                              {gw.sender_id || "افتراضي"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {gw.last_test_status && (
                        <div className={`mt-3 p-2 rounded-lg text-xs flex items-center justify-between ${
                          gw.last_test_status === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                        }`}>
                          <div className="flex items-center gap-1.5">
                            {gw.last_test_status === "success" ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                            <span className="text-[11px] font-medium">{gw.last_test_message}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{gw.last_test_at?.slice(11, 16)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingGw(gw);
                          setGwModalOpen(true);
                        }}
                        className="text-xs h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold"
                      >
                        <Edit2 className="w-3.5 h-3.5 ml-1" />
                        تعديل المفاتيح والتهيئة
                      </Button>

                      <Button
                        size="sm"
                        disabled={isTesting}
                        onClick={() => testGatewayMutation.mutate({ id: gw.id, phone: testPhone })}
                        className="text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                      >
                        {isTesting ? <RefreshCw className="w-3.5 h-3.5 ml-1 animate-spin" /> : <Wifi className="w-3.5 h-3.5 ml-1 text-emerald-400" />}
                        فحص واختبار الاتصال
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: AUTOMATION RULES */}
        {activeTab === "automations" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                محرك وقواعد الأتمتة المجدولة (Automated Event Triggers)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديد الأحداث التشغيلية التي تطلق إشعارات فورية وتلقائية للعملاء والمسافرين
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {automations.map((auto) => (
                <div key={auto.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{auto.name}</h3>
                        <Badge className="bg-indigo-50 text-indigo-700 text-[10px]">
                          {auto.channel.toUpperCase()}
                        </Badge>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{auto.event_trigger}</span>
                    </div>

                    <button
                      onClick={() => toggleAutomationMutation.mutate({
                        id: auto.id,
                        is_enabled: auto.is_enabled ? 0 : 1
                      })}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                        auto.is_enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${auto.is_enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {auto.is_enabled ? "مفعل تلقائياً" : "معطل"}
                    </button>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {auto.template_preview || "قالب الرسالة المرتبط"}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>التوقيت: {auto.hours_before > 0 ? `قبل ${auto.hours_before} ساعة` : "إرسال فوري عند وقوع الحدث"}</span>
                    <span className="font-mono text-indigo-600">{auto.template_code}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TEMPLATES */}
        {activeTab === "templates" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  قوالب الرسائل الديناميكية المعتمدة (Dynamic Message Templates)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  قوالب الرسائل التي تدعم المتغيرات التلقائية مثل اسم المسافر، الـ PNR، رقم التذكرة، والروابط
                </p>
              </div>

              <Button
                onClick={() => {
                  setEditingTpl(null);
                  setTplModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9"
              >
                <Plus className="w-4 h-4 ml-1" />
                إضافة قالب جديد
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tpl) => (
                <div key={tpl.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{tpl.name}</h3>
                      <span className="text-[11px] font-mono text-indigo-600">{tpl.template_code}</span>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">
                      {tpl.channel}
                    </Badge>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs font-sans text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {tpl.message_body}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span>المتغيرات المدعومة:</span>
                      <span className="font-mono text-slate-600">{"{passenger_name}, {pnr}, {flight_no}"}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTpl(tpl);
                        setTplModalOpen(true);
                      }}
                      className="text-xs h-7 text-indigo-600 font-bold"
                    >
                      <Edit2 className="w-3.5 h-3.5 ml-1" />
                      تعديل القالب
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: DELIVERY LOGS */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  سجل الرسائل وتأكيدات التسليم (Message Delivery Outbox & Logs)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تتبع حالة كل رسالة أرسلت عبر البوابات مع معرف الرسالة ورمز الاستجابة
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                  <Input
                    placeholder="بحث برقم الهاتف، الاسم، المعرف..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="h-8 text-xs pr-8"
                  />
                </div>

                <select
                  value={logFilter}
                  onChange={e => setLogFilter(e.target.value)}
                  className="h-8 border rounded-lg px-2 text-xs bg-white"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="delivered">تم التسليم (Delivered)</option>
                  <option value="sent">تم الإرسال (Sent)</option>
                  <option value="failed">فشل الإرسال (Failed)</option>
                </select>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">القناة</th>
                      <th className="p-3">المستلم</th>
                      <th className="p-3">رقم الهاتف</th>
                      <th className="p-3">نص الرسالة</th>
                      <th className="p-3">معرف البوابة (Message ID)</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">تاريخ ووقت الإرسال</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-mono text-slate-400">#{log.id}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] bg-slate-50">
                            {log.channel}
                          </Badge>
                        </td>
                        <td className="p-3 font-bold text-slate-800">{log.recipient_name || "عميل"}</td>
                        <td className="p-3 font-mono text-slate-600" dir="ltr">{log.recipient_phone}</td>
                        <td className="p-3 max-w-xs truncate text-slate-600" title={log.message_body}>
                          {log.message_body}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-slate-500" dir="ltr">
                          {log.gateway_message_id || "N/A"}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            log.status === "delivered"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : log.status === "failed"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              log.status === "delivered" ? "bg-emerald-500" : log.status === "failed" ? "bg-red-500" : "bg-blue-500"
                            }`} />
                            {log.status === "delivered" ? "تم التسليم" : log.status === "failed" ? "فشل" : "مرسلة"}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-500 font-mono">
                          {log.sent_at}
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          لا توجد رسائل مسجلة مطابقة للبحث
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Gateway Settings */}
        {gwModalOpen && editingGw && (
          <Dialog open={gwModalOpen} onOpenChange={v => { if (!v) setGwModalOpen(false); }}>
            <DialogContent dir="rtl" className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-black">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  تهيئة مفاتيح API لبوابة: {editingGw.provider_name}
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  updateGatewayMutation.mutate({
                    id: editingGw.id,
                    data: {
                      provider_name: fd.get("provider_name"),
                      channel_types: fd.get("channel_types"),
                      api_key: fd.get("api_key"),
                      api_secret: fd.get("api_secret"),
                      base_url: fd.get("base_url"),
                      account_id: fd.get("account_id"),
                      sender_id: fd.get("sender_id"),
                      webhook_verify_token: fd.get("webhook_verify_token"),
                      is_enabled: fd.get("is_enabled") === "1" ? 1 : 0,
                      is_default: fd.get("is_default") === "1" ? 1 : 0
                    }
                  });
                }}
                className="space-y-4 py-2 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">اسم البوابة:</label>
                    <Input name="provider_name" defaultValue={editingGw.provider_name} required className="h-9 text-xs" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">القنوات المدعومة:</label>
                    <select name="channel_types" defaultValue={editingGw.channel_types} className="w-full rounded-md border border-input bg-background px-3 h-9 text-xs">
                      <option value="whatsapp">واتساب فقط (WhatsApp)</option>
                      <option value="sms">رسائل قصيرة فقط (SMS)</option>
                      <option value="whatsapp,sms">واتساب ورسائل قصيرة (WhatsApp + SMS)</option>
                      <option value="email">بريد إلكتروني (Email / SMTP)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    مفتاح الـ API / رمز الوصول (API Key / Access Token) *
                  </label>
                  <Input name="api_key" defaultValue={editingGw.api_key || ""} dir="ltr" className="h-9 text-xs font-mono" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">المفتاح السري (API Secret / Password):</label>
                    <Input name="api_secret" type="password" defaultValue={editingGw.api_secret || ""} dir="ltr" className="h-9 text-xs font-mono" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">الرابط الأساسي (Base URL):</label>
                    <Input name="base_url" defaultValue={editingGw.base_url || ""} dir="ltr" className="h-9 text-xs font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Account SID / WABA ID:</label>
                    <Input name="account_id" defaultValue={editingGw.account_id || ""} dir="ltr" className="h-9 text-xs font-mono" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Sender ID / Phone Number ID:</label>
                    <Input name="sender_id" defaultValue={editingGw.sender_id || ""} dir="ltr" className="h-9 text-xs font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 border p-2.5 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100">
                    <input type="checkbox" name="is_enabled" value="1" defaultChecked={editingGw.is_enabled === 1} className="rounded text-indigo-600 w-4 h-4" />
                    <span className="font-bold text-slate-800">تفعيل البوابة</span>
                  </label>

                  <label className="flex items-center gap-2 border p-2.5 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100">
                    <input type="checkbox" name="is_default" value="1" defaultChecked={editingGw.is_default === 1} className="rounded text-indigo-600 w-4 h-4" />
                    <span className="font-bold text-slate-800">تعيين كبوابة رئيسية</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setGwModalOpen(false)} className="h-9 text-xs">إلغاء</Button>
                  <Button type="submit" disabled={updateGatewayMutation.isPending} className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    {updateGatewayMutation.isPending ? "جاري الحفظ..." : "حفظ المفاتيح"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Modal: Template Editor */}
        {tplModalOpen && (
          <Dialog open={tplModalOpen} onOpenChange={v => { if (!v) setTplModalOpen(false); }}>
            <DialogContent dir="rtl" className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-black">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  {editingTpl ? "تعديل قالب الرسالة" : "إضافة قالب رسالة جديد"}
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  saveTemplateMutation.mutate({
                    name: fd.get("name"),
                    template_code: fd.get("template_code"),
                    channel: fd.get("channel"),
                    category: fd.get("category"),
                    message_body: fd.get("message_body")
                  });
                }}
                className="space-y-4 py-2 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">اسم القالب:</label>
                    <Input name="name" defaultValue={editingTpl?.name || ""} required className="h-9 text-xs" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">رمز القالب (Code):</label>
                    <Input name="template_code" defaultValue={editingTpl?.template_code || `TPL-${Date.now().toString().slice(-4)}`} required className="h-9 text-xs font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">القناة:</label>
                    <select name="channel" defaultValue={editingTpl?.channel || "whatsapp"} className="w-full rounded-md border border-input bg-background px-3 h-9 text-xs">
                      <option value="whatsapp">واتساب (WhatsApp)</option>
                      <option value="sms">رسائل قصيرة (SMS)</option>
                      <option value="email">بريد إلكتروني (Email)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">التصنيف:</label>
                    <select name="category" defaultValue={editingTpl?.category || "operations"} className="w-full rounded-md border border-input bg-background px-3 h-9 text-xs">
                      <option value="operations">عمليات تشغيلية</option>
                      <option value="flight_reminder">تذكير رحلة</option>
                      <option value="ticket_issue">إصدار تذكرة</option>
                      <option value="visa_update">تحديث تأشيرة</option>
                      <option value="passport_expiry">انتهاء جواز</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">نص الرسالة مع المتغيرات:</label>
                  <Textarea name="message_body" rows={6} defaultValue={editingTpl?.message_body || ""} required className="text-xs font-sans leading-relaxed" />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يمكنك استخدام المتغيرات مثل: {"{passenger_name}, {pnr}, {ticket_number}, {flight_no}, {destination}, {visa_code}"}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setTplModalOpen(false)} className="h-9 text-xs">إلغاء</Button>
                  <Button type="submit" disabled={saveTemplateMutation.isPending} className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    {saveTemplateMutation.isPending ? "جاري الحفظ..." : "حفظ القالب"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );
}

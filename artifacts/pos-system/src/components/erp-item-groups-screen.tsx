import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FolderTree, Plus, Save, Trash2, Edit3, Printer, RefreshCw, Layers,
  Search, Info, Check, Sparkles, HelpCircle, Download, ArrowDown, Tag,
  Building2, Hash, FileSpreadsheet, Eye, Network, CheckSquare, List
} from "lucide-react";

export type GroupTab = "sub_groups" | "sub_sub_groups" | "auxiliary_groups" | "classifications";

export interface ItemSubGroup {
  id: number;
  main_group_id: number;
  main_group_name: string;
  sub_group_code: string;
  name: string;
  foreign_name: string;
  active: number;
}

export interface ItemSubSubGroup {
  id: number;
  sub_group_id: number;
  sub_group_name: string;
  main_group_id: number;
  main_group_name: string;
  sub_sub_group_code: string;
  item_code_prefix: string;
  name: string;
  foreign_name: string;
  active: number;
}

export interface ItemAuxiliaryGroup {
  id: number;
  group_code: string;
  name: string;
  foreign_name: string;
  main_group_id: number;
  active: number;
}

export interface ItemClassification {
  id: number;
  classification_code: string;
  parent_code: string;
  name: string;
  foreign_name: string;
  is_transactional: number;
  main_group_id: number;
  activity_name: string;
  default_markup_pct: number;
  active: number;
}

export function ErpItemGroupsScreen() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<GroupTab>("sub_groups");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form States
  const [mainGroupId, setMainGroupId] = useState<number>(80);
  const [mainGroupName, setMainGroupName] = useState<string>("80 مجموعات الساعات");
  const [subGroupId, setSubGroupId] = useState<number>(1);
  const [subGroupName, setSubGroupName] = useState<string>("001 ساعات كاسيو");
  const [subGroupCode, setSubGroupCode] = useState<string>("001");
  const [subSubGroupCode, setSubSubGroupCode] = useState<string>("001");
  const [auxGroupCode, setAuxGroupCode] = useState<string>("001");
  const [classificationCode, setClassificationCode] = useState<string>("1101");
  const [parentCode, setParentCode] = useState<string>("11");
  const [itemCodePrefix, setItemCodePrefix] = useState<string>("080");

  const [name, setName] = useState<string>("");
  const [foreignName, setForeignName] = useState<string>("");
  const [isTransactional, setIsTransactional] = useState<boolean>(true);
  const [activityName, setActivityName] = useState<string>("نشاط أصناف تجارية");
  const [defaultMarkupPct, setDefaultMarkupPct] = useState<number>(15.0);

  // Items Fetch/Linking Section State (Images 1, 2, 3)
  const [fromGroupNum, setFromGroupNum] = useState<string>("");
  const [toGroupNum, setToGroupNum] = useState<string>("");
  const [fromItemNum, setFromItemNum] = useState<string>("");
  const [toItemNum, setToItemNum] = useState<string>("");
  const [itemTypeSelect, setItemTypeSelect] = useState<string>("1-سلعي");
  const [displayMode, setDisplayMode] = useState<string>("1-حسب الرقم");
  const [fetchPreLinked, setFetchPreLinked] = useState<boolean>(true);
  const [linkedItemsGrid, setLinkedItemsGrid] = useState<any[]>([]);
  const [isLinkingItems, setIsLinkingItems] = useState<boolean>(false);

  // Assistant Group Find Modal State (Image 3)
  const [showAuxModal, setShowAuxModal] = useState<boolean>(false);
  const [auxSearchFilter, setAuxSearchFilter] = useState<string>("");

  // Fetch all group datasets
  const { data: subGroupsRes, refetch: refetchSub } = useQuery({
    queryKey: ["item-sub-groups"],
    queryFn: async () => (await fetch("/api/item-groups/sub-groups")).json()
  });

  const { data: subSubGroupsRes, refetch: refetchSubSub } = useQuery({
    queryKey: ["item-sub-sub-groups"],
    queryFn: async () => (await fetch("/api/item-groups/sub-sub-groups")).json()
  });

  const { data: auxGroupsRes, refetch: refetchAux } = useQuery({
    queryKey: ["item-auxiliary-groups"],
    queryFn: async () => (await fetch("/api/item-groups/auxiliary-groups")).json()
  });

  const { data: classRes, refetch: refetchClass } = useQuery({
    queryKey: ["item-classifications"],
    queryFn: async () => (await fetch("/api/item-groups/classifications")).json()
  });

  const subGroups: ItemSubGroup[] = subGroupsRes?.data || [];
  const subSubGroups: ItemSubSubGroup[] = subSubGroupsRes?.data || [];
  const auxGroups: ItemAuxiliaryGroup[] = auxGroupsRes?.data || [];
  const classifications: ItemClassification[] = classRes?.data || [];

  // Reset Form
  useEffect(() => {
    handleResetForm();
  }, [activeTab]);

  const handleResetForm = () => {
    setEditingId(null);
    setName("");
    setForeignName("");
    setLinkedItemsGrid([]);

    if (activeTab === "sub_groups") {
      setSubGroupCode("00" + ((subGroups.length || 0) + 1));
      setName("ساعات كاسيو جديدة");
      setForeignName("Casio Watches");
    } else if (activeTab === "sub_sub_groups") {
      setSubSubGroupCode("00" + ((subSubGroups.length || 0) + 1));
      setItemCodePrefix("080");
      setName("ساعات جلدية جديدة");
      setForeignName("Leather Watches");
    } else if (activeTab === "auxiliary_groups") {
      setAuxGroupCode("00" + ((auxGroups.length || 0) + 1));
      setName("ساعات رجالي إضافية");
      setForeignName("Men Watches");
    } else if (activeTab === "classifications") {
      setClassificationCode("110" + ((classifications.length || 0) + 1));
      setParentCode("11");
      setName("تصنيف فرعي جديد");
      setForeignName("Sub Classification");
      setIsTransactional(true);
      setDefaultMarkupPct(15.0);
    }
  };

  const handleEditRow = (item: any) => {
    setEditingId(item.id);
    setName(item.name || "");
    setForeignName(item.foreign_name || "");

    if (activeTab === "sub_groups") {
      setMainGroupId(item.main_group_id || 80);
      setMainGroupName(item.main_group_name || "");
      setSubGroupCode(item.sub_group_code || "");
    } else if (activeTab === "sub_sub_groups") {
      setSubGroupId(item.sub_group_id || 1);
      setSubGroupName(item.sub_group_name || "");
      setMainGroupId(item.main_group_id || 80);
      setMainGroupName(item.main_group_name || "");
      setSubSubGroupCode(item.sub_sub_group_code || "");
      setItemCodePrefix(item.item_code_prefix || "");
    } else if (activeTab === "auxiliary_groups") {
      setAuxGroupCode(item.group_code || "");
      setMainGroupId(item.main_group_id || 0);
    } else if (activeTab === "classifications") {
      setClassificationCode(item.classification_code || "");
      setParentCode(item.parent_code || "");
      setIsTransactional(Boolean(item.is_transactional));
      setMainGroupId(item.main_group_id || 1);
      setActivityName(item.activity_name || "");
      setDefaultMarkupPct(item.default_markup_pct || 0);
    }
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name || name.trim() === "") throw new Error("يرجى إدخال اسم المجموعة / التصنيف");

      let endpoint = "";
      let payload: any = {};

      if (activeTab === "sub_groups") {
        endpoint = `/api/item-groups/sub-groups${editingId ? `/${editingId}` : ""}`;
        payload = {
          main_group_id: mainGroupId,
          main_group_name: mainGroupName,
          sub_group_code: subGroupCode,
          name: name.trim(),
          foreign_name: foreignName.trim()
        };
      } else if (activeTab === "sub_sub_groups") {
        endpoint = `/api/item-groups/sub-sub-groups${editingId ? `/${editingId}` : ""}`;
        payload = {
          sub_group_id: subGroupId,
          sub_group_name: subGroupName,
          main_group_id: mainGroupId,
          main_group_name: mainGroupName,
          sub_sub_group_code: subSubGroupCode,
          item_code_prefix: itemCodePrefix,
          name: name.trim(),
          foreign_name: foreignName.trim()
        };
      } else if (activeTab === "auxiliary_groups") {
        endpoint = `/api/item-groups/auxiliary-groups${editingId ? `/${editingId}` : ""}`;
        payload = {
          group_code: auxGroupCode,
          name: name.trim(),
          foreign_name: foreignName.trim(),
          main_group_id: mainGroupId
        };
      } else if (activeTab === "classifications") {
        endpoint = `/api/item-groups/classifications${editingId ? `/${editingId}` : ""}`;
        payload = {
          classification_code: classificationCode,
          parent_code: parentCode,
          name: name.trim(),
          foreign_name: foreignName.trim(),
          is_transactional: isTransactional ? 1 : 0,
          main_group_id: mainGroupId,
          activity_name: activityName,
          default_markup_pct: defaultMarkupPct
        };
      }

      const res = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "فشل الحفظ");
      return resData;
    },
    onSuccess: (resData) => {
      toast({
        title: "تم الحفظ بنجاح ✅",
        description: resData.message || "تم حفظ بيانات التصنيف بنجاح"
      });
      queryClient.invalidateQueries({ queryKey: ["item-sub-groups"] });
      queryClient.invalidateQueries({ queryKey: ["item-sub-sub-groups"] });
      queryClient.invalidateQueries({ queryKey: ["item-auxiliary-groups"] });
      queryClient.invalidateQueries({ queryKey: ["item-classifications"] });
      handleResetForm();
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في الحفظ",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      let endpoint = "";
      if (activeTab === "sub_groups") endpoint = `/api/item-groups/sub-groups/${id}`;
      else if (activeTab === "sub_sub_groups") endpoint = `/api/item-groups/sub-sub-groups/${id}`;
      else if (activeTab === "auxiliary_groups") endpoint = `/api/item-groups/auxiliary-groups/${id}`;
      else if (activeTab === "classifications") endpoint = `/api/item-groups/classifications/${id}`;

      const res = await fetch(endpoint, { method: "DELETE" });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "فشل الحذف");
      return resData;
    },
    onSuccess: () => {
      toast({ title: "تم الحذف 🗑️", description: "تم حذف السجل بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["item-sub-groups"] });
      queryClient.invalidateQueries({ queryKey: ["item-sub-sub-groups"] });
      queryClient.invalidateQueries({ queryKey: ["item-auxiliary-groups"] });
      queryClient.invalidateQueries({ queryKey: ["item-classifications"] });
      handleResetForm();
    },
    onError: (err: any) => {
      toast({ title: "خطأ في الحذف", description: err.message, variant: "destructive" });
    }
  });

  // Fetch Items Link Handler (زر إنزال الأصناف - Images 1, 2, 3)
  const handleFetchItems = async () => {
    setIsLinkingItems(true);
    try {
      const res = await fetch("/api/item-groups/link-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_group: fromGroupNum,
          to_group: toGroupNum,
          from_item: fromItemNum,
          to_item: toItemNum,
          item_type: itemTypeSelect,
          display_mode: displayMode,
          target_level: activeTab
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنزال الأصناف");
      setLinkedItemsGrid(data.data || []);
      toast({
        title: "تم إنزال الأصناف ⚡",
        description: `تم إنزال وربط ${data.count || 0} صنف بنجاح`
      });
    } catch (err: any) {
      toast({ title: "خطأ في إنزال الأصناف", description: err.message, variant: "destructive" });
    } finally {
      setIsLinkingItems(false);
    }
  };

  return (
    <div className="space-y-6 dir-rtl text-right font-sans">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-teal-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-600/30 rounded-2xl border border-teal-400/30 text-teal-300">
              <FolderTree className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">تهيئة المجموعات وتصنيفات الأصناف الهرمية</h1>
                <Badge variant="outline" className="bg-teal-500/20 text-teal-300 border-teal-400/40 px-3 py-1">
                  نظام أومني سيستم برو ERP
                </Badge>
              </div>
              <p className="text-slate-300 text-sm mt-1">
                المجموعات الفرعية، المجموعات تحت الفرعية، المجموعات المساعدة، وتصنيفات شجرة الأصناف (المستويات)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetchSub(); refetchSubSub(); refetchAux(); refetchClass(); }} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              <RefreshCw className="w-4 h-4 ml-2" />
              تحديث البيانات
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              <Printer className="w-4 h-4 ml-2" />
              طباعة التقرير
            </Button>
          </div>
        </div>

        {/* Categories Tab Selector matching 4 Images */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <button
            onClick={() => setActiveTab("sub_groups")}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-right ${
              activeTab === "sub_groups"
                ? "bg-teal-600 text-white border-teal-400 shadow-lg font-bold scale-[1.02]"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-teal-300" />
              <span>1. المجموعات الفرعية</span>
            </div>
            <Badge className="bg-white/20 text-white border-none">{subGroups.length}</Badge>
          </button>

          <button
            onClick={() => setActiveTab("sub_sub_groups")}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-right ${
              activeTab === "sub_sub_groups"
                ? "bg-sky-600 text-white border-sky-400 shadow-lg font-bold scale-[1.02]"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-300" />
              <span>2. تحت الفرعية</span>
            </div>
            <Badge className="bg-white/20 text-white border-none">{subSubGroups.length}</Badge>
          </button>

          <button
            onClick={() => setActiveTab("auxiliary_groups")}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-right ${
              activeTab === "auxiliary_groups"
                ? "bg-amber-600 text-white border-amber-400 shadow-lg font-bold scale-[1.02]"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-300" />
              <span>3. المجموعات المساعدة</span>
            </div>
            <Badge className="bg-white/20 text-white border-none">{auxGroups.length}</Badge>
          </button>

          <button
            onClick={() => setActiveTab("classifications")}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-right ${
              activeTab === "classifications"
                ? "bg-indigo-600 text-white border-indigo-400 shadow-lg font-bold scale-[1.02]"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-300" />
              <span>4. تصنيفات الأصناف (الرتب)</span>
            </div>
            <Badge className="bg-white/20 text-white border-none">{classifications.length}</Badge>
          </button>
        </div>
      </div>

      {/* Educational Image Explanations Box */}
      <Card className="border-teal-200 bg-teal-50/50 dark:bg-slate-900/50 dark:border-teal-900/50">
        <CardContent className="p-4 text-xs leading-relaxed text-teal-950 dark:text-teal-200 space-y-1.5">
          {activeTab === "sub_groups" && (
            <div>
              <strong className="text-sm font-bold text-teal-900 dark:text-teal-300 block mb-1">
                📌 المجموعات الفرعية (Sub Groups - Image 1):
              </strong>
              تستخدم لإدخال وتعريف المجموعات الفرعية للأصناف المربوطة بالمجموعة الرئيسية. يتم إنزال رقم المجموعة الرئيسية واستعراض الأصناف المربوطة عبر F9 أو النقر على زر إنزال الأصناف.
            </div>
          )}

          {activeTab === "sub_sub_groups" && (
            <div>
              <strong className="text-sm font-bold text-sky-900 dark:text-sky-300 block mb-1">
                📌 المجموعات تحت الفرعية (Sub-Sub Groups - Image 2):
              </strong>
              تهدف الشاشة إلى إدخال تصنيفات وتقسيمات فرعية إضافية للمخزون (مستوى ثالث) لتقسيم الأصناف بشكل تحليلي يظهر أثره في تقارير المخزون والمشتريات والمبيعات.
            </div>
          )}

          {activeTab === "auxiliary_groups" && (
            <div>
              <strong className="text-sm font-bold text-amber-900 dark:text-amber-300 block mb-1">
                📌 المجموعات المساعدة (Assistant Groups - Image 3):
              </strong>
              إدخال تصنيفات وتقسيمات مكملة للمجموعات الرئيسية والفرعية وتحت الفرعية (مثل: ساعات رجالي 001، ساعات نسائي 002). يتوفر زر البحث واستعراض المجموعات Assistant Group Modal.
            </div>
          )}

          {activeTab === "classifications" && (
            <div>
              <strong className="text-sm font-bold text-indigo-900 dark:text-indigo-300 block mb-1">
                📌 تصنيفات الأصناف وهرمية الرتب (Item Classifications Tree - Image 4):
              </strong>
              تحليل المخزون إلى مستويات ورتب مع إمكانية تحديد الخيار ☑️ "يتأثر بالعمليات" وتحديد نسبة السعر الافتراضي من التكلفة الأولية لتطبيق معايير شجرة الأصناف.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Screen Form Panel (Light Teal Style Mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Form Inputs Box */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="border-2 border-teal-600/40 bg-[#c2ecee] dark:bg-slate-900 dark:border-teal-800 shadow-md">
            <CardHeader className="bg-teal-700 text-white p-4 rounded-t-lg flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                {activeTab === "sub_groups" && "شاشة المجموعات الفرعية (Sub Groups)"}
                {activeTab === "sub_sub_groups" && "شاشة المجموعات تحت الفرعية (Sub-Sub Groups)"}
                {activeTab === "auxiliary_groups" && "شاشة المجموعات المساعدة (Assistant Groups)"}
                {activeTab === "classifications" && "شاشة تصنيفات الأصناف وهرمية الرتب (Classifications Tree)"}
              </CardTitle>
              {editingId && (
                <Button size="sm" variant="ghost" className="text-white hover:bg-teal-800 text-xs" onClick={handleResetForm}>
                  إلغاء التعديل
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-5 space-y-4 text-slate-900 dark:text-slate-100">
              
              {/* TAB 1: Sub Groups Form (Image 1) */}
              {activeTab === "sub_groups" && (
                <>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">رقم المجموعة الرئيسية:</Label>
                    <div className="col-span-8 flex gap-2">
                      <Input value={mainGroupId} onChange={(e) => setMainGroupId(Number(e.target.value))} className="w-20 bg-amber-50 font-bold text-center" />
                      <Input value={mainGroupName} onChange={(e) => setMainGroupName(e.target.value)} className="bg-amber-50 font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">رقم المجموعة الفرعية:</Label>
                    <div className="col-span-8">
                      <Input value={subGroupCode} onChange={(e) => setSubGroupCode(e.target.value)} className="bg-white font-mono font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">الاسم (مثل: ساعات كاسيو):</Label>
                    <div className="col-span-8">
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white font-semibold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">الاسم الأجنبي:</Label>
                    <div className="col-span-8">
                      <Input value={foreignName} onChange={(e) => setForeignName(e.target.value)} className="bg-white dir-ltr text-left" />
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: Sub-Sub Groups Form (Image 2) */}
              {activeTab === "sub_sub_groups" && (
                <>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">رقم م. الفرعية:</Label>
                    <div className="col-span-8 flex gap-2">
                      <Input value={subGroupId} onChange={(e) => setSubGroupId(Number(e.target.value))} className="w-20 bg-amber-50 font-bold text-center" />
                      <Input value={subGroupName} onChange={(e) => setSubGroupName(e.target.value)} className="bg-amber-50 font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">مجموعة رئيسية:</Label>
                    <div className="col-span-8 flex gap-2">
                      <Input value={mainGroupId} onChange={(e) => setMainGroupId(Number(e.target.value))} className="w-20 bg-amber-50 font-bold text-center" />
                      <Input value={mainGroupName} onChange={(e) => setMainGroupName(e.target.value)} className="bg-amber-50 font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">رقم م. تحت الفرعية:</Label>
                    <div className="col-span-4">
                      <Input value={subSubGroupCode} onChange={(e) => setSubSubGroupCode(e.target.value)} className="bg-white font-mono font-bold" />
                    </div>
                    <Label className="col-span-2 text-xs font-bold text-left pl-1">كود الصنف:</Label>
                    <div className="col-span-2">
                      <Input value={itemCodePrefix} onChange={(e) => setItemCodePrefix(e.target.value)} className="bg-white font-mono text-center" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">الاسم (مثل: ساعات جلدية):</Label>
                    <div className="col-span-8">
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white font-semibold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">الاسم الأجنبي:</Label>
                    <div className="col-span-8">
                      <Input value={foreignName} onChange={(e) => setForeignName(e.target.value)} className="bg-white dir-ltr text-left" />
                    </div>
                  </div>
                </>
              )}

              {/* TAB 3: Auxiliary Groups Form (Image 3) */}
              {activeTab === "auxiliary_groups" && (
                <>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">رقم المجموعة:</Label>
                    <div className="col-span-8 flex gap-2">
                      <Input value={auxGroupCode} onChange={(e) => setAuxGroupCode(e.target.value)} className="bg-white font-mono font-bold" />
                      <Button size="sm" variant="outline" className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-400 font-bold" onClick={() => setShowAuxModal(true)}>
                        🔍 بحث F9
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">الاسم (مثل: ساعات رجالي):</Label>
                    <div className="col-span-8">
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white font-semibold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">الاسم الأجنبي:</Label>
                    <div className="col-span-8">
                      <Input value={foreignName} onChange={(e) => setForeignName(e.target.value)} className="bg-white dir-ltr text-left" />
                    </div>
                  </div>
                </>
              )}

              {/* TAB 4: Classifications Form (Image 4) */}
              {activeTab === "classifications" && (
                <>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">رقم التصنيف:</Label>
                    <div className="col-span-8 flex gap-2">
                      <Input value={classificationCode} onChange={(e) => setClassificationCode(e.target.value)} className="bg-white font-mono font-bold" />
                      <Label className="text-xs font-bold self-center shrink-0">التصنيف الرئيسي:</Label>
                      <Input value={parentCode} onChange={(e) => setParentCode(e.target.value)} className="w-20 bg-amber-50 font-bold text-center" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">اسم التصنيف (كاسيو جلد):</Label>
                    <div className="col-span-8">
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white font-semibold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-4 text-xs font-bold">الاسم الأجنبي:</Label>
                    <div className="col-span-8">
                      <Input value={foreignName} onChange={(e) => setForeignName(e.target.value)} className="bg-white dir-ltr text-left" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-white/60 p-2.5 rounded-lg border border-teal-300">
                    <Checkbox id="is_trans_chk" checked={isTransactional} onCheckedChange={(c) => setIsTransactional(Boolean(c))} />
                    <Label htmlFor="is_trans_chk" className="text-xs font-bold cursor-pointer text-teal-950">
                      ☑️ يتأثر بالعمليات (صنف نهائي مباشر)
                    </Label>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <Label className="col-span-5 text-xs font-bold">نسبة السعر الافتراضي من التكلفة (%):</Label>
                    <div className="col-span-7">
                      <Input type="number" value={defaultMarkupPct} onChange={(e) => setDefaultMarkupPct(Number(e.target.value))} className="bg-white font-bold" />
                    </div>
                  </div>
                </>
              )}

              {/* Items Fetching Section (Images 1, 2, 3 Grid Mapping) */}
              <div className="pt-4 border-t border-teal-400 dark:border-slate-700 space-y-3 bg-white/50 p-3 rounded-lg">
                <Label className="text-xs font-black text-teal-950 block">
                  ⚡ إنزال ونقل الأصناف المربوطة بهذه المجموعة (Items Linking):
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span>من المجموعة:</span>
                    <Input value={fromGroupNum} onChange={(e) => setFromGroupNum(e.target.value)} placeholder="001" className="bg-white h-8" />
                  </div>
                  <div>
                    <span>إلى المجموعة:</span>
                    <Input value={toGroupNum} onChange={(e) => setToGroupNum(e.target.value)} placeholder="080" className="bg-white h-8" />
                  </div>
                  <div>
                    <span>من الصنف:</span>
                    <Input value={fromItemNum} onChange={(e) => setFromItemNum(e.target.value)} placeholder="0800001" className="bg-white h-8" />
                  </div>
                  <div>
                    <span>إلى الصنف:</span>
                    <Input value={toItemNum} onChange={(e) => setToItemNum(e.target.value)} placeholder="0800999" className="bg-white h-8" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Checkbox id="pre_link_chk" checked={fetchPreLinked} onCheckedChange={(c) => setFetchPreLinked(Boolean(c))} />
                    <Label htmlFor="pre_link_chk" className="text-xs font-bold cursor-pointer">
                      إنزال الأصناف المربوطة مسبقاً
                    </Label>
                  </div>
                  <Button size="sm" onClick={handleFetchItems} disabled={isLinkingItems} className="bg-teal-800 text-white font-bold h-8 px-4">
                    {isLinkingItems ? "جاري الإنزال..." : "إنزال الأصناف"}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex justify-end gap-2">
                <Button variant="outline" onClick={handleResetForm} className="bg-white">جديد</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-teal-700 text-white font-bold px-6">
                  {saveMutation.isPending ? "جاري الحفظ..." : "حفظ (F10)"}
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Display Grid & Stored Records */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="shadow-md">
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between bg-slate-50 dark:bg-slate-900">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <List className="w-4 h-4 text-indigo-600" />
                سجل وجداول البيانات المعتمدة
              </CardTitle>
              <Input placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-40 h-8 text-xs bg-white" />
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold border-b">
                  <tr>
                    <th className="p-2.5 text-center">الكود</th>
                    <th className="p-2.5">الاسم العربي</th>
                    <th className="p-2.5">الاسم الأجنبي</th>
                    <th className="p-2.5 text-center">العمليات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeTab === "sub_groups" && subGroups.filter(s => s.name.includes(searchQuery)).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-bold font-mono text-teal-700">{s.sub_group_code}</td>
                      <td className="p-2.5 font-bold">{s.name}</td>
                      <td className="p-2.5 text-slate-500 dir-ltr text-right">{s.foreign_name || "-"}</td>
                      <td className="p-2.5 text-center">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => handleEditRow(s)}><Edit3 className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}

                  {activeTab === "sub_sub_groups" && subSubGroups.filter(ss => ss.name.includes(searchQuery)).map((ss) => (
                    <tr key={ss.id} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-bold font-mono text-sky-700">{ss.sub_sub_group_code}</td>
                      <td className="p-2.5 font-bold">{ss.name}</td>
                      <td className="p-2.5 text-slate-500 dir-ltr text-right">{ss.foreign_name || "-"}</td>
                      <td className="p-2.5 text-center">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => handleEditRow(ss)}><Edit3 className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => deleteMutation.mutate(ss.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}

                  {activeTab === "auxiliary_groups" && auxGroups.filter(a => a.name.includes(searchQuery)).map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-bold font-mono text-amber-700">{a.group_code}</td>
                      <td className="p-2.5 font-bold">{a.name}</td>
                      <td className="p-2.5 text-slate-500 dir-ltr text-right">{a.foreign_name || "-"}</td>
                      <td className="p-2.5 text-center">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => handleEditRow(a)}><Edit3 className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => deleteMutation.mutate(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}

                  {activeTab === "classifications" && classifications.filter(c => c.name.includes(searchQuery)).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-bold font-mono text-indigo-700">{c.classification_code}</td>
                      <td className="p-2.5 font-bold">{c.name}</td>
                      <td className="p-2.5 text-slate-500 dir-ltr text-right">{c.foreign_name || "-"}</td>
                      <td className="p-2.5 text-center">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => handleEditRow(c)}><Edit3 className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Linked Items Grid Result */}
          {linkedItemsGrid.length > 0 && (
            <Card className="border-teal-300">
              <CardHeader className="p-3 bg-teal-50 border-b">
                <CardTitle className="text-xs font-bold text-teal-900">
                  الأصناف المربوطة التي تم إنزالها ({linkedItemsGrid.length} صنف)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-48 overflow-y-auto text-xs">
                <table className="w-full text-right">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      <th className="p-2">رقم الصنف</th>
                      <th className="p-2">اسم الصنف</th>
                      <th className="p-2">السعر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {linkedItemsGrid.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-mono font-bold text-teal-700">{item.number}</td>
                        <td className="p-2">{item.name}</td>
                        <td className="p-2 font-mono">{item.price} ريال</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

      </div>

      {/* Assistant Group Find Modal (Image 3: Assistant Group Find Modal) */}
      <Dialog open={showAuxModal} onOpenChange={setShowAuxModal}>
        <DialogContent className="max-w-md dir-rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-600" />
              المجموعات المساعدة / Assistant Group
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="flex gap-2">
              <Input placeholder="00%" value={auxSearchFilter} onChange={(e) => setAuxSearchFilter(e.target.value)} className="h-8" />
              <Button size="sm" className="bg-amber-600 text-white font-bold h-8">Find</Button>
            </div>

            <div className="border rounded max-h-48 overflow-y-auto">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-100 border-b font-bold">
                  <tr>
                    <th className="p-2 text-center">رقم المجموعة</th>
                    <th className="p-2">اسم المجموعة</th>
                    <th className="p-2">اسم المجموعة بالأجنبي</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {auxGroups.map((group) => (
                    <tr
                      key={group.id}
                      className="hover:bg-amber-50 cursor-pointer"
                      onClick={() => {
                        setAuxGroupCode(group.group_code);
                        setName(group.name);
                        setForeignName(group.foreign_name);
                        setShowAuxModal(false);
                      }}
                    >
                      <td className="p-2 text-center font-mono font-bold">{group.group_code}</td>
                      <td className="p-2 font-bold">{group.name}</td>
                      <td className="p-2 text-slate-500 dir-ltr text-right">{group.foreign_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setShowAuxModal(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

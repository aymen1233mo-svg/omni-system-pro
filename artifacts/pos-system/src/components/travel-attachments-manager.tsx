import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Upload, FileText, Trash2, Eye, Download, Image, File, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface AttachmentsManagerProps {
  entityType: "booking" | "visa" | "passenger" | "customer" | "invoice" | "hotel" | "package" | "procurement";
  entityId: number | string;
  title?: string;
}

export function TravelAttachmentsManager({
  entityType,
  entityId,
  title = "المستندات والمرفقات (File Attachments)"
}: AttachmentsManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedDocCategory, setSelectedDocCategory] = useState("صورة الجواز");
  const [previewFile, setPreviewFile] = useState<any | null>(null);

  const token = sessionStorage.getItem("pos_token") ?? "";

  const { data: attachments = [], isLoading } = useQuery<any[]>({
    queryKey: ["travel-attachments", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/travel/attachments?entity_type=${entityType}&entity_id=${entityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert file to Base64 for SQLite portable storage
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setUploading(true);
      try {
        const res = await fetch("/api/travel/attachments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            file_data: base64Data,
            category: selectedDocCategory
          })
        });

        if (res.ok) {
          toast({ title: "تم رفع وتخزين المستند بنجاح" });
          queryClient.invalidateQueries({ queryKey: ["travel-attachments", entityType, entityId] });
        } else {
          toast({ title: "خطأ في الرفع", variant: "destructive" });
        }
      } catch (err: any) {
        toast({ title: "خطأ", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المرفق؟")) return;
    try {
      const res = await fetch(`/api/travel/attachments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast({ title: "تم حذف المرفق" });
        queryClient.invalidateQueries({ queryKey: ["travel-attachments", entityType, entityId] });
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Paperclip className="w-4 h-4 text-primary" />
            {title} ({attachments.length})
          </h4>
          <p className="text-[11px] text-slate-500">حفظ وأرشفة صور الجوازات، التأشيرات، التذاكر، والإيصالات</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedDocCategory}
            onChange={(e) => setSelectedDocCategory(e.target.value)}
            className="text-xs border rounded-lg px-2.5 py-1 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="صورة الجواز">صورة الجواز</option>
            <option value="ملف التأشيرة">ملف التأشيرة</option>
            <option value="تذكرة إلكترونية PDF">تذكرة إلكترونية PDF</option>
            <option value="قسيمة فندق Voucher">قسيمة فندق Voucher</option>
            <option value="فاتورة المورد">فاتورة المورد</option>
            <option value="سند إيداع / إيصال">سند إيداع / إيصال</option>
            <option value="مستند عام">مستند عام</option>
          </select>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,application/pdf"
          />

          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs h-8 gap-1.5 bg-primary text-white hover:bg-primary/90"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "جاري الرفع..." : "إرفاق مستند جديد"}
          </Button>
        </div>
      </div>

      {/* Attachments List */}
      {isLoading ? (
        <div className="text-center py-6 text-xs text-muted-foreground animate-pulse">
          جاري تحميل المرفقات...
        </div>
      ) : attachments.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center text-slate-400 bg-slate-50/50">
          <Paperclip className="w-6 h-6 mx-auto text-slate-300 mb-1" />
          <p className="text-xs">لا توجد ملفات مرفقة حتى الآن</p>
          <p className="text-[10px] text-slate-400 mt-0.5">يمكنك إرفاق صور الجوازات والتذاكر مباشرة وحفظها بالسجل</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((file) => {
            const isImage = file.file_type?.startsWith("image/");
            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="p-2 bg-white rounded border text-primary shrink-0">
                    {isImage ? <Image className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate" title={file.file_name}>
                      {file.file_name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded font-medium">
                        {file.category || "مستند"}
                      </span>
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>{file.created_at?.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {file.file_data && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-600 hover:text-primary"
                      onClick={() => setPreviewFile(file)}
                      title="معاينة"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {file.file_data && (
                    <a
                      href={file.file_data}
                      download={file.file_name}
                      className="inline-flex items-center justify-center h-7 w-7 text-slate-600 hover:text-primary rounded hover:bg-slate-200/50"
                      title="تحميل"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(file.id)}
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      {previewFile && (
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent dir="rtl" className="max-w-2xl p-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center justify-between">
                <span>{previewFile.file_name}</span>
                <span className="text-xs text-slate-500 font-normal">{previewFile.category}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 flex justify-center max-h-[70vh] overflow-auto">
              {previewFile.file_type?.startsWith("image/") ? (
                <img src={previewFile.file_data} alt={previewFile.file_name} className="max-h-[65vh] object-contain rounded" />
              ) : (
                <iframe src={previewFile.file_data} className="w-full h-[65vh] border rounded" title={previewFile.file_name} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

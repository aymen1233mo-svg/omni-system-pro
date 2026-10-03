import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "اختر من القائمة...",
  searchPlaceholder = "ابحث بالاسم، الرقم، الهوية...",
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = options.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const matchLabel = opt.label?.toLowerCase().includes(query);
    const matchSublabel = opt.sublabel?.toLowerCase().includes(query);
    const matchBadge = opt.badge?.toLowerCase().includes(query);
    return matchLabel || matchSublabel || matchBadge;
  });

  return (
    <div className={cn("relative w-full text-right", className)} ref={containerRef} dir="rtl">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !selectedOption && "text-muted-foreground font-normal"
        )}
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-slate-900 dark:text-slate-100">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-[11px] text-muted-foreground">({selectedOption.sublabel})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ms-1" />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-[120] mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg outline-none animate-in fade-in-80 zoom-in-95 overflow-hidden">
          {/* Search Box */}
          <div className="p-2 border-b bg-muted/40 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-muted-foreground hover:text-foreground text-xs p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/30 text-xs">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "w-full text-right px-2.5 py-2 rounded-sm flex items-center justify-between gap-2 transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer",
                      isSelected && "bg-amber-500/10 text-amber-900 font-bold dark:bg-amber-400/20 dark:text-amber-200"
                    )}
                  >
                    <div className="flex flex-col gap-0.5 truncate text-right">
                      <span className="font-bold truncate text-slate-900 dark:text-slate-100">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-muted-foreground text-xs font-medium">
                لا توجد نتائج تطابق "{searchQuery}"
              </div>
            )}
          </div>

          {/* Footer stats */}
          <div className="bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground border-t flex justify-between items-center">
            <span>النتائج: {filteredOptions.length} من {options.length}</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-amber-600 hover:underline font-bold"
              >
                إلغاء البحث
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

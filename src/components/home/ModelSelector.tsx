"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Feather, Sparkles, Zap } from "lucide-react";
import { modelOptions } from "@/lib/data";
import { cn } from "@/lib/utils";

const modelIcons: Record<string, typeof Sparkles> = {
  "nexora-pro": Sparkles,
  "nexora-1": Zap,
  "nexora-lite": Feather,
};

interface ModelSelectorProps {
  value: string;
  onChange: (id: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = modelOptions.find((m) => m.id === value) ?? modelOptions[0];
  const SelectedIcon = modelIcons[selected.id] ?? Sparkles;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition-all duration-200",
          open
            ? "border-[#B69AEF] bg-white shadow-card ring-4 ring-[#EDE5FC]/60"
            : "border-[#EAE5F3] bg-white/80 shadow-soft hover:border-[#B69AEF] hover:bg-white",
        )}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EDE5FC] text-[#8054D9]">
          <SelectedIcon className="h-4 w-4" />
        </span>
        <span className="hidden text-[#242033] sm:inline">{selected.name}</span>
        <span className="text-[#242033] sm:hidden">Nexora</span>
        <ChevronDown
          className={cn("h-4 w-4 text-[#6F6A80] transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute left-0 z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#EAE5F3] bg-white p-1.5 shadow-lift"
          >
            <li className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-[0.14em] text-[#6F6A80]/80 uppercase">
              Choose a model
            </li>
            {modelOptions.map((model) => {
              const Icon = modelIcons[model.id] ?? Sparkles;
              const active = model.id === value;
              return (
                <li key={model.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(model.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      active ? "bg-[#EDE5FC]/70" : "hover:bg-[#F5F1FE]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                        active ? "bg-[#8054D9] text-white" : "bg-[#EDE5FC] text-[#8054D9]",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-[#242033]">
                        {model.name}
                        {model.badge && (
                          <span className="rounded-full bg-[#8054D9] px-2 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">
                            {model.badge}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs leading-relaxed text-[#6F6A80]">
                        {model.tagline}
                      </span>
                    </span>
                    {active && <Check className="mt-1 h-4 w-4 shrink-0 text-[#8054D9]" />}
                  </button>
                </li>
              );
            })}
            <li className="border-t border-[#EAE5F3] px-3 py-2 text-[11px] leading-relaxed text-[#6F6A80]">
              Model choice is saved locally in this Phase 1 preview.
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

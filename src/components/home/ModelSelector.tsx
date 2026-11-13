"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Feather,
  Loader2,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { fetchModels } from "@/lib/api/chat-client";
import type { ModelInfo, ProviderId } from "@/types/ai";
import { cn } from "@/lib/utils";

const providerIcons: Record<ProviderId, typeof Sparkles> = {
  openai: Sparkles,
  gemini: Zap,
  anthropic: Feather,
};

const providerLabels: Record<ProviderId, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  anthropic: "Anthropic Claude",
};

type LoadState = "loading" | "ready" | "error";

interface ModelSelectorProps {
  value: string;
  onChange: (id: string) => void;
  /** Called once the real model list has loaded (also on retry). */
  onModelsLoaded?: (models: ModelInfo[]) => void;
}

/**
 * Model selector, wired to the real `GET /api/v1/models` (Phase 2.5).
 *
 * The Phase 1 display models ("Nexora 1.0 Pro" / "Nexora 1.0" /
 * "Nexora Lite") were UI labels only and are gone: the dropdown lists
 * only the registry models returned by the API, each with its live
 * status. While loading, the button is disabled; on failure it offers a
 * retry and never falls back to a fake list.
 */
export function ModelSelector({ value, onChange, onModelsLoaded }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [retryTick, setRetryTick] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selected = models.find((m) => m.id === value);
  const SelectedIcon = selected ? providerIcons[selected.provider] : Sparkles;

  // Fetch the real model list on mount (and on retry). State updates happen
  // only inside the promise callbacks, never synchronously in the effect.
  useEffect(() => {
    let cancelled = false;
    fetchModels()
      .then((list) => {
        if (cancelled) return;
        setModels(list);
        setLoadState("ready");
        onModelsLoaded?.(list);
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [onModelsLoaded, retryTick]);

  const retry = () => {
    setLoadState("loading");
    setRetryTick((tick) => tick + 1);
  };

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

  if (loadState === "loading") {
    return (
      <button
        disabled
        aria-label="Loading models"
        className="flex cursor-wait items-center gap-2 rounded-2xl border border-[#EAE5F3] bg-white/80 px-3 py-2 text-sm font-semibold text-[#6F6A80] shadow-soft"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EDE5FC] text-[#8054D9]">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
        <span className="hidden sm:inline">Loading models…</span>
        <span className="sm:hidden">Nexora</span>
      </button>
    );
  }

  if (loadState === "error") {
    return (
      <button
        onClick={retry}
        aria-label="Couldn't load models — retry"
        title="Couldn't load models — click to retry"
        className="flex cursor-pointer items-center gap-2 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm font-semibold text-[#B91C1C] shadow-soft transition-colors hover:bg-[#FEE2E2]"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#FEE2E2] text-[#B91C1C]">
          <RotateCcw className="h-4 w-4" />
        </span>
        <span className="hidden sm:inline">Couldn&apos;t load models</span>
        <span className="sm:hidden">Retry</span>
      </button>
    );
  }

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
        <span className="hidden text-[#242033] sm:inline">
          {selected?.name ?? "Choose a model"}
        </span>
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
            {models.map((model) => {
              const Icon = providerIcons[model.provider];
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
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#242033]">
                        {model.name}
                        {model.status === "not_configured" && (
                          <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[9px] font-bold tracking-wide text-[#92400E] uppercase">
                            Not configured
                          </span>
                        )}
                        {model.status === "available" && (
                          <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[9px] font-bold tracking-wide text-[#166534] uppercase">
                            Available
                          </span>
                        )}
                        {model.status === "not_implemented" && (
                          <span className="rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[9px] font-bold tracking-wide text-[#7E22CE] uppercase">
                            Not implemented
                          </span>
                        )}
                        {model.status === "disabled" && (
                          <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[9px] font-bold tracking-wide text-[#475569] uppercase">
                            Disabled
                          </span>
                        )}
                      </span>
                      <span className="block text-xs leading-relaxed text-[#6F6A80]">
                        {providerLabels[model.provider]} · {model.description}
                      </span>
                    </span>
                    {active && <Check className="mt-1 h-4 w-4 shrink-0 text-[#8054D9]" />}
                  </button>
                </li>
              );
            })}
            <li className="border-t border-[#EAE5F3] px-3 py-2 text-[11px] leading-relaxed text-[#6F6A80]">
              Models load live from /api/v1/models — statuses reflect real
              configuration. No provider is configured yet.
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

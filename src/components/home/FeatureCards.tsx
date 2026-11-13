"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { featureCards, type FeatureMode } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface FeatureCardsProps {
  activeMode: FeatureMode;
  onSelect: (mode: FeatureMode) => void;
}

/**
 * Three feature cards. Selecting one changes the prompt placeholder and
 * highlights the card — it does not claim the feature works end-to-end
 * in Phase 1 (each card carries a "Phase 2" badge).
 */
export function FeatureCards({ activeMode, onSelect }: FeatureCardsProps) {
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {featureCards.map((card, index) => {
        const Icon = card.icon;
        const active = activeMode === card.id;
        return (
          <motion.article
            key={card.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 + index * 0.09, ease: "easeOut" }}
            whileHover={{ y: -5 }}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-3xl border bg-white p-5 text-left shadow-soft transition-all duration-300 hover:shadow-lift",
              active
                ? "border-[#8054D9] ring-4 ring-[#EDE5FC]/70"
                : "border-[#EAE5F3] hover:border-[#B69AEF]",
            )}
          >
            {/* Gradient wash */}
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r opacity-90",
                card.gradient,
              )}
            />
            <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-[#EDE5FC]/60 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

            <div className="relative flex items-start justify-between">
              <span
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3",
                  card.iconBg,
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={1.9} />
              </span>
              <Badge variant="soft">Phase 2</Badge>
            </div>

            <h3 className="relative mt-4 text-[17px] font-bold tracking-tight text-[#242033]">
              {card.title}
            </h3>
            <p className="relative mt-1.5 flex-1 text-sm leading-relaxed text-[#6F6A80]">
              {card.description}
            </p>

            <button
              onClick={() => onSelect(card.id)}
              className={cn(
                "relative mt-5 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98]",
                active
                  ? "bg-gradient-to-r from-[#8054D9] to-[#9D7BE8] text-white shadow-[0_10px_24px_rgb(128_84_217/0.35)]"
                  : "bg-[#F5F1FE] text-[#6A3FC4] hover:bg-[#EDE5FC]",
              )}
            >
              {active ? "Selected — try the prompt below" : card.buttonLabel}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </motion.article>
        );
      })}
    </div>
  );
}

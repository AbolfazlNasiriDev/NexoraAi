"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * Shared auth card (Phase 3.1) — the same visual language as the home
 * page: white glass card, lavender accents, the Nexora purple gradient
 * and the Sidebar's logo mark (a static gradient box, not a rebuilt
 * animated orb). Light theme only. Every /auth/* page renders inside
 * this card so sign-in, sign-up and password recovery look like one
 * product, not four.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md rounded-3xl border border-[#EAE5F3] bg-white/90 p-6 shadow-card backdrop-blur sm:p-8"
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#8054D9] via-[#9D7BE8] to-[#B69AEF] shadow-[0_10px_24px_rgb(128_84_217/0.4)]">
          <Sparkles className="h-6 w-6 text-white" strokeWidth={2.2} />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-white/40 blur-[2px]" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-[#242033]">
          {title}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[#6F6A80]">
          {subtitle}
        </p>
      </div>

      <div className="mt-7">{children}</div>

      {footer ? (
        <div className="mt-6 border-t border-[#EAE5F3] pt-5 text-center text-sm text-[#6F6A80]">
          {footer}
        </div>
      ) : null}
    </motion.div>
  );
}

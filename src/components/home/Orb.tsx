"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * The floating Nexora orb — layered radial gradients, a soft halo,
 * a slowly rotating conic ring and drifting sparkles.
 * Purely visual; no canvas, no dark backgrounds.
 */
export function Orb({ compact = false }: { compact?: boolean }) {
  const size = compact ? "h-24 w-24" : "h-36 w-36 sm:h-44 sm:w-44";
  return (
    <div className="relative grid place-items-center" aria-hidden="true">
      {/* Halo */}
      <div
        className={`absolute rounded-full bg-[#B69AEF]/40 blur-3xl ${
          compact ? "h-32 w-32" : "h-56 w-56 sm:h-72 sm:w-72"
        }`}
      />
      <div className="absolute h-40 w-40 rounded-full bg-[#EDE5FC]/70 blur-2xl sm:h-52 sm:w-52" />

      {/* Rotating conic ring */}
      <div className="orb-ring absolute animate-spin-slow rounded-full opacity-70 blur-[1px] [mask-image:radial-gradient(circle,transparent_58%,black_60%,black_66%,transparent_68%)] h-44 w-44 sm:h-56 sm:w-56" />

      {/* Floating core */}
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className={`orb-core relative rounded-full shadow-glow ${size}`}
      >
        <span className="absolute top-[18%] left-[22%] h-6 w-10 rotate-[-18deg] rounded-full bg-white/70 blur-[6px]" />
        <span className="absolute right-[20%] bottom-[22%] h-8 w-8 rounded-full bg-white/25 blur-md" />
      </motion.div>

      {/* Drifting sparkles */}
      <motion.span
        animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-white text-[#8054D9] shadow-card sm:right-6"
      >
        <Sparkles className="h-4 w-4" />
      </motion.span>
      <motion.span
        animate={{ y: [0, 8, 0], opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        className="absolute -bottom-1 left-1 h-3 w-3 rounded-full bg-[#B69AEF] shadow-glow sm:left-4"
      />
      <motion.span
        animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
        className="absolute top-6 -left-2 h-2 w-2 rounded-full bg-[#8054D9] sm:-left-4"
      />
    </div>
  );
}

"use client";

import { Crown, Plus, Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { navSections, type FeatureMode, type NavId } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeNav: NavId;
  onSelectNav: (id: NavId) => void;
  onNewChat: () => void;
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#8054D9] via-[#9D7BE8] to-[#B69AEF] shadow-[0_10px_24px_rgb(128_84_217/0.4)]">
        <Sparkles className="h-5 w-5 text-white" strokeWidth={2.2} />
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-white/40 blur-[2px]" />
      </div>
      <div className="leading-tight">
        <p className="text-[19px] font-bold tracking-tight text-[#242033]">
          Nexora <span className="text-gradient">AI</span>
        </p>
        <p className="text-[11px] font-medium tracking-wide text-[#6F6A80]">
          Premium AI Platform
        </p>
      </div>
    </div>
  );
}

export function Sidebar({ open, onClose, activeNav, onSelectNav, onNewChat }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <button
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-30 cursor-pointer bg-[#242033]/25 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <motion.aside
        initial={false}
        animate={{ x: open ? 0 : 0 }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-[#EAE5F3] bg-white transition-transform duration-300 ease-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Logo />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl text-[#6F6A80] transition-colors hover:bg-[#F5F1FE] hover:text-[#242033] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* New Chat */}
        <div className="px-4">
          <Button
            onClick={onNewChat}
            size="lg"
            className="w-full justify-start px-4 font-semibold"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            New Chat
            <kbd className="ml-auto rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">
              ⌘ N
            </kbd>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="mt-5 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-2 pb-2 text-[10px] font-bold tracking-[0.14em] text-[#6F6A80]/80 uppercase">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeNav === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          onSelectNav(item.id);
                          onClose();
                        }}
                        className={cn(
                          "group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-[#EDE5FC] text-[#6A3FC4] shadow-[inset_0_0_0_1px_rgb(128_84_217/0.12)]"
                            : "text-[#6F6A80] hover:bg-[#F5F1FE] hover:text-[#242033]",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110",
                            active ? "text-[#8054D9]" : "text-[#6F6A80]/80",
                          )}
                          strokeWidth={2}
                        />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge && (
                          <Badge variant="soft" className="px-1.5 py-0 text-[9px]">
                            {item.badge}
                          </Badge>
                        )}
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#8054D9]" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Upgrade card */}
        <div className="px-4 pb-3">
          <div className="relative overflow-hidden rounded-2xl border border-[#EAE5F3] bg-gradient-to-br from-[#EDE5FC] via-[#F5F1FE] to-white p-4 shadow-soft">
            <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-[#B69AEF]/30 blur-xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#8054D9] to-[#B69AEF] text-white shadow-[0_6px_16px_rgb(128_84_217/0.35)]">
                  <Crown className="h-4 w-4" />
                </span>
                <p className="text-sm font-bold text-[#242033]">Upgrade to Premium</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#6F6A80]">
                Unlock Nexora Pro, unlimited images and priority speed.
              </p>
              <Button size="sm" className="mt-3 w-full font-semibold">
                Go Premium
              </Button>
            </div>
          </div>
        </div>

        {/* Profile footer */}
        <div className="flex items-center gap-3 border-t border-[#EAE5F3] px-5 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8054D9] to-[#B69AEF] text-xs font-bold text-white">
            AN
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-[#242033]">
              Abolfazl Nasiri
            </p>
            <p className="text-xs text-[#6F6A80]">Free plan</p>
          </div>
          <Badge variant="outline">Phase 1</Badge>
        </div>
      </motion.aside>
    </>
  );
}

// Re-exported so page.tsx can map nav ids to feature modes in one place.
export type { FeatureMode };

"use client";

import { Menu, Download, SlidersHorizontal } from "lucide-react";
import { ModelSelector } from "@/components/home/ModelSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  model: string;
  onModelChange: (id: string) => void;
  onOpenSidebar: () => void;
}

export function TopBar({ model, onModelChange, onOpenSidebar }: TopBarProps) {
  return (
    <header className="glass sticky top-0 z-20 border-b border-[#EAE5F3]/80">
      <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <button
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-[#EAE5F3] bg-white text-[#242033] shadow-soft transition-colors hover:bg-[#F5F1FE] lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <ModelSelector value={model} onChange={onModelChange} />

        <Badge variant="lavender" className="hidden md:inline-flex">
          Phase 1 · Frontend
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="md" className="hidden sm:inline-flex">
            <SlidersHorizontal className="h-4 w-4" />
            Configuration
          </Button>
          <Button variant="outline" size="icon" aria-label="Configuration" className="sm:hidden">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="md" className="hidden sm:inline-flex">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="secondary" size="icon" aria-label="Export" className="sm:hidden">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

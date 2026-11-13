"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Orb } from "@/components/home/Orb";
import { PromptInput } from "@/components/home/PromptInput";
import { FeatureCards } from "@/components/home/FeatureCards";
import { ChatMessages } from "@/components/home/ChatMessages";
import {
  modelOptions,
  placeholderFor,
  type ChatMessage,
  type FeatureMode,
  type NavId,
} from "@/lib/data";
import { Badge } from "@/components/ui/badge";

const navToMode: Partial<Record<NavId, FeatureMode>> = {
  "image-generator": "image",
  presentation: "presentation",
};

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>("chat");
  const [model, setModel] = useState("nexora-pro");
  const [mode, setMode] = useState<FeatureMode>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const modelName =
    modelOptions.find((m) => m.id === model)?.name ?? "Nexora 1.0 Pro";
  const placeholder = useMemo(() => placeholderFor(mode), [mode]);
  const hasMessages = messages.length > 0;

  const handleSelectNav = useCallback((id: NavId) => {
    setActiveNav(id);
    const mapped = navToMode[id];
    if (mapped) setMode(mapped);
    else if (id === "chat" || id === "new-project") setMode("chat");
  }, []);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setMode("chat");
    setActiveNav("chat");
    setSidebarOpen(false);
  }, []);

  const handleSend = useCallback(
    (text: string, file?: { name: string; size: number }) => {
      const next: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: text || (file ? `Attached: ${file.name}` : ""),
        fileName: file?.name,
        fileSize: file?.size,
        model: modelName,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, next]);
    },
    [modelName],
  );

  return (
    <div className="page-glow min-h-screen bg-nexora-bg text-nexora-text">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeNav={activeNav}
        onSelectNav={handleSelectNav}
        onNewChat={handleNewChat}
      />

      <div className="flex min-h-screen flex-col lg:pl-[280px]">
        <TopBar
          model={model}
          onModelChange={setModel}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex flex-1 flex-col">
          <AnimatePresence mode="wait">
            {!hasMessages ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pt-10 pb-8 sm:px-6 sm:pt-14"
              >
                <Orb />

                <div className="mt-8 flex flex-col items-center text-center sm:mt-10">
                  <Badge variant="lavender" className="mb-4 px-3 py-1 text-xs">
                    ✨ Your premium AI workspace
                  </Badge>
                  <motion.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.08 }}
                    className="text-4xl leading-[1.1] font-bold tracking-tight text-[#242033] sm:text-5xl"
                  >
                    Welcome to <span className="text-gradient">Nexora AI</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.16 }}
                    className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#6F6A80] sm:text-base"
                  >
                    One prompt away from writing, images, presentations and
                    code — beautifully organised in a single light, calm
                    workspace built for deep work.
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.24 }}
                  className="mt-8 w-full max-w-3xl sm:mt-10"
                >
                  <PromptInput
                    placeholder={placeholder}
                    modelName={modelName}
                    onSend={handleSend}
                  />
                </motion.div>

                <div className="mt-8 w-full max-w-3xl sm:mt-10">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-[#EAE5F3]" />
                    <p className="text-[11px] font-bold tracking-[0.14em] text-[#6F6A80] uppercase">
                      Start with a feature
                    </p>
                    <span className="h-px flex-1 bg-[#EAE5F3]" />
                  </div>
                  <FeatureCards activeMode={mode} onSelect={setMode} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-between gap-8 px-0 pt-8 pb-8 sm:pt-10"
              >
                <div className="flex items-center gap-3 px-4 sm:px-6">
                  <Orb compact />
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[#242033]">
                      New conversation
                    </h2>
                    <p className="text-sm text-[#6F6A80]">
                      {modelName} · {messages.length} message
                      {messages.length === 1 ? "" : "s"} · saved locally
                    </p>
                  </div>
                </div>

                <ChatMessages messages={messages} />

                <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
                  <PromptInput
                    placeholder={placeholder}
                    modelName={modelName}
                    onSend={handleSend}
                  />
                  <div className="mt-6">
                    <FeatureCards activeMode={mode} onSelect={setMode} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="border-t border-[#EAE5F3]/70 px-6 py-4 text-center text-[11px] text-[#6F6A80]">
          Nexora AI · Phase 1 — frontend only. No data leaves your browser
          yet.
        </footer>
      </div>
    </div>
  );
}

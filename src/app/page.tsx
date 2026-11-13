"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Orb } from "@/components/home/Orb";
import { PromptInput } from "@/components/home/PromptInput";
import { FeatureCards } from "@/components/home/FeatureCards";
import { ChatMessages } from "@/components/home/ChatMessages";
import { placeholderFor, type FeatureMode, type NavId } from "@/lib/data";
import {
  ApiClientError,
  isProviderNotConfiguredError,
  sendChatMessage,
} from "@/lib/api/chat-client";
import type { ModelInfo } from "@/types/ai";
import type { Conversation, UiMessage } from "@/types/conversation";
import { Badge } from "@/components/ui/badge";

const navToMode: Partial<Record<NavId, FeatureMode>> = {
  "image-generator": "image",
  presentation: "presentation",
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Home workspace (Phase 2.5). Layout, sidebar, orb, hero, composer
 * placement and feature cards are unchanged from Phase 1 — only the
 * send flow is wired to the real API:
 *
 * send -> user message + "loading" indicator -> POST /api/v1/chat
 *   -> on success: the REAL assistant reply (unreachable today — no
 *      provider is configured, so every valid request returns 503)
 *   -> on error: the "loading" indicator is replaced by a distinct
 *      system-error message carrying the API error code/message.
 * Attached files are text-only in 2.5: they are shown on the user
 * bubble but are NOT sent to the API.
 */
export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>("chat");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [conversation, setConversation] = useState<Conversation>({
    id: null,
    modelId: "",
    messages: [],
  });
  const [mode, setMode] = useState<FeatureMode>("chat");
  const [isSending, setIsSending] = useState(false);

  const messages = conversation.messages;
  const modelId = conversation.modelId;
  const modelName =
    models.find((m) => m.id === modelId)?.name ??
    (modelId ? modelId : "Loading models…");
  const placeholder = useMemo(() => placeholderFor(mode), [mode]);
  const hasMessages = messages.length > 0;

  const handleModelsLoaded = useCallback((list: ModelInfo[]) => {
    setModels(list);
    setConversation((prev) => {
      if (prev.modelId && list.some((m) => m.id === prev.modelId)) return prev;
      return { ...prev, modelId: list[0]?.id ?? "" };
    });
  }, []);

  const handleSelectNav = useCallback((id: NavId) => {
    setActiveNav(id);
    const mapped = navToMode[id];
    if (mapped) setMode(mapped);
    else if (id === "chat" || id === "new-project") setMode("chat");
  }, []);

  const handleNewChat = useCallback(() => {
    setConversation((prev) => ({ id: null, modelId: prev.modelId, messages: [] }));
    setMode("chat");
    setActiveNav("chat");
    setSidebarOpen(false);
  }, []);

  const handleSend = useCallback(
    async (text: string, file?: { name: string; size: number }) => {
      if (isSending) return;
      const trimmed = text.trim();
      const userMessage: UiMessage = {
        id: newId("msg"),
        kind: "user",
        content: trimmed || (file ? `Attached: ${file.name}` : ""),
        ...(file ? { fileName: file.name, fileSize: file.size } : {}),
        modelName,
        createdAt: Date.now(),
      };

      // Files are not sent to the API in 2.5 (text only): a file with no
      // text has nothing to send, so say so instead of calling the API.
      if (!trimmed) {
        const errorMessage: UiMessage = {
          id: newId("msg"),
          kind: "error",
          content:
            "Files aren't sent to the API yet — add a text message with your question.",
          errorCode: "FILE_NOT_SUPPORTED",
        };
        setConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, userMessage, errorMessage],
        }));
        return;
      }

      if (!modelId) {
        const errorMessage: UiMessage = {
          id: newId("msg"),
          kind: "error",
          content:
            "Models are still loading — please wait a moment and try again.",
          errorCode: "MODELS_LOADING",
        };
        setConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, userMessage, errorMessage],
        }));
        return;
      }

      const loadingId = newId("msg");
      const loadingMessage: UiMessage = {
        id: loadingId,
        kind: "loading",
        content: "",
      };
      const apiMessages = [...messages, userMessage]
        .filter((m) => m.kind === "user" || m.kind === "assistant")
        .map((m) => ({
          role: (m.kind === "assistant" ? "assistant" : "user") as
            | "assistant"
            | "user",
          content: m.content,
        }));
      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage, loadingMessage],
      }));
      setIsSending(true);
      try {
        const data = await sendChatMessage({
          conversationId: conversation.id,
          modelId,
          messages: apiMessages,
        });
        // Reachable only once a real provider answers. Today every valid
        // request returns 503, so this branch never runs with fake data.
        const assistantMessage: UiMessage = {
          id: newId("msg"),
          kind: "assistant",
          content: data.message.content,
          modelName: data.modelId,
          createdAt: Date.now(),
        };
        setConversation((prev) => ({
          ...prev,
          id: data.conversationId,
          messages: [
            ...prev.messages.filter((m) => m.id !== loadingId),
            assistantMessage,
          ],
        }));
      } catch (error) {
        const apiError =
          error instanceof ApiClientError
            ? error
            : new ApiClientError(
                0,
                "UNKNOWN_ERROR",
                "Something went wrong. Please try again.",
              );
        const errorMessage: UiMessage = {
          id: newId("msg"),
          kind: "error",
          content: isProviderNotConfiguredError(apiError)
            ? "AI provider is not configured yet."
            : apiError.message,
          errorCode: apiError.code,
        };
        setConversation((prev) => ({
          ...prev,
          messages: [
            ...prev.messages.filter((m) => m.id !== loadingId),
            errorMessage,
          ],
        }));
      } finally {
        setIsSending(false);
      }
    },
    [conversation, isSending, messages, modelId, modelName],
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
          model={modelId}
          onModelChange={(id) =>
            setConversation((prev) => ({ ...prev, modelId: id }))
          }
          onOpenSidebar={() => setSidebarOpen(true)}
          onModelsLoaded={handleModelsLoaded}
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
                    isSending={isSending}
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
                      {messages.length === 1 ? "" : "s"} · via /api/v1/chat
                    </p>
                  </div>
                </div>

                <ChatMessages messages={messages} />

                <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
                  <PromptInput
                    placeholder={placeholder}
                    modelName={modelName}
                    onSend={handleSend}
                    isSending={isSending}
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
          Nexora AI · Phase 2 — messages go through /api/v1/chat. The AI
          provider is not configured yet, so nothing is answered.
        </footer>
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, FileText, Info, Sparkles } from "lucide-react";
import type { UiMessage } from "@/types/conversation";
import { formatFileSize } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ChatMessagesProps {
  messages: UiMessage[];
}

/**
 * Chat thread (Phase 2.5). Each message kind renders distinctly, same
 * light theme:
 * - "user": the existing right-aligned bubble with model badge + time.
 * - "assistant": a real provider reply — only ever rendered from a real
 *   `POST /api/v1/chat` success. Nothing in Phase 2.5 creates one.
 * - "loading": three animated dots + "Nexora is thinking…".
 * - "error": a visibly different system-error bubble (rose tint,
 *   AlertTriangle) carrying the API error — never an assistant reply.
 * The note below each thread says plainly that messages now go through
 * `/api/v1/chat` and the provider is not configured yet.
 */
export function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 sm:px-6">
      <AnimatePresence initial={false}>
        {messages.map((message) => {
          if (message.kind === "loading") {
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-center gap-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8054D9] to-[#B69AEF] text-white shadow-soft">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-3 rounded-3xl rounded-bl-lg border border-[#EAE5F3] bg-white px-5 py-4 shadow-card">
                  <span className="flex items-center gap-1.5" aria-label="Nexora is thinking">
                    {[0, 1, 2].map((dot) => (
                      <motion.span
                        key={dot}
                        className="h-2 w-2 rounded-full bg-[#8054D9]"
                        animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                        transition={{
                          duration: 0.9,
                          repeat: Infinity,
                          delay: dot * 0.15,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </span>
                  <span className="text-sm font-medium text-[#6F6A80]">
                    Nexora is thinking…
                  </span>
                </div>
              </motion.div>
            );
          }

          if (message.kind === "error") {
            const isNotConfigured =
              message.errorCode === "PROVIDER_NOT_CONFIGURED";
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-start gap-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3.5 shadow-soft"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#DC2626]" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#991B1B]">
                    {isNotConfigured
                      ? "Provider not configured"
                      : "Something went wrong"}
                    {message.errorCode && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#B91C1C]">
                        {message.errorCode}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#7F1D1D]">
                    {message.content}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#991B1B]/80">
                    Your message was kept — nothing was answered.
                  </p>
                </div>
              </motion.div>
            );
          }

          if (message.kind === "assistant") {
            return (
              <motion.article
                key={message.id}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-start gap-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8054D9] to-[#B69AEF] text-white shadow-soft">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="max-w-[88%] rounded-3xl rounded-bl-lg border border-[#EAE5F3] bg-white px-5 py-4 shadow-card sm:max-w-[80%]">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge variant="lavender">Nexora</Badge>
                    {message.modelName && (
                      <span className="text-[11px] font-medium text-[#6F6A80]">
                        {message.modelName}
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[#242033]">
                    {message.content}
                  </p>
                </div>
              </motion.article>
            );
          }

          // kind === "user"
          return (
            <motion.article
              key={message.id}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col items-end"
            >
              <div className="max-w-[88%] rounded-3xl rounded-br-lg border border-[#EAE5F3] bg-white px-5 py-4 shadow-card sm:max-w-[80%]">
                <div className="mb-1.5 flex items-center justify-end gap-2">
                  {message.modelName && (
                    <Badge variant="lavender">{message.modelName}</Badge>
                  )}
                  {typeof message.createdAt === "number" && (
                    <span className="text-[11px] font-medium text-[#6F6A80]">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[#242033]">
                  {message.content}
                </p>
                {message.fileName && (
                  <span className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#F5F1FE] px-3 py-2 text-xs font-medium text-[#6A3FC4]">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="max-w-[180px] truncate">{message.fileName}</span>
                    {typeof message.fileSize === "number" && (
                      <span className="text-[#6F6A80]">· {formatFileSize(message.fileSize)}</span>
                    )}
                  </span>
                )}
              </div>
            </motion.article>
          );
        })}
      </AnimatePresence>

      {messages.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-start gap-2.5 rounded-2xl border border-[#EAE5F3] bg-[#F5F1FE]/70 px-4 py-3"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#8054D9]" />
          <p className="text-[13px] leading-relaxed text-[#6F6A80]">
            <span className="font-semibold text-[#242033]">
              Phase 2 — wired to the API.
            </span>{" "}
            Messages now go through <code>/api/v1/chat</code>. The AI
            provider is not configured yet, so nothing is answered — your
            messages are shown above with the API&apos;s error instead.
          </p>
        </motion.div>
      )}
    </div>
  );
}

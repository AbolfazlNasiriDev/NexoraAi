"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Info } from "lucide-react";
import type { ChatMessage } from "@/lib/data";
import { formatFileSize } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ChatMessagesProps {
  messages: ChatMessage[];
}

/**
 * Local chat transcript. Messages are the user's own words, stored only
 * in this browser session. Nexora never invents a reply in Phase 1 —
 * the note below each thread says so plainly.
 */
export function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 sm:px-6">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
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
                <Badge variant="lavender">{message.model}</Badge>
                <span className="text-[11px] font-medium text-[#6F6A80]">
                  {message.createdAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[#242033]">
                {message.text}
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
        ))}
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
            <span className="font-semibold text-[#242033]">Phase 1 — frontend only.</span>{" "}
            Your message is kept locally in this browser session. The AI
            backend connects in Phase 2, so there is no generated reply yet.
          </p>
        </motion.div>
      )}
    </div>
  );
}

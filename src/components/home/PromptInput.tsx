"use client";

import { useRef, useState } from "react";
import {
  FileText,
  Loader2,
  MoreHorizontal,
  Paperclip,
  SendHorizontal,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type Tone = "Precise" | "Creative" | "Concise";

const tones: Tone[] = ["Precise", "Creative", "Concise"];

interface AttachedFile {
  name: string;
  size: number;
}

interface PromptInputProps {
  placeholder: string;
  modelName: string;
  onSend: (text: string, file?: AttachedFile) => void;
  autoFocus?: boolean;
  /** True while a message is being sent to the API — disables input. */
  isSending?: boolean;
}

/**
 * The main prompt composer. Files are only read locally to show a chip
 * (name + size) — they are NOT sent to the API in Phase 2.5 (text only).
 * Enter sends, Shift+Enter adds a new line.
 */
export function PromptInput({
  placeholder,
  modelName,
  onSend,
  isSending = false,
}: PromptInputProps) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<AttachedFile | null>(null);
  const [tone, setTone] = useState<Tone>("Precise");
  const [showOptions, setShowOptions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = !isSending && (value.trim().length > 0 || file !== null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const send = () => {
    if (!canSend) return;
    onSend(value.trim(), file ?? undefined);
    setValue("");
    setFile(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full">
      <div className="rounded-[28px] border border-[#EAE5F3] bg-white p-3 shadow-card transition-all duration-300 focus-within:border-[#B69AEF] focus-within:shadow-lift focus-within:ring-4 focus-within:ring-[#EDE5FC]/60 sm:p-4">
        {/* Attached file chip */}
        {file && (
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex max-w-full items-center gap-2 rounded-xl bg-[#F5F1FE] py-2 pr-2 pl-3 text-xs font-medium text-[#6A3FC4]">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="max-w-[160px] truncate sm:max-w-[260px]">{file.name}</span>
              <span className="text-[#6F6A80]">{formatFileSize(file.size)}</span>
              <button
                onClick={() => setFile(null)}
                aria-label="Remove attached file"
                className="grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-white text-[#6F6A80] transition-colors hover:bg-white hover:text-[#242033]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
            <span className="hidden text-[11px] text-[#6F6A80] sm:inline">
              Stored locally — not uploaded anywhere.
            </span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          disabled={isSending}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          aria-label="Message Nexora"
          className="max-h-[200px] w-full resize-none bg-transparent px-2 pt-1 text-[15px] leading-relaxed text-[#242033] placeholder:text-[#6F6A80]/70 disabled:opacity-60"
        />

        {/* Tone options */}
        {showOptions && (
          <div className="mt-2 flex flex-wrap items-center gap-2 px-2 pb-1">
            <span className="text-[11px] font-semibold tracking-wide text-[#6F6A80] uppercase">
              Tone
            </span>
            {tones.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-all",
                  tone === t
                    ? "bg-[#8054D9] text-white shadow-[0_6px_16px_rgb(128_84_217/0.35)]"
                    : "bg-[#F5F1FE] text-[#6A3FC4] hover:bg-[#EDE5FC]",
                )}
              >
                {t}
              </button>
            ))}
            <span className="text-[11px] text-[#6F6A80]">
              Saved locally for this session.
            </span>
          </div>
        )}

        {/* Action row */}
        <div className="mt-2 flex items-center gap-1.5">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            aria-label="Attach a file"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) setFile({ name: picked.name, size: picked.size });
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Attach a file"
            title="Attach a file"
            className="flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium text-[#6F6A80] transition-colors hover:bg-[#F5F1FE] hover:text-[#242033]"
          >
            <Paperclip className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">Attach</span>
          </button>
          <button
            onClick={() => setShowOptions((v) => !v)}
            aria-label="Prompt settings"
            aria-expanded={showOptions}
            title="Prompt settings"
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
              showOptions
                ? "bg-[#EDE5FC] text-[#6A3FC4]"
                : "text-[#6F6A80] hover:bg-[#F5F1FE] hover:text-[#242033]",
            )}
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={() => setShowOptions((v) => !v)}
            aria-label="More options"
            title="More options"
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-[#6F6A80] transition-colors hover:bg-[#F5F1FE] hover:text-[#242033]"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[11px] font-medium text-[#6F6A80] md:inline">
              {modelName} · {tone} tone · Enter to send
            </span>
            <Button
              onClick={send}
              disabled={!canSend}
              aria-label={isSending ? "Sending message" : "Send message"}
              size="icon"
              className="h-11 w-11 rounded-full shadow-[0_10px_24px_rgb(128_84_217/0.4)] disabled:from-[#B69AEF] disabled:to-[#B69AEF] disabled:shadow-none"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendHorizontal className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-[#6F6A80]">
        Nexora can make mistakes in Phase 2 — always double-check important
        answers. Your files stay on this device — they aren&apos;t sent to
        the API yet.
      </p>
    </div>
  );
}

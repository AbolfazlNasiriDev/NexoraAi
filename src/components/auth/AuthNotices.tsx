"use client";

import { AlertTriangle, Info } from "lucide-react";

/**
 * Shared auth notices (Phase 3.1).
 *
 * - `AuthNotConfiguredNotice`: the honest unconfigured state. Shown
 *   instead of a working form when no Supabase project is set up — the
 *   page never fakes a sign-in that cannot happen.
 * - `AuthFormError`: a safe error box. It renders ONLY the friendly
 *   message the caller mapped (see `mapAuthError`); raw Supabase
 *   internals, tokens and stacks are never rendered here.
 */

export function AuthNotConfiguredNotice() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-[#EAE5F3] bg-[#F5F1FE] px-4 py-3.5 text-sm leading-relaxed text-[#6A3FC4]"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0" />
      <p>
        <span className="font-semibold">Authentication is not configured yet.</span>{" "}
        Connect a Supabase project (see{" "}
        <code className="rounded bg-white px-1 py-0.5 text-xs">.env.example</code>
        ) to enable sign-in. Nothing here is a real account.
      </p>
    </div>
  );
}

export function AuthFormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-[#FECDD3] bg-[#FFF1F2] px-4 py-3.5 text-sm leading-relaxed text-[#9F1239]"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#DC2626]" />
      <p>{message}</p>
    </div>
  );
}

export function AuthFormSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-[#EAE5F3] bg-[#EDE5FC] px-4 py-3.5 text-sm leading-relaxed text-[#6A3FC4]"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import {
  AuthFormError,
  AuthNotConfiguredNotice,
} from "@/components/auth/AuthNotices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { mapAuthError } from "@/lib/supabase/auth-error";
import { validateEmail } from "@/lib/validation/auth.schema";

/**
 * Forgot password (Phase 3.1).
 *
 * Sends a recovery link via `resetPasswordForEmail`, redirecting back
 * to /auth/callback?next=/auth/reset-password. The success message is
 * deliberately neutral — "If an account exists…" — so the page never
 * reveals whether an email is registered. If Supabase is not
 * configured, the honest notice is shown and no email is attempted.
 */

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-[#DC2626]">{message}</p>;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const client = createClient();
  const isConfigured = client !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !isConfigured) return;
    const validationError = validateEmail(email);
    setEmailError(validationError ?? undefined);
    if (validationError) return;

    setIsSubmitting(true);
    setFormError(null);
    try {
      const supabase = createClient();
      if (!supabase) {
        setFormError(
          "Authentication is not configured yet. Connect a Supabase project first.",
        );
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
        },
      );
      if (error) {
        setFormError(mapAuthError(error));
        return;
      }
      setSent(true);
    } catch (error) {
      setFormError(mapAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="If that account exists, a reset link is on its way."
        footer={
          <>
            Remembered your password?{" "}
            <Link
              href="/auth/sign-in"
              className="font-semibold text-[#6A3FC4] hover:underline"
            >
              Sign in
            </Link>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#EDE5FC] text-[#6A3FC4]">
            <MailCheck className="h-7 w-7" />
          </span>
          <p className="mt-5 text-sm leading-relaxed text-[#6F6A80]">
            If an account exists for{" "}
            <span className="font-semibold text-[#242033]">
              {email.trim()}
            </span>
            , you&apos;ll receive a password-reset link shortly. The link
            expires after one use — request a new one if it lapses.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <>
          Remembered your password?{" "}
          <Link
            href="/auth/sign-in"
            className="font-semibold text-[#6A3FC4] hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {!isConfigured ? (
        <AuthNotConfiguredNotice />
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <AuthFormError message={formError} />

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-[#242033]"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
            />
            <FieldError message={emailError} />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Sending reset link…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

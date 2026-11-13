"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import {
  AuthFormError,
  AuthNotConfiguredNotice,
} from "@/components/auth/AuthNotices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { mapAuthError } from "@/lib/supabase/auth-error";
import {
  validatePassword,
  validatePasswordMatch,
} from "@/lib/validation/auth.schema";

/**
 * Reset password (Phase 3.1).
 *
 * This page is only reachable through the recovery flow: the callback
 * route exchanges the emailed `code` for a session first, and this
 * page then verifies that a session actually exists before it lets
 * anyone set a password. Without a session the page shows the
 * invalid/expired state — it never accepts a password for an
 * unverified link. On success it goes to /auth/sign-in?reset=success.
 */

type SessionState = "checking" | "valid" | "invalid";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-[#DC2626]">{message}</p>;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const client = createClient();
  const isConfigured = client !== null;

  const [sessionState, setSessionState] = useState<SessionState>(
    isConfigured ? "checking" : "invalid",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verify the recovery session before showing the form. The initial
  // state already reflects the unconfigured case, so the effect only
  // runs the async check when a client exists.
  useEffect(() => {
    if (!isConfigured) return;
    let cancelled = false;
    createClient()
      ?.auth.getUser()
      .then(({ data, error }) => {
        if (cancelled) return;
        setSessionState(error || !data.user ? "invalid" : "valid");
      })
      .catch(() => {
        if (!cancelled) setSessionState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [isConfigured]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || sessionState !== "valid") return;
    const passwordError = validatePassword(password);
    const matchError = validatePasswordMatch(password, confirmPassword);
    setErrors({
      ...(passwordError ? { password: passwordError } : {}),
      ...(matchError ? { confirmPassword: matchError } : {}),
    });
    if (passwordError || matchError) return;

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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFormError(mapAuthError(error));
        return;
      }
      router.push("/auth/sign-in?reset=success");
      router.refresh();
    } catch (error) {
      setFormError(mapAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isConfigured) {
    return (
      <AuthCard
        title="Reset your password"
        subtitle="Choose a new password for your account."
      >
        <AuthNotConfiguredNotice />
      </AuthCard>
    );
  }

  if (sessionState === "checking") {
    return (
      <AuthCard
        title="Reset your password"
        subtitle="Checking your reset link…"
      >
        <p className="flex items-center justify-center gap-2 text-center text-sm text-[#6F6A80]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Verifying your session…
        </p>
      </AuthCard>
    );
  }

  if (sessionState === "invalid") {
    return (
      <AuthCard
        title="Link expired or invalid"
        subtitle="This password-reset link can't be used."
        footer={
          <>
            <Link
              href="/auth/forgot-password"
              className="font-semibold text-[#6A3FC4] hover:underline"
            >
              Request a new reset link
            </Link>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF1F2] text-[#DC2626]">
            <KeyRound className="h-7 w-7" />
          </span>
          <p className="mt-5 text-sm leading-relaxed text-[#6F6A80]">
            The link may have expired or already been used. Request a fresh
            reset link and try again.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Choose a new password for your account."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AuthFormError message={formError} />

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-[#242033]"
          >
            New password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
          />
          <FieldError message={errors.password} />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1.5 block text-sm font-medium text-[#242033]"
          >
            Confirm new password
          </label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={isSubmitting}
          />
          <FieldError message={errors.confirmPassword} />
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
              Updating password…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </AuthCard>
  );
}

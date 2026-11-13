"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import {
  AuthFormError,
  AuthFormSuccess,
  AuthNotConfiguredNotice,
} from "@/components/auth/AuthNotices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { mapAuthError } from "@/lib/supabase/auth-error";
import { validateSignInForm } from "@/lib/validation/auth.schema";

/**
 * Sign in (Phase 3.1) — email + password.
 *
 * - Client-side validation first (same rules as the shared module).
 * - If Supabase is not configured, the honest notice is shown and no
 *   sign-in is attempted — never a fake success.
 * - On success: router.push("/") + router.refresh() so the middleware
 *   and the server components see the fresh session.
 * - Errors go through `mapAuthError` — friendly text only, never raw
 *   Supabase internals. Passwords are never logged.
 * - `?reset=success` (from reset-password) and `?error=` (from the
 *   callback route) are mapped through an allowlist — the raw query
 *   value is never rendered.
 */

const ERROR_MESSAGES: Record<string, string> = {
  callback:
    "That sign-in link didn't work. Please try signing in again.",
  not_configured:
    "Authentication is not configured yet. Connect a Supabase project first.",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-[#DC2626]">{message}</p>;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const client = createClient();
  const isConfigured = client !== null;

  const resetSuccess = searchParams.get("reset") === "success";
  const errorParam = searchParams.get("error");
  const callbackError =
    errorParam !== null && errorParam in ERROR_MESSAGES
      ? ERROR_MESSAGES[errorParam]
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !isConfigured) return;
    const validation = validateSignInForm({ email, password });
    setErrors(validation.errors);
    if (!validation.ok) return;

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
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setFormError(mapAuthError(error));
        return;
      }
      router.push("/");
      router.refresh();
    } catch (error) {
      setFormError(mapAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your Nexora AI workspace."
      footer={
        <>
          Don&apos;t have an account yet?{" "}
          <Link
            href="/auth/sign-up"
            className="font-semibold text-[#6A3FC4] hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      {!isConfigured ? (
        <AuthNotConfiguredNotice />
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <AuthFormSuccess
            message={
              resetSuccess
                ? "Your password was reset. Sign in with your new password."
                : null
            }
          />
          <AuthFormError message={formError ?? callbackError} />

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
            <FieldError message={errors.email} />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#242033]"
              >
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-[#6A3FC4] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
            />
            <FieldError message={errors.password} />
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
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <AuthCard
          title="Welcome back"
          subtitle="Sign in to your Nexora AI workspace."
        >
          <p className="text-center text-sm text-[#6F6A80]">Loading…</p>
        </AuthCard>
      }
    >
      <SignInForm />
    </Suspense>
  );
}

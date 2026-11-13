"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { validateSignUpForm } from "@/lib/validation/auth.schema";

/**
 * Sign up (Phase 3.1) — email + password (+ confirmation).
 *
 * - Client-side validation first (same rules as the shared module).
 * - If Supabase is not configured, the honest notice is shown and no
 *   account is attempted — never a fake account.
 * - On success the next step is stated honestly: if the project
 *   requires email confirmation, the user is told to check their email
 *   and the account is NOT treated as working yet; only when a session
 *   actually exists does the page go to "/".
 * - Phone / OAuth sign-up is architecture only in this phase: nothing
 *   here configures SMS or an OAuth provider, and nothing claims they
 *   are active.
 */

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-[#DC2626]">{message}</p>;
}

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const client = createClient();
  const isConfigured = client !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !isConfigured) return;
    const validation = validateSignUpForm({ email, password, confirmPassword });
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
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        setFormError(mapAuthError(error));
        return;
      }
      // A session means the account is usable right away.
      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }
      // No session: email confirmation is required. Say so honestly —
      // the account does not work until the user confirms it.
      setNeedsConfirmation(true);
    } catch (error) {
      setFormError(mapAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (needsConfirmation) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="Your account was created — one step left."
        footer={
          <>
            Already confirmed?{" "}
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
            We sent a confirmation link to{" "}
            <span className="font-semibold text-[#242033]">
              {email.trim()}
            </span>
            . Open it to confirm your account, then sign in. Your profile
            is created automatically when you confirm — nothing else to do.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start your Nexora AI workspace — free, light and calm."
      footer={
        <>
          Already have an account?{" "}
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
            <FieldError message={errors.email} />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-[#242033]"
            >
              Password
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
              Confirm password
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
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
                Creating your account…
              </>
            ) : (
              "Create account"
            )}
          </Button>

          <p className="text-center text-xs leading-relaxed text-[#6F6A80]">
            By creating an account you agree to use Nexora AI fairly. Your
            profile is created automatically on sign-up — no extra details
            are collected.
          </p>
        </form>
      )}
    </AuthCard>
  );
}

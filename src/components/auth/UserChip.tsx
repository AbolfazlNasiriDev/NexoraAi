"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * User chip (Phase 3.1) — the live account area in the TopBar.
 *
 * Display-only: it shows who is signed in and offers a real sign-out.
 * It never decides access — middleware + server checks do that.
 *
 * - Email comes from the verified session user. `profiles.email` is
 *   nullable and a phone user has no email at all, so a missing email
 *   is shown as the neutral fallback "Signed in · <id…>" — never an
 *   invented or placeholder email.
 * - Sign-out goes through POST /auth/sign-out (server-side, clears
 *   cookies), then navigates to /auth/sign-in.
 * - When Supabase is not configured (or the visitor is a guest) the
 *   chip shows a plain "Sign in" link.
 */

interface ChipUser {
  id: string;
  /** Null for users without an email (e.g. phone sign-up). */
  email: string | null;
}

export function UserChip() {
  const router = useRouter();
  const client = createClient();
  const [user, setUser] = useState<ChipUser | null>(null);
  // No client means no session to wait for — not "loading".
  const [loading, setLoading] = useState(client !== null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.auth
      .getUser()
      .then(({ data, error }) => {
        if (cancelled) return;
        setUser(
          error || !data.user
            ? null
            : { id: data.user.id, email: data.user.email ?? null },
        );
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
      });
    const { data: listener } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        const sessionUser = session?.user;
        setUser(
          sessionUser
            ? { id: sessionUser.id, email: sessionUser.email ?? null }
            : null,
        );
      },
    );
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError(false);
    try {
      const res = await fetch("/auth/sign-out", { method: "POST" });
      if (!res.ok) {
        setSignOutError(true);
        return;
      }
      router.push("/auth/sign-in");
      router.refresh();
    } catch {
      setSignOutError(true);
    } finally {
      setIsSigningOut(false);
    }
  }

  if (loading) {
    return (
      <span className="hidden h-10 w-10 animate-pulse place-items-center rounded-xl bg-[#F5F1FE] sm:grid" />
    );
  }

  if (!user) {
    return (
      <Link href="/auth/sign-in">
        <Button variant="outline" size="md">
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
      </Link>
    );
  }

  const display = user.email ?? `Signed in · ${user.id.slice(0, 8)}…`;
  const initial = (user.email?.[0] ?? "N").toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-2 md:flex">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8054D9] to-[#B69AEF] text-xs font-bold text-white">
          {initial}
        </span>
        <span className="max-w-[180px] truncate text-sm font-medium text-[#242033]">
          {display}
        </span>
      </span>
      <Button
        variant="ghost"
        size="md"
        onClick={handleSignOut}
        disabled={isSigningOut}
        title={signOutError ? "Couldn't sign out. Try again." : "Sign out"}
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">
          {isSigningOut ? "Signing out…" : "Sign out"}
        </span>
      </Button>
    </div>
  );
}

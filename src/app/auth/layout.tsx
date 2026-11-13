import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Layout for all /auth/* pages (Phase 3.1): the same soft lavender
 * page glow as the home page, the card centred on mobile and desktop,
 * and a small footer linking back to the workspace. Light theme only.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page-glow flex min-h-screen flex-col items-center justify-center bg-nexora-bg px-4 py-10 text-nexora-text sm:px-6">
      {children}
      <p className="mt-8 text-center text-xs text-[#6F6A80]">
        <Link href="/" className="font-medium text-[#6A3FC4] hover:underline">
          ← Back to Nexora AI
        </Link>
      </p>
    </div>
  );
}

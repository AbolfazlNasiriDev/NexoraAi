import { env, isProviderConfigured } from "@/lib/server/env";
import { ok, withErrorHandling } from "@/lib/server/response";
import type { ProviderStatus } from "@/types/api";

/**
 * GET /api/v1/health — service health check (Phase 2.1).
 *
 * Always answers 200 while the server is up. Provider statuses are honest:
 * every provider reports "not_configured" until a real API key is set
 * (Phase 2.2+). No model is ever claimed available here.
 */

// Health reflects the live server on every request: route handlers are
// dynamic by default, so no segment config is needed (and `dynamic` is
// incompatible with the project's `cacheComponents` setting).

interface HealthData {
  status: "ok";
  app: string;
  version: string;
  timestamp: string;
  providers: Record<"openai" | "gemini" | "anthropic", ProviderStatus>;
}

function providerStatus(
  provider: "openai" | "gemini" | "anthropic",
): ProviderStatus {
  return isProviderConfigured(provider) ? "configured" : "not_configured";
}

export const GET = withErrorHandling(async () => {
  const data: HealthData = {
    status: "ok",
    app: env.appName,
    version: "2.1.0-phase2.1",
    timestamp: new Date().toISOString(),
    providers: {
      openai: providerStatus("openai"),
      gemini: providerStatus("gemini"),
      anthropic: providerStatus("anthropic"),
    },
  };
  return ok(data);
});

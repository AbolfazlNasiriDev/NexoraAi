/**
 * GET /api/v1/models — model management endpoint (Phase 2.4).
 *
 * Reads models ONLY from the shared ModelRegistry
 * (`src/lib/ai/registry.ts`) — nothing is hardcoded, added, renamed, or
 * filtered here. Each model's `status` is derived live by the registry
 * from real server env: today no provider has a real API key, so every
 * model reports "not_configured" and `availableCount` is 0. That empty
 * availability is the correct honest result, not a bug — no model is ever
 * claimed "available" without a real connection.
 *
 * The Phase 1 display labels "Nexora 1.0 Pro", "Nexora 1.0" and
 * "Nexora Lite" are UI labels only and never appear in this response —
 * they are not real AI models.
 *
 * Query params: none are required. Any query params sent by a client are
 * ignored (the full model list is always returned) rather than erroring,
 * so the endpoint stays forward-compatible with future filters.
 *
 * Only GET is defined; any other method gets Next.js' default 405.
 * The response carries no secrets.
 */

import { headers } from "next/headers";
import { modelRegistry } from "@/lib/ai/registry";
import { ok, withErrorHandling } from "@/lib/server/response";
import type { ModelInfo } from "@/types/ai";

interface ModelsData {
  models: ModelInfo[];
  total: number;
  availableCount: number;
}

export const GET = withErrorHandling(async () => {
  // Reading request headers opts this route into dynamic rendering, so
  // statuses always reflect the live server env instead of a build-time
  // snapshot. (`force-dynamic` segment config is incompatible with this
  // project's `cacheComponents` setting — see the health route.)
  await headers();
  const models = modelRegistry.listModels();
  const data: ModelsData = {
    models,
    total: models.length,
    availableCount: models.filter((model) => model.status === "available")
      .length,
  };
  return ok(data);
});

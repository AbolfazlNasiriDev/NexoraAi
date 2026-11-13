/**
 * Unit tests for the model registry (Phase 2.2).
 *
 * Pins the honesty contract with no keys set: six known candidate
 * models, all `not_configured`, zero available, and no display-only
 * "Nexora 1.0" label ever appearing as a real model.
 */
import { describe, expect, it } from "vitest";

import { modelRegistry } from "@/lib/ai/registry";

const EXPECTED_IDS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
  "claude-sonnet-4",
  "claude-3-5-sonnet",
] as const;

describe("modelRegistry", () => {
  it("lists exactly the six known candidate models", () => {
    const models = modelRegistry.listModels();
    expect(models).toHaveLength(6);
    expect(models.map((m) => m.id).sort()).toEqual(
      [...EXPECTED_IDS].sort(),
    );
  });

  it("reports every model as not_configured with no keys set", () => {
    for (const model of modelRegistry.listModels()) {
      expect(model.status).toBe("not_configured");
    }
    expect(modelRegistry.listAvailableModels()).toEqual([]);
  });

  it("never lists a Nexora 1.0 display label as a real model", () => {
    for (const model of modelRegistry.listModels()) {
      expect(model.id).not.toContain("nexora");
      expect(model.name).not.toMatch(/Nexora 1\.0/i);
    }
  });

  it("resolves a known model and its provider", () => {
    const model = modelRegistry.getModel("gpt-4o");
    expect(model).toBeDefined();
    expect(model?.provider).toBe("openai");
    expect(model?.name).toBe("GPT-4o");
    expect(modelRegistry.getProviderForModel("gpt-4o")?.id).toBe("openai");
    expect(modelRegistry.getProviderForModel("claude-sonnet-4")?.id).toBe(
      "anthropic",
    );
  });

  it("returns undefined for an unknown model id", () => {
    expect(modelRegistry.getModel("not-a-model")).toBeUndefined();
    expect(modelRegistry.getProviderForModel("not-a-model")).toBeUndefined();
  });

  it("reports all three providers and all not_configured", () => {
    const providers = modelRegistry.listProviders();
    expect(providers.map((p) => p.id).sort()).toEqual([
      "anthropic",
      "gemini",
      "openai",
    ]);
    expect(modelRegistry.getProviderStatus()).toEqual({
      openai: "not_configured",
      gemini: "not_configured",
      anthropic: "not_configured",
    });
  });
});

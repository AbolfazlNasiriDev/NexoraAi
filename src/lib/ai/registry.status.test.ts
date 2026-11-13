/**
 * Unit tests for model status derivation (Phase 2.10).
 *
 * Pins the honesty fix for the audit finding: a key alone must never
 * make a model "available". Statuses are:
 * - no key -> `not_configured`
 * - key set, provider still a stub -> `not_implemented`
 * - key set AND chat() really implemented -> `available`
 *
 * `env.ts` reads `process.env` once, at import time, so each case
 * re-imports a fresh copy of the registry (`vi.resetModules()` +
 * dynamic `import`) after stubbing the environment — the same pattern
 * as `env.test.ts`. The only "key" used is the literal fake string
 * "test-dummy-key"; nothing here ever calls a real provider or
 * sends a request anywhere.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BaseProvider } from "@/lib/ai/providers/base";
import type {
  ChatCompletionResponse,
  StreamChunk,
} from "@/lib/ai/types";

const KEY_VARS = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
] as const;

const savedEnv = new Map<string, string | undefined>();

function stubVar(name: string, value: string | undefined) {
  if (!savedEnv.has(name)) {
    savedEnv.set(name, process.env[name]);
  }
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

beforeEach(() => {
  vi.resetModules();
  savedEnv.clear();
  for (const name of KEY_VARS) {
    stubVar(name, undefined);
  }
});

afterEach(() => {
  for (const [name, value] of savedEnv) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  savedEnv.clear();
  vi.unstubAllEnvs();
});

/**
 * Test double only: a provider whose `chat()` counts as "real" in the
 * `isImplemented()` sense. Its `chat()` / `chatStream()` throw if ever
 * invoked, so this double can never produce a fake reply. Defined
 * inside a helper because `BaseProvider` must be imported fresh (after
 * stubbing env) for `isConfigured()` to see the stubbed key.
 */
async function makeImplementedDouble(): Promise<BaseProvider> {
  const { BaseProvider } = await import("@/lib/ai/providers/base");

  class ImplementedTestProvider extends BaseProvider {
    protected override readonly implemented = true;

    constructor() {
      super(
        "openai",
        "Test Implemented",
        { streaming: true, supportsSystemPrompt: true },
        [
          {
            id: "test-model",
            name: "Test Model",
            description: "Test double only.",
            capabilities: ["chat"],
          },
        ],
      );
    }

    async chat(): Promise<ChatCompletionResponse> {
      throw new Error("test double chat() must never be called");
    }

    chatStream(): AsyncGenerator<StreamChunk> {
      throw new Error("test double chatStream() must never be called");
    }
  }

  return new ImplementedTestProvider();
}

describe("model status with a dummy key", () => {
  it("reports keyed-but-unimplemented models as not_implemented, never available", async () => {
    stubVar("OPENAI_API_KEY", "test-dummy-key");
    const { modelRegistry } = await import("@/lib/ai/registry");

    const openai = modelRegistry
      .listModels()
      .filter((m) => m.provider === "openai");
    expect(openai.map((m) => m.id).sort()).toEqual([
      "gpt-4o",
      "gpt-4o-mini",
    ]);
    for (const model of openai) {
      expect(model.status).toBe("not_implemented");
    }
    // Providers without a key stay not_configured.
    for (const model of modelRegistry.listModels()) {
      if (model.provider !== "openai") {
        expect(model.status).toBe("not_configured");
      }
      expect(model.status).not.toBe("available");
    }
    expect(modelRegistry.listAvailableModels()).toEqual([]);
  });

  it("a not-implemented provider is never available, even with all keys set", async () => {
    stubVar("OPENAI_API_KEY", "test-dummy-key");
    stubVar("GEMINI_API_KEY", "test-dummy-key");
    stubVar("ANTHROPIC_API_KEY", "test-dummy-key");
    const { modelRegistry } = await import("@/lib/ai/registry");

    expect(modelRegistry.listAvailableModels()).toEqual([]);
    for (const model of modelRegistry.listModels()) {
      expect(model.status).toBe("not_implemented");
    }
  });

  it("isImplemented() is false for the stubs, even with a dummy key", async () => {
    stubVar("OPENAI_API_KEY", "test-dummy-key");
    const { modelRegistry } = await import("@/lib/ai/registry");

    for (const provider of modelRegistry.listProviders()) {
      expect(provider.isImplemented()).toBe(false);
    }
    expect(
      modelRegistry.getProviderForModel("gpt-4o")?.isConfigured(),
    ).toBe(true);
  });
});

describe("configured AND implemented is the only way to available", () => {
  it("a test double with implemented=true reports available — without ever calling chat()", async () => {
    stubVar("OPENAI_API_KEY", "test-dummy-key");
    const provider = await makeImplementedDouble();

    expect(provider.isConfigured()).toBe(true);
    expect(provider.isImplemented()).toBe(true);
    expect(provider.getModels()).toEqual([
      {
        id: "test-model",
        name: "Test Model",
        provider: "openai",
        description: "Test double only.",
        capabilities: ["chat"],
        status: "available",
      },
    ]);
    await expect(
      provider.chat({
        modelId: "test-model",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("must never be called");
  });

  it("an implemented provider without a key is still not_configured", async () => {
    const provider = await makeImplementedDouble();

    expect(provider.isConfigured()).toBe(false);
    expect(provider.isImplemented()).toBe(true);
    expect(provider.getModels()[0].status).toBe("not_configured");
  });
});

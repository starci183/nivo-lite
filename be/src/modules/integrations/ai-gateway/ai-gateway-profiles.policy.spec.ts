import type { ChatCompletionRequest } from "@starci/ai-router"
import { createRouter } from "@starci/ai-router/gateway"
import { createFakeProvider } from "@starci/ai-router/testing"
import { Secret } from "@modules/platform/config"
import type { AiGatewayOptions, AiGatewayProvider } from "./ai-gateway.options"
import { MODEL_PROFILES, modelProfilesOf, profileWireOf } from "./ai-gateway-profiles.policy"
import { routerOptionsOf } from "./ai-gateway-router.mapper"

const ANTHROPIC: AiGatewayProvider = {
    id: "anthropic",
    kind: "anthropic",
    baseUrl: "https://anthropic.test/v1",
    keys: [{ alias: "ANTHROPIC_API_KEY", secret: new Secret("sk-test-anthropic") }],
}
const OPENAI: AiGatewayProvider = {
    id: "openai",
    kind: "openai",
    baseUrl: "https://openai.test/v1",
    keys: [{ alias: "OPENAI_API_KEY", secret: new Secret("sk-test-openai") }],
}
const MODELS = { work: "claude-haiku-5-5", strong: "claude-sonnet-5-5" }
/** A vector of the pinned model's length (1536). */
const VECTOR = Array.from({ length: 1536 }, (_, index) => index / 1536)

/** A router over the real pool of these providers, every request answered by the fake. */
const routerOf = (providers: ReadonlyArray<AiGatewayProvider>, fake: ReturnType<typeof createFakeProvider>) => {
    const options: AiGatewayOptions = { providers, models: MODELS, gateway: null }
    const pool = routerOptionsOf(options)
    if (pool === null) throw new Error("no pool")
    return createRouter({ ...pool, fetch: fake.fetch, random: () => 0.5 })
}

/** The body NIVO sends a Claude profile (`profileWireOf`): no temperature, no OpenRouter fields. */
const NIVO_BODY: ChatCompletionRequest = {
    messages: [
        { role: "system", content: "craft, tools, shop rules, step" },
        { role: "user", content: "{}" },
    ],
}

/** The protocols the fake saw, in order. */
const protocolsOf = (fake: ReturnType<typeof createFakeProvider>): ReadonlyArray<string> => fake.calls.map((call) => call.protocol)

describe("modelProfilesOf: Claude only (owner: no OpenRouter for chat)", () => {
    it("serves every model profile on Anthropic alone, OpenAI present or not", () => {
        const profiles = modelProfilesOf([ANTHROPIC, OPENAI], MODELS)

        expect(profiles.map((profile) => profile.name)).toEqual(["sonnet", "haiku", "auto-light", "auto-heavy"])
        expect(profiles.flatMap((profile) => profile.candidates.map((seat) => seat.provider))).toEqual(
            Array.from({ length: 6 }, () => "anthropic"),
        )
        expect(profiles.find((profile) => profile.name === "auto-light")?.candidates.map((seat) => seat.model)).toEqual([
            MODELS.work,
            MODELS.strong,
        ])
        expect(profiles.find((profile) => profile.name === "auto-heavy")?.candidates.map((seat) => seat.model)).toEqual([
            MODELS.strong,
            MODELS.work,
        ])
    })

    it("serves no model profile without an Anthropic key: nothing falls to another vendor", () => {
        expect(modelProfilesOf([OPENAI], MODELS)).toEqual([])
    })
})

describe("profileWireOf", () => {
    it("sends every profile the Claude body: no sampling, no forced tool choice, no OpenRouter fields", () => {
        for (const profile of Object.values(MODEL_PROFILES)) {
            expect(profileWireOf(profile)).toEqual({ sampling: false, forcedToolChoice: false, upstreamFields: false })
        }
    })
})

describe("the pool on the router (fake providers, no real call)", () => {
    it("is accepted by the router with every mix of keys", () => {
        for (const providers of [[ANTHROPIC, OPENAI], [ANTHROPIC], [OPENAI]]) {
            expect(() => routerOf(providers, createFakeProvider())).not.toThrow()
        }
    })

    it("both keys present: `work` lands on Claude Haiku over the Messages API", async () => {
        const fake = createFakeProvider().on({ baseUrl: ANTHROPIC.baseUrl }, { text: "ok" })
        const router = routerOf([ANTHROPIC, OPENAI], fake)

        const answer = await router.chat({ ...NIVO_BODY }, { profile: "work" })

        expect(answer.model).toBe("claude-haiku-5-5")
        expect(protocolsOf(fake)).toEqual(["anthropic"])
        expect(Object.keys(fake.calls[0]?.body ?? {}).sort()).toEqual(["max_tokens", "messages", "model", "system"])
    })

    it("re-points every chat profile to Claude: sonnet, haiku, auto-light, auto-heavy", async () => {
        const fake = createFakeProvider().on({ baseUrl: ANTHROPIC.baseUrl }, { text: "ok" })
        const router = routerOf([ANTHROPIC, OPENAI], fake)

        const served = await Promise.all(
            Object.values(MODEL_PROFILES).map(async (profile) => (await router.chat({ ...NIVO_BODY }, { profile })).model),
        )

        expect(served).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-haiku-5-5", "claude-sonnet-5-5"])
        expect(new Set(protocolsOf(fake))).toEqual(new Set(["anthropic"]))
    })

    it("a heavy Auto step falls back to Haiku when Sonnet fails: Claude only, OpenAI never asked", async () => {
        const fake = createFakeProvider()
            .on({ baseUrl: ANTHROPIC.baseUrl, model: "claude-sonnet-5-5" }, { status: 500 })
            .on({ baseUrl: ANTHROPIC.baseUrl, model: "claude-haiku-5-5" }, { text: "ok" })
            .on({ baseUrl: OPENAI.baseUrl }, { text: "never" })
        const router = routerOf([ANTHROPIC, OPENAI], fake)

        const answer = await router.chat({ ...NIVO_BODY }, { profile: MODEL_PROFILES.autoHeavy })

        expect(answer.model).toBe("claude-haiku-5-5")
        expect(protocolsOf(fake)).toEqual(["anthropic", "anthropic"])
    })

    it("never switches an explicit model: `sonnet` with Anthropic failing fails, nobody else is asked", async () => {
        const fake = createFakeProvider()
            .on({ baseUrl: ANTHROPIC.baseUrl }, { status: 500 })
            .on({ baseUrl: OPENAI.baseUrl }, { text: "ok" })
        const router = routerOf([ANTHROPIC, OPENAI], fake)

        await expect(router.chat({ ...NIVO_BODY }, { profile: MODEL_PROFILES.sonnet })).rejects.toThrow()
        expect(protocolsOf(fake)).toEqual(["anthropic"])
    })

    it("Anthropic key missing: every chat profile fails loudly (no profile), embeddings still served", async () => {
        const fake = createFakeProvider().on({ baseUrl: OPENAI.baseUrl }, { embedding: VECTOR })
        const router = routerOf([OPENAI], fake)

        for (const profile of ["work", ...Object.values(MODEL_PROFILES)]) {
            await expect(router.chat({ ...NIVO_BODY }, { profile })).rejects.toThrow()
        }
        const vectors = await router.embeddings({ input: ["a"] }, { profile: "embed-oa" })
        expect(vectors.data).toHaveLength(1)
        expect(fake.calls.map((call) => call.key)).toEqual(["sk-test-openai"])
    })

    it("both keys present: `embed-oa` lands on OpenAI's text-embedding-3-small, 1536 numbers", async () => {
        const fake = createFakeProvider().on({ baseUrl: OPENAI.baseUrl }, { embedding: VECTOR })
        const router = routerOf([ANTHROPIC, OPENAI], fake)

        const vectors = await router.embeddings({ input: ["a"], dimensions: 1536 }, { profile: "embed-oa" })

        expect(vectors.model).toBe("text-embedding-3-small")
        expect(vectors.data[0]?.embedding).toHaveLength(1536)
        expect(protocolsOf(fake)).toEqual(["openai"])
    })

    it("refuses a reply of another vector length: the pinned model's dimensions are checked", async () => {
        const fake = createFakeProvider().on({ baseUrl: OPENAI.baseUrl }, { embedding: [0.1, 0.2] })
        const router = routerOf([ANTHROPIC, OPENAI], fake)

        // One attempt: a wrong length is a failed attempt the router would otherwise retry with backoff.
        await expect(router.embeddings({ input: ["a"] }, { profile: "embed-oa", policy: { maxAttempts: 1 } })).rejects.toThrow()
    })

    it("OpenAI key missing: no embeddings profile, so an embeddings call fails loudly and nothing is sent", async () => {
        const fake = createFakeProvider().on({ baseUrl: ANTHROPIC.baseUrl }, { text: "ok" })
        const router = routerOf([ANTHROPIC], fake)

        await expect(router.embeddings({ input: ["a"] }, { profile: "embed-oa" })).rejects.toThrow()
        expect(fake.calls).toHaveLength(0)
    })

    it("pins `embed-oa`: the router refuses at startup a second candidate of another identity", () => {
        const pool = routerOptionsOf({ providers: [OPENAI], models: MODELS, gateway: null })
        if (pool === null) throw new Error("no pool")
        const other = { id: "text-embedding-3-large", identity: "text-embedding-3-large", dimensions: 1536, capabilities: ["embeddings" as const] }
        const mixed = {
            ...pool,
            providers: pool.providers.map((entry) => ({ ...entry, models: [...entry.models, other] })),
            profiles: {
                ...pool.profiles,
                "embed-oa": {
                    pinned: true,
                    candidates: [
                        { provider: "openai", model: "text-embedding-3-small" },
                        { provider: "openai", model: "text-embedding-3-large" },
                    ],
                },
            },
        }

        expect(() => createRouter({ ...pool, fetch: createFakeProvider().fetch })).not.toThrow()
        expect(() => createRouter({ ...mixed, fetch: createFakeProvider().fetch })).toThrow()
    })

    it("has no OpenRouter provider: the pool is Anthropic and OpenAI only", () => {
        const pool = routerOptionsOf({ providers: [ANTHROPIC, OPENAI], models: MODELS, gateway: null })

        expect(pool?.providers.map((entry) => [entry.id, entry.kind])).toEqual([
            ["anthropic", "anthropic"],
            ["openai", "openai"],
        ])
        expect(pool?.profiles?.["embed-oa"]).toEqual({
            pinned: true,
            candidates: [{ provider: "openai", model: "text-embedding-3-small" }],
            allowFallback: false,
        })
        expect(pool?.profiles).not.toHaveProperty("embed")
    })
})

import type { ChatCompletionRequest } from "@starci/ai-router"
import { createRouter } from "@starci/ai-router/gateway"
import { createFakeProvider } from "@starci/ai-router/testing"
import { Secret } from "@modules/platform/config"
import type { AiGatewayOptions, AiGatewayProvider } from "./ai-gateway.options"
import { MODEL_PROFILES, modelProfilesOf, profileWireOf } from "./ai-gateway-profiles.policy"
import { routerOptionsOf } from "./ai-gateway-router.mapper"

const UPSTREAM: AiGatewayProvider = {
    id: "upstream",
    baseUrl: "https://upstream.test/v1",
    keys: [{ alias: "OPENROUTER_API_KEY", secret: new Secret("sk-test-upstream") }],
}
const ANTHROPIC: AiGatewayProvider = {
    id: "anthropic",
    kind: "anthropic",
    baseUrl: "https://anthropic.test/v1",
    keys: [{ alias: "ANTHROPIC_API_KEY", secret: new Secret("sk-test-anthropic") }],
}
const MODELS = { work: "deepseek/deepseek-v4.1-flash", embed: "qwen/qwen3-embedding-8b", strong: "claude-sonnet-5-5" }

/** A router over the real pool of these providers, every request answered by the fake. */
const routerOf = (providers: ReadonlyArray<AiGatewayProvider>, fake: ReturnType<typeof createFakeProvider>) => {
    const options: AiGatewayOptions = { providers, models: MODELS, gateway: null }
    const pool = routerOptionsOf(options)
    if (pool === null) throw new Error("no pool")
    return createRouter({ ...pool, fetch: fake.fetch, random: () => 0.5 })
}

/** The body NIVO sends for a call that may reach the upstream: OpenRouter's own fields, and no temperature (`profileWireOf`). */
const NIVO_BODY: ChatCompletionRequest = {
    messages: [
        { role: "system", content: "craft, tools, shop rules, step" },
        { role: "user", content: "{}" },
    ],
    reasoning: { effort: "low", exclude: true },
    session_id: "0123456789abcdef0123456789abcdef",
    provider: { order: ["together"], allow_fallbacks: true },
}

describe("modelProfilesOf", () => {
    it("serves every model profile with both providers", () => {
        expect(modelProfilesOf([UPSTREAM, ANTHROPIC], MODELS).map((profile) => profile.name)).toEqual([
            "sonnet",
            "deepseek",
            "auto-light",
            "auto-heavy",
        ])
    })

    it("leaves `sonnet` out without an Anthropic key and keeps Auto on the upstream alone", () => {
        expect(modelProfilesOf([UPSTREAM], MODELS)).toEqual([
            { name: "deepseek", candidates: [{ provider: "upstream", model: MODELS.work }] },
            { name: "auto-light", candidates: [{ provider: "upstream", model: MODELS.work }] },
            { name: "auto-heavy", candidates: [{ provider: "upstream", model: MODELS.work }] },
        ])
    })
})

describe("profileWireOf", () => {
    it("sends no sampling, no forced tool choice and no upstream fields to the profile that reaches only Anthropic", () => {
        expect(profileWireOf(MODEL_PROFILES.sonnet)).toEqual({ sampling: false, forcedToolChoice: false, upstreamFields: false })
    })

    it("keeps today's body for the cheap model alone", () => {
        expect(profileWireOf(MODEL_PROFILES.deepseek)).toEqual({ sampling: true, forcedToolChoice: true, upstreamFields: true })
    })

    it("sends Auto the body both providers accept, with the upstream's fields", () => {
        for (const profile of [MODEL_PROFILES.autoLight, MODEL_PROFILES.autoHeavy]) {
            expect(profileWireOf(profile)).toEqual({ sampling: false, forcedToolChoice: false, upstreamFields: true })
        }
    })
})

describe("the pool on the router (fake providers, no real call)", () => {
    it("is accepted by the router with both providers", () => {
        expect(() => routerOf([UPSTREAM, ANTHROPIC], createFakeProvider())).not.toThrow()
        expect(() => routerOf([UPSTREAM], createFakeProvider())).not.toThrow()
    })

    it("never lets OpenRouter's own fields reach Anthropic: the Messages body carries none of them, nor a temperature", async () => {
        const fake = createFakeProvider().on({ baseUrl: ANTHROPIC.baseUrl }, { text: "ok" })
        const router = routerOf([UPSTREAM, ANTHROPIC], fake)

        const answer = await router.chat({ ...NIVO_BODY }, { profile: MODEL_PROFILES.autoHeavy })

        expect(answer.model).toBe("claude-sonnet-5-5")
        const [call] = fake.calls
        expect(call?.protocol).toBe("anthropic")
        expect(Object.keys(call?.body ?? {}).sort()).toEqual(["max_tokens", "messages", "model", "system"])
        expect(call?.body.max_tokens).toBe(32_000)
    })

    it("sends the upstream its own fields on a light Auto step", async () => {
        const fake = createFakeProvider().on({ baseUrl: UPSTREAM.baseUrl }, { text: "ok" })
        const router = routerOf([UPSTREAM, ANTHROPIC], fake)

        const answer = await router.chat({ ...NIVO_BODY }, { profile: MODEL_PROFILES.autoLight })

        expect(answer.model).toBe(MODELS.work)
        expect(fake.calls[0]?.protocol).toBe("openai")
        expect(fake.calls[0]?.body).toMatchObject({ reasoning: NIVO_BODY.reasoning, session_id: NIVO_BODY.session_id })
    })

    it("hands a heavy Auto step to the upstream when Anthropic fails", async () => {
        const fake = createFakeProvider()
            .on({ baseUrl: ANTHROPIC.baseUrl }, { status: 500 })
            .on({ baseUrl: UPSTREAM.baseUrl }, { text: "ok" })
        const router = routerOf([UPSTREAM, ANTHROPIC], fake)

        const answer = await router.chat({ ...NIVO_BODY }, { profile: MODEL_PROFILES.autoHeavy })

        expect(fake.calls.map((call) => call.protocol)).toEqual(["anthropic", "openai"])
        expect(answer.model).toBe(MODELS.work)
    })

    it("never switches an explicit model: `sonnet` with Anthropic failing fails, the upstream is never asked", async () => {
        const fake = createFakeProvider()
            .on({ baseUrl: ANTHROPIC.baseUrl }, { status: 500 })
            .on({ baseUrl: UPSTREAM.baseUrl }, { text: "ok" })
        const router = routerOf([UPSTREAM, ANTHROPIC], fake)

        await expect(router.chat({ messages: NIVO_BODY.messages }, { profile: MODEL_PROFILES.sonnet })).rejects.toThrow()
        expect(fake.calls.map((call) => call.protocol)).toEqual(["anthropic"])
    })
})

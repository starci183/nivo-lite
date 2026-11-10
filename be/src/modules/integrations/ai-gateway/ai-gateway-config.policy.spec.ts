import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import type { AiGatewayOptions } from "./ai-gateway.options"
import { aiGatewayOf } from "./ai-gateway-config.policy"

const SUBJECT = Symbol("ai-gateway-config.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { aiGatewayOf } }],
    }).compile()
    return moduleRef.get<{ aiGatewayOf: typeof aiGatewayOf }>(SUBJECT)
}

const parse = async (values: Readonly<Record<string, string>>): Promise<AiGatewayOptions> =>
    (await buildSubject()).aiGatewayOf(new EnvSource(values))

describe("aiGatewayOf: two providers, Anthropic (chat) and OpenAI (embeddings)", () => {
    it("parses an empty pool with no gateway without a key, so the app boots without AI", async () => {
        const options = await parse({})

        expect(options.providers).toEqual([])
        expect(options.gateway).toBeNull()
        expect(options.models).toEqual({ work: "claude-haiku-5-5", strong: "claude-sonnet-5-5" })
    })

    it("pools ANTHROPIC_API_KEY and OPENAI_API_KEY with their numbered siblings, each on its own API, skipping a gap", async () => {
        const options = await parse({
            ANTHROPIC_API_KEY: "a",
            ANTHROPIC_API_KEY_2: "b",
            OPENAI_API_KEY: "o",
            OPENAI_API_KEY_3: "o3",
        })

        expect(options.providers.map((provider) => [provider.id, provider.kind, provider.baseUrl])).toEqual([
            ["anthropic", "anthropic", "https://api.anthropic.com/v1"],
            ["openai", "openai", "https://api.openai.com/v1"],
        ])
        expect(options.providers[0]?.keys.map((key) => [key.alias, key.secret.reveal()])).toEqual([
            ["ANTHROPIC_API_KEY", "a"],
            ["ANTHROPIC_API_KEY_2", "b"],
        ])
        expect(options.providers[1]?.keys.map((key) => key.alias)).toEqual(["OPENAI_API_KEY", "OPENAI_API_KEY_3"])
    })

    it("reads no OpenRouter key and no LLM_* / EMBEDDING_* variable any more: no OpenRouter provider in the pool", async () => {
        const options = await parse({
            OPENROUTER_API_KEY: "k",
            LLM_API_KEY: "l",
            LLM_BASE_URL: "https://llm.test/v1",
            EMBEDDING_BASE_URL: "http://ollama.test/v1",
            EMBEDDING_API_KEY: "e",
            ANTHROPIC_API_KEY: "a",
        })

        expect(options.providers.map((provider) => provider.id)).toEqual(["anthropic"])
        expect((await parse({ OPENROUTER_API_KEY: "k" })).providers).toEqual([])
    })
})

describe("aiGatewayOf, the gateway", () => {
    it("binds the key to every profile the pool serves with both keys", async () => {
        const options = await parse({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", STARCI_AI_KEY: "starci" })

        expect(options.gateway?.mountedKeys.map((key) => ({ ...key, secret: key.secret.reveal() }))).toEqual([
            { label: "nivo", secret: "starci", profiles: ["work", "embed-oa", "sonnet", "haiku", "auto-light", "auto-heavy"] },
        ])
    })

    it("Anthropic alone: chat profiles only (embeddings are not served)", async () => {
        const options = await parse({ ANTHROPIC_API_KEY: "a", STARCI_AI_KEY: "starci" })

        expect(options.gateway?.mountedKeys[0]?.profiles).toEqual(["work", "sonnet", "haiku", "auto-light", "auto-heavy"])
    })

    it("OpenAI alone: the pinned embeddings profile only (no chat profile, nothing switches vendor)", async () => {
        const options = await parse({ OPENAI_API_KEY: "o", STARCI_AI_KEY: "starci" })

        expect(options.gateway?.mountedKeys[0]?.profiles).toEqual(["embed-oa"])
    })

    it("keeps the default key file and reads no port (it is the app port plus one)", async () => {
        const options = await parse({ OPENAI_API_KEY: "o" })

        expect(options.gateway).toEqual({ keysPath: "ai-router-keys.sqlite", mountedKeys: [] })
    })

    it("takes the key file from the environment", async () => {
        const options = await parse({ ANTHROPIC_API_KEY: "a", AI_ROUTER_KEYS_PATH: "/data/keys.sqlite" })

        expect(options.gateway?.keysPath).toBe("/data/keys.sqlite")
    })
})

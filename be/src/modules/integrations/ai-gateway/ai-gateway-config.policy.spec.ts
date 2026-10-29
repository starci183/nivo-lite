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

describe("aiGatewayOf", () => {
    describe("no upstream key", () => {
        it("parses an empty pool with no gateway, so the app boots without AI", async () => {
            const options = await parse({})

            expect(options.providers).toEqual([])
            expect(options.gateway).toBeNull()
            expect(options.models).toEqual({
                work: "deepseek/deepseek-v4.1-flash",
                embed: "qwen/qwen3-embedding-8b",
            })
        })
    })

    describe("an upstream key", () => {
        it("keeps OPENROUTER_API_KEY as the upstream key on the public OpenRouter endpoint", async () => {
            const options = await parse({ OPENROUTER_API_KEY: "sk-or" })

            expect(options.providers).toHaveLength(1)
            expect(options.providers[0]).toMatchObject({ id: "upstream", baseUrl: "https://openrouter.ai/api/v1" })
            expect(options.providers[0]?.keys.map((key) => [key.alias, key.secret.reveal()])).toEqual([
                ["OPENROUTER_API_KEY", "sk-or"],
            ])
        })

        it("lets LLM_* move the endpoint, the key and the work model", async () => {
            const options = await parse({
                LLM_API_KEY: "sk-x",
                LLM_BASE_URL: "https://llm.test/v1///",
                LLM_MODEL: "m-work",
                EMBEDDING_MODEL: "m-embed",
            })

            expect(options.providers[0]).toMatchObject({ baseUrl: "https://llm.test/v1" })
            expect(options.models).toEqual({ work: "m-work", embed: "m-embed" })
        })

        it("falls back to OpenRouter for a base URL that is not http(s)", async () => {
            const options = await parse({ OPENROUTER_API_KEY: "k", LLM_BASE_URL: "ftp://x" })

            expect(options.providers[0]?.baseUrl).toBe("https://openrouter.ai/api/v1")
        })

        it("gives embeddings their own provider when EMBEDDING_BASE_URL is declared, with the upstream key by default", async () => {
            const options = await parse({
                OPENROUTER_API_KEY: "k",
                EMBEDDING_BASE_URL: "http://ollama.test/v1",
            })

            expect(options.providers.map((provider) => provider.id)).toEqual(["upstream", "embeddings"])
            expect(options.providers[1]).toMatchObject({ baseUrl: "http://ollama.test/v1" })
            expect(options.providers[1]?.keys[0]?.alias).toBe("OPENROUTER_API_KEY")
        })
    })

    describe("the gateway", () => {
        it("keeps the default key file and no admin API, and reads no port (it is the app port plus one)", async () => {
            const options = await parse({ OPENROUTER_API_KEY: "k" })

            expect(options.gateway).toEqual({ keysPath: "ai-router-keys.sqlite", adminToken: null })
        })

        it("takes the key file and the admin token from the environment", async () => {
            const options = await parse({
                OPENROUTER_API_KEY: "k",
                AI_ROUTER_KEYS_PATH: "/data/keys.sqlite",
                AI_ROUTER_ADMIN_TOKEN: "admin",
            })

            expect(options.gateway?.keysPath).toBe("/data/keys.sqlite")
            expect(options.gateway?.adminToken?.reveal()).toBe("admin")
        })
    })
})

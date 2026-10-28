import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import type { AiPoolOptions } from "./ai-pool.options"
import { aiPoolOf } from "./ai-pool-config.policy"

const SUBJECT = Symbol("ai-pool-config.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { aiPoolOf } }],
    }).compile()
    return moduleRef.get<{ aiPoolOf: typeof aiPoolOf }>(SUBJECT)
}

const parse = async (values: Readonly<Record<string, string>>): Promise<AiPoolOptions> =>
    (await buildSubject()).aiPoolOf(new EnvSource(values))

/** The aliases of a provider's keys and the secrets behind them, in pool order. */
const keysOf = (options: AiPoolOptions, id: string): Array<[string, string]> =>
    [...options.chat, options.embedding]
        .filter((provider) => provider.id === id)
        .flatMap((provider) => provider.keys.map((key): [string, string] => [key.alias, key.secret.reveal()]))

describe("aiPoolOf", () => {
    describe("no key", () => {
        it("parses an empty pool with the public defaults, so the app boots without AI", async () => {
            const options = await parse({})

            expect(options.chat.map((provider) => [provider.id, provider.keys.length])).toEqual([
                ["deepseek", 0],
                ["openrouter", 0],
            ])
            expect(options.chat[0]).toMatchObject({
                baseUrl: "https://api.deepseek.com/v1",
                model: "deepseek-chat",
                smartModel: "deepseek-reasoner",
            })
            expect(options.chat[1]).toMatchObject({
                baseUrl: "https://openrouter.ai/api/v1",
                model: "deepseek/deepseek-v4.1-flash",
            })
            expect(options.embedding).toMatchObject({
                id: "embeddings",
                baseUrl: "https://openrouter.ai/api/v1",
                model: "qwen/qwen3-embedding-8b",
                keys: [],
            })
        })
    })
})

describe("aiPoolOf", () => {
    describe("DeepSeek keys", () => {
        it("takes the one DEEPSEEK_API_KEY, named by its variable", async () => {
            expect(keysOf(await parse({ DEEPSEEK_API_KEY: "sk-one" }), "deepseek")).toEqual([
                ["DEEPSEEK_API_KEY", "sk-one"],
            ])
        })

        it("reads every variable DEEPSEEK_API_KEYS names, then the single key, each variable once", async () => {
            const options = await parse({
                DEEPSEEK_API_KEYS: " DEEPSEEK_KEY_A, DEEPSEEK_KEY_B ,,DEEPSEEK_API_KEY",
                DEEPSEEK_KEY_A: "sk-a",
                DEEPSEEK_KEY_B: "sk-b",
                DEEPSEEK_API_KEY: "sk-c",
            })

            expect(keysOf(options, "deepseek")).toEqual([
                ["DEEPSEEK_KEY_A", "sk-a"],
                ["DEEPSEEK_KEY_B", "sk-b"],
                ["DEEPSEEK_API_KEY", "sk-c"],
            ])
        })

        it("takes a listed entry that is not a variable name as the key itself, named by its place", async () => {
            const options = await parse({
                DEEPSEEK_API_KEYS: "sk-first,DEEPSEEK_KEY_B,sk-third",
                DEEPSEEK_KEY_B: "sk-b",
            })

            expect(keysOf(options, "deepseek")).toEqual([
                ["deepseek-1", "sk-first"],
                ["DEEPSEEK_KEY_B", "sk-b"],
                ["deepseek-3", "sk-third"],
            ])
        })

        it("stops boot naming a listed variable that is not set", async () => {
            await expect(parse({ DEEPSEEK_API_KEYS: "DEEPSEEK_KEY_MISSING" })).rejects.toMatchObject({
                code: "CONFIG_KEY_MISSING",
                params: { key: "DEEPSEEK_KEY_MISSING" },
            })
        })
    })
})

describe("aiPoolOf", () => {
    describe("DeepSeek with the OpenRouter fallback", () => {
        it("keys both chat providers, DeepSeek first, and keeps the OpenRouter-compatible endpoint settings", async () => {
            const options = await parse({
                DEEPSEEK_API_KEY: "sk-ds",
                OPENROUTER_API_KEY: "sk-or",
                LLM_API_KEY: "sk-llm",
                LLM_BASE_URL: "https://gateway.test/api/v1//",
                LLM_MODEL: "deepseek/deepseek-chat-v3",
            })

            expect(options.chat.map((provider) => provider.id)).toEqual(["deepseek", "openrouter"])
            expect(keysOf(options, "deepseek")).toEqual([["DEEPSEEK_API_KEY", "sk-ds"]])
            expect(keysOf(options, "openrouter")).toEqual([
                ["LLM_API_KEY", "sk-llm"],
                ["OPENROUTER_API_KEY", "sk-or"],
            ])
            expect(options.chat[1]).toMatchObject({
                baseUrl: "https://gateway.test/api/v1",
                model: "deepseek/deepseek-chat-v3",
            })
        })

        it("falls back to the public origin when the declared base URL is not http(s)", async () => {
            expect((await parse({ LLM_BASE_URL: "ftp://x.test" })).chat[1]?.baseUrl).toBe(
                "https://openrouter.ai/api/v1",
            )
            expect((await parse({ LLM_BASE_URL: "not a url" })).chat[1]?.baseUrl).toBe("https://openrouter.ai/api/v1")
        })
    })
})

describe("aiPoolOf", () => {
    describe("embeddings", () => {
        it("keeps its own endpoint and the first declared of its own, OpenRouter's and OpenAI's key", async () => {
            const options = await parse({
                EMBEDDING_API_KEY: "ollama",
                EMBEDDING_BASE_URL: "http://ollama.local:11434/v1/",
                EMBEDDING_MODEL: "qwen3-embedding:8b",
                OPENROUTER_API_KEY: "sk-or",
            })

            expect(options.embedding).toMatchObject({
                baseUrl: "http://ollama.local:11434/v1",
                model: "qwen3-embedding:8b",
            })
            expect(keysOf(options, "embeddings")).toEqual([["EMBEDDING_API_KEY", "ollama"]])
        })

        it("embeds with the OpenRouter or OpenAI key when it has none of its own, never with a DeepSeek key", async () => {
            expect(keysOf(await parse({ OPENROUTER_API_KEY: "sk-or" }), "embeddings")).toEqual([
                ["OPENROUTER_API_KEY", "sk-or"],
            ])
            expect(keysOf(await parse({ OPENAI_API_KEY: "sk-oa" }), "embeddings")).toEqual([
                ["OPENAI_API_KEY", "sk-oa"],
            ])
            expect(keysOf(await parse({ DEEPSEEK_API_KEY: "sk-ds" }), "embeddings")).toEqual([])
        })
    })
})

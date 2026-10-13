import { Test } from "@nestjs/testing"
import { EnvSource, Secret } from "@modules/platform/config"
import { parseLlmConfig } from "./llm.config"

const LLM_CONFIG = Symbol("LLM_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: LLM_CONFIG, useFactory: parseLlmConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(LLM_CONFIG)
}

const openRouter = {
    embedding: {
        apiKey: null,
        baseUrl: "https://openrouter.ai/api/v1",
        model: "qwen/qwen3-embedding-8b",
    },
    chat: {
        apiKey: null,
        baseUrl: "https://openrouter.ai/api/v1",
        model: "deepseek/deepseek-chat",
    },
}

describe("parseLlmConfig", () => {
    it("answers nothing and uses the OpenRouter defaults when no key is declared", async () => {
        await expect(read({})).resolves.toEqual(openRouter)
    })

    it("takes the first declared key and ignores a base address that is not http", async () => {
        await expect(
            read({
                OPENAI_API_KEY: "openai-1",
                DEEPSEEK_API_KEY: "deepseek-1",
                EMBEDDING_BASE_URL: "ftp://embed.example",
                LLM_BASE_URL: "not a url",
                EMBEDDING_MODEL: "embed-1",
            }),
        ).resolves.toEqual({
            embedding: {
                apiKey: new Secret("openai-1"),
                baseUrl: "https://openrouter.ai/api/v1",
                model: "embed-1",
            },
            chat: {
                apiKey: new Secret("deepseek-1"),
                baseUrl: "https://openrouter.ai/api/v1",
                model: "deepseek/deepseek-chat",
            },
        })
    })

    it("prefers the dedicated keys and strips a trailing slash from an http base", async () => {
        await expect(
            read({
                EMBEDDING_API_KEY: "embed-key",
                OPENROUTER_API_KEY: "shared-key",
                LLM_API_KEY: "chat-key",
                EMBEDDING_BASE_URL: "http://embed.example/v1/",
                LLM_BASE_URL: "https://chat.example/v1",
                LLM_MODEL: "chat-1",
            }),
        ).resolves.toEqual({
            embedding: {
                apiKey: new Secret("embed-key"),
                baseUrl: "http://embed.example/v1",
                model: "qwen/qwen3-embedding-8b",
            },
            chat: {
                apiKey: new Secret("chat-key"),
                baseUrl: "https://chat.example/v1",
                model: "chat-1",
            },
        })
    })
})

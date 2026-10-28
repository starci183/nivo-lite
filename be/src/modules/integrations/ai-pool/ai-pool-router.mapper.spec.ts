import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import type { KeyConfig } from "@starci/ai-router"
import type { AiPoolOptions, AiPoolProvider } from "./ai-pool.options"
import { chatModelOrder, chatProviderIds, routerOptionsOf } from "./ai-pool-router.mapper"

const provider = (
    id: string,
    model: string,
    keys: ReadonlyArray<string>,
    smartModel: string | null = null,
): AiPoolProvider => ({
    id,
    baseUrl: `https://${id}.test/v1`,
    keys: keys.map((value, index) => ({ alias: `${id}-${index + 1}`, secret: new Secret(value) })),
    model,
    smartModel,
})

const optionsOf = (
    deepseek: ReadonlyArray<string>,
    openrouter: ReadonlyArray<string>,
    embedding: ReadonlyArray<string>,
) =>
    ({
        chat: [
            provider("deepseek", "deepseek-chat", deepseek, "deepseek-reasoner"),
            provider("openrouter", "deepseek/deepseek-v4.1-flash", openrouter),
        ],
        embedding: provider("embeddings", "qwen/qwen3-embedding-8b", embedding),
    }) satisfies AiPoolOptions

const resolved = (key: KeyConfig | undefined): Promise<string | undefined> =>
    Promise.resolve(key !== undefined && "resolve" in key ? key.resolve() : undefined)

const SUBJECT = Symbol("ai-pool-router.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { routerOptionsOf, chatModelOrder, chatProviderIds } }],
    }).compile()
    return moduleRef.get<{
        routerOptionsOf: typeof routerOptionsOf
        chatModelOrder: typeof chatModelOrder
        chatProviderIds: typeof chatProviderIds
    }>(SUBJECT)
}

describe("routerOptionsOf", () => {
    it("registers no router while no provider holds a key", async () => {
        const subject = await buildSubject()
        expect(subject.routerOptionsOf(optionsOf([], [], []))).toBeNull()
    })

    it("builds DeepSeek with fast and smart models, keys read from the boot secrets by alias, and no content in telemetry", async () => {
        const subject = await buildSubject()
        const router = subject.routerOptionsOf(optionsOf(["sk-a", "sk-b"], [], []))

        expect(router?.telemetry).toEqual({ includeContent: false })
        expect(router?.providers.map((entry) => entry.id)).toEqual(["deepseek"])
        const deepseek = router?.providers[0]
        expect(deepseek?.baseUrl).toBe("https://deepseek.test/v1")
        expect(deepseek?.models).toEqual([
            { id: "deepseek-chat", aliases: ["fast"] },
            { id: "deepseek-reasoner", aliases: ["smart"], capabilities: ["chat", "streaming"] },
        ])
        expect(deepseek?.keys.map((key) => key.alias)).toEqual(["deepseek-1", "deepseek-2"])
        await expect(resolved(deepseek?.keys[1])).resolves.toBe("sk-b")
    })

    it("adds the keyed OpenRouter fallback and the embeddings endpoint with an embeddings-only model", async () => {
        const subject = await buildSubject()
        const router = subject.routerOptionsOf(optionsOf(["sk-a"], ["sk-or"], ["sk-or"]))

        expect(router?.providers.map((entry) => entry.id)).toEqual(["deepseek", "openrouter", "embeddings"])
        expect(router?.providers[1]?.models).toEqual([{ id: "deepseek/deepseek-v4.1-flash" }])
        expect(router?.providers[2]?.models).toEqual([{ id: "qwen/qwen3-embedding-8b", capabilities: ["embeddings"] }])
    })

    it("registers the embeddings endpoint alone when only it holds a key", async () => {
        const subject = await buildSubject()
        expect(subject.routerOptionsOf(optionsOf([], [], ["ollama"]))?.providers.map((entry) => entry.id)).toEqual([
            "embeddings",
        ])
    })
})

describe("chatModelOrder and chatProviderIds", () => {
    it("tries DeepSeek first and OpenRouter after it, only for keyed providers", async () => {
        const subject = await buildSubject()
        const both = optionsOf(["sk-a"], ["sk-or"], [])

        expect(subject.chatModelOrder(both)).toEqual(["deepseek-chat", "deepseek/deepseek-v4.1-flash"])
        expect(subject.chatProviderIds(both)).toEqual(["deepseek", "openrouter"])
        expect(subject.chatModelOrder(optionsOf([], ["sk-or"], []))).toEqual(["deepseek/deepseek-v4.1-flash"])
        expect(subject.chatModelOrder(optionsOf([], [], ["x"]))).toEqual([])
    })

    it("names a model two providers share once", async () => {
        const subject = await buildSubject()
        const options: AiPoolOptions = {
            chat: [provider("deepseek", "deepseek-chat", ["a"]), provider("openrouter", "deepseek-chat", ["b"])],
            embedding: provider("embeddings", "e", []),
        }

        expect(subject.chatModelOrder(options)).toEqual(["deepseek-chat"])
    })
})

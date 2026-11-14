import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import type { AiGatewayOptions, AiGatewayProvider } from "./ai-gateway.options"
import { routerOptionsOf } from "./ai-gateway-router.mapper"

const SUBJECT = Symbol("ai-gateway-router.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { routerOptionsOf } }],
    }).compile()
    return moduleRef.get<{ routerOptionsOf: typeof routerOptionsOf }>(SUBJECT)
}

const provider = (id: "anthropic" | "openai"): AiGatewayProvider => ({
    id,
    kind: id,
    baseUrl: `https://${id}.test/v1`,
    keys: [{ alias: `${id.toUpperCase()}_KEY`, secret: new Secret(`sk-${id}`) }],
})

const optionsOf = (providers: ReadonlyArray<AiGatewayProvider>): AiGatewayOptions => ({
    providers,
    models: { work: "m-work", strong: "m-strong" },
    gateway: null,
})

describe("routerOptionsOf", () => {
    it("builds no pool without a provider, so no router is registered", async () => {
        const subject = await buildSubject()

        expect(subject.routerOptionsOf(optionsOf([]))).toBeNull()
    })

    it("with OpenAI alone serves the pinned `embed-oa` only: text-embedding-3-small, its identity and 1536 dimensions", async () => {
        const subject = await buildSubject()

        const router = subject.routerOptionsOf(optionsOf([provider("openai")]))

        expect(router?.providers.map((entry) => [entry.id, entry.kind, entry.models])).toEqual([
            [
                "openai",
                "openai",
                [
                    {
                        id: "text-embedding-3-small",
                        identity: "text-embedding-3-small",
                        dimensions: 1536,
                        capabilities: ["embeddings"],
                        cost: { input: 0.02, output: 0 },
                    },
                ],
            ],
        ])
        expect(router?.profiles).toEqual({
            "embed-oa": { pinned: true, candidates: [{ provider: "openai", model: "text-embedding-3-small" }], allowFallback: false },
        })
    })

})

describe("routerOptionsOf: chat profiles and keys", () => {
    it("puts every chat profile on Anthropic: `work` cheap then strong, explicit profiles alone, Auto in both orders", async () => {
        const subject = await buildSubject()

        const router = subject.routerOptionsOf(
            optionsOf([provider("anthropic"), provider("openai")]),
        )

        expect(router?.providers.map((entry) => [entry.id, entry.kind ?? null, entry.models.map((model) => model.id)])).toEqual([
            ["anthropic", "anthropic", ["m-work", "m-strong"]],
            ["openai", "openai", ["text-embedding-3-small"]],
        ])
        expect(router?.providers[0]).toMatchObject({ defaultMaxTokens: 32_000 })
        expect(router?.providers[0]?.headers).toBeUndefined()
        expect(router?.providers[1]?.headers).toBeUndefined()
        const alone = (model: string) => ({
            candidates: [{ provider: "anthropic", model }],
            allowFallback: false,
            maxAttempts: 1,
            timeoutMs: 125_000,
            deadlineMs: 130_000,
        })
        const both = (first: string, second: string) => ({
            candidates: [
                { provider: "anthropic", model: first },
                { provider: "anthropic", model: second },
            ],
            allowFallback: true,
            maxAttempts: 2,
            timeoutMs: 125_000,
            deadlineMs: 130_000,
        })
        expect(router?.profiles).toEqual({
            work: {
                candidates: [
                    { provider: "anthropic", model: "m-work" },
                    { provider: "anthropic", model: "m-strong" },
                ],
                maxAttempts: 1,
                timeoutMs: 125_000,
                deadlineMs: 130_000,
            },
            "embed-oa": { pinned: true, candidates: [{ provider: "openai", model: "text-embedding-3-small" }], allowFallback: false },
            sonnet: alone("m-strong"),
            haiku: alone("m-work"),
            "auto-light": both("m-work", "m-strong"),
            "auto-heavy": both("m-strong", "m-work"),
        })
    })

    it("reads each key from its secret and never records prompt content", async () => {
        const subject = await buildSubject()

        const router = subject.routerOptionsOf(optionsOf([provider("openai")]))
        const key = router?.providers[0]?.keys[0]

        expect(key?.alias).toBe("OPENAI_KEY")
        expect(await (key !== undefined && "resolve" in key ? key.resolve() : undefined)).toBe("sk-openai")
        expect(router?.telemetry).toEqual({ includeContent: false })
    })
})

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

const provider = (id: string): AiGatewayProvider => ({
    id,
    baseUrl: `https://${id}.test/v1`,
    keys: [{ alias: `${id.toUpperCase()}_KEY`, secret: new Secret(`sk-${id}`) }],
})

const optionsOf = (providers: ReadonlyArray<AiGatewayProvider>): AiGatewayOptions => ({
    providers,
    models: { work: "m-work", embed: "m-embed", strong: "m-strong" },
    gateway: null,
})

describe("routerOptionsOf", () => {
    it("builds no pool without a provider, so no router is registered", async () => {
        const subject = await buildSubject()

        expect(subject.routerOptionsOf(optionsOf([]))).toBeNull()
    })

    it("serves chat and embeddings from the one upstream provider behind the work and embed profiles", async () => {
        const subject = await buildSubject()

        const router = subject.routerOptionsOf(optionsOf([provider("upstream")]))

        expect(router?.providers.map((entry) => [entry.id, entry.models.map((model) => model.id)])).toEqual([
            ["upstream", ["m-work", "m-embed"]],
        ])
        const only = (model: string) => ({
            candidates: [{ provider: "upstream", model }],
            allowFallback: false,
            maxAttempts: 1,
            timeoutMs: 125_000,
            deadlineMs: 130_000,
        })
        expect(router?.profiles).toEqual({
            work: { model: "m-work", providers: ["upstream"], maxAttempts: 1, timeoutMs: 125_000, deadlineMs: 130_000 },
            embed: { model: "m-embed", allowFallback: false, providers: ["upstream"] },
            // Without an Anthropic key: no `sonnet` profile, and Auto is the upstream alone.
            deepseek: only("m-work"),
            "auto-light": only("m-work"),
            "auto-heavy": only("m-work"),
        })
    })

    it("sends embeddings to their own provider when there is one, and chat only to upstream", async () => {
        const subject = await buildSubject()

        const router = subject.routerOptionsOf(optionsOf([provider("upstream"), provider("embeddings")]))

        expect(router?.providers.map((entry) => [entry.id, entry.models.map((model) => model.id)])).toEqual([
            ["upstream", ["m-work"]],
            ["embeddings", ["m-embed"]],
        ])
        expect(router?.profiles?.embed).toMatchObject({ providers: ["embeddings"] })
    })

    it("adds Anthropic with the strong model, an explicit `sonnet` profile that never falls back, and Auto in both orders", async () => {
        const subject = await buildSubject()

        const router = subject.routerOptionsOf(
            optionsOf([provider("upstream"), { ...provider("anthropic"), kind: "anthropic" }]),
        )

        expect(router?.providers.map((entry) => [entry.id, entry.kind ?? null, entry.models.map((model) => model.id)])).toEqual([
            ["upstream", null, ["m-work", "m-embed"]],
            ["anthropic", "anthropic", ["m-strong"]],
        ])
        expect(router?.providers[1]).toMatchObject({ defaultMaxTokens: 32_000 })
        expect(router?.providers[1]?.headers).toBeUndefined()
        expect(router?.profiles?.sonnet).toEqual({
            candidates: [{ provider: "anthropic", model: "m-strong" }],
            allowFallback: false,
            maxAttempts: 1,
            timeoutMs: 125_000,
            deadlineMs: 130_000,
        })
        expect(router?.profiles?.deepseek).toMatchObject({ candidates: [{ provider: "upstream", model: "m-work" }], allowFallback: false })
        expect(router?.profiles?.["auto-light"]).toMatchObject({
            candidates: [
                { provider: "upstream", model: "m-work" },
                { provider: "anthropic", model: "m-strong" },
            ],
            allowFallback: true,
            maxAttempts: 2,
        })
        expect(router?.profiles?.["auto-heavy"]).toMatchObject({
            candidates: [
                { provider: "anthropic", model: "m-strong" },
                { provider: "upstream", model: "m-work" },
            ],
            allowFallback: true,
            maxAttempts: 2,
        })
        // The fixed tasks of the app are unchanged by the second provider.
        expect(router?.profiles?.work).toEqual({
            model: "m-work",
            providers: ["upstream"],
            maxAttempts: 1,
            timeoutMs: 125_000,
            deadlineMs: 130_000,
        })
    })

    it("reads each key from its secret and never records prompt content", async () => {
        const subject = await buildSubject()

        const router = subject.routerOptionsOf(optionsOf([provider("upstream")]))
        const key = router?.providers[0]?.keys[0]

        expect(key?.alias).toBe("UPSTREAM_KEY")
        expect(await (key !== undefined && "resolve" in key ? key.resolve() : undefined)).toBe("sk-upstream")
        expect(router?.telemetry).toEqual({ includeContent: false })
    })
})

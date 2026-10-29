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
    models: { work: "m-work", embed: "m-embed" },
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
        expect(router?.profiles).toEqual({
            work: { model: "m-work", providers: ["upstream"] },
            embed: { model: "m-embed", allowFallback: false, providers: ["upstream"] },
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

    it("reads each key from its secret and never records prompt content", async () => {
        const subject = await buildSubject()

        const router = subject.routerOptionsOf(optionsOf([provider("upstream")]))
        const key = router?.providers[0]?.keys[0]

        expect(key?.alias).toBe("UPSTREAM_KEY")
        expect(await (key !== undefined && "resolve" in key ? key.resolve() : undefined)).toBe("sk-upstream")
        expect(router?.telemetry).toEqual({ includeContent: false })
    })
})

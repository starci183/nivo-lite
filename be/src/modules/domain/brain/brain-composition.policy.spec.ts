import { Test } from "@nestjs/testing"
import { derivationsProvidersOf } from "./brain-composition.policy"
import { BrainPolicyDerivationsService } from "./brain-policy-derivations.service"
import { BrainModule } from "./brain.module"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { ModelJsonService } from "./model-json.service"

const SUBJECT = Symbol("brain-composition.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { derivationsProvidersOf } }],
    }).compile()
    return moduleRef.get<{ derivationsProvidersOf: typeof derivationsProvidersOf }>(SUBJECT)
}

describe("derivationsProvidersOf: the derivations mode of the apps that write facts but run no pass", () => {
    it("the mcp (vectors) also listens for the vectors, so a fact maintain puts in force there gets its vector at once", async () => {
        const subject = await buildSubject()

        expect(subject.derivationsProvidersOf(true)).toEqual([
            BrainPolicyDerivationsService,
            FactEmbeddingsService,
            ModelJsonService,
        ])
    })

    it("the cli (no usage meter there) registers the policy derivations alone; the api's timed sweep embeds its facts", async () => {
        const subject = await buildSubject()

        expect(subject.derivationsProvidersOf(false)).toEqual([BrainPolicyDerivationsService])
    })

    it("is what BrainModule.register provides in the derivations mode, which still exports the derivations alone", async () => {
        const subject = await buildSubject()
        const mcp = BrainModule.register({ derivationsOnly: true, vectors: true })
        const cli = BrainModule.register({ derivationsOnly: true })

        expect(mcp.providers).toEqual(expect.arrayContaining([...subject.derivationsProvidersOf(true)]))
        expect(cli.providers).not.toContain(FactEmbeddingsService)
        expect(mcp.exports).toEqual([BrainPolicyDerivationsService])
    })
})

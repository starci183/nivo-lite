import { BrainModule } from "./brain.module"
import { BrainPolicyDerivationsService } from "./brain-policy-derivations.service"
import { BrainService } from "./brain.service"
import { FactEmbeddingsService } from "./fact-embeddings.service"

describe("BrainModule derivations only (the cli: a fact change queues a policy pass for the api's worker)", () => {
    it("registers and exports the policy derivations alone: no vectors listener (the vector reconcile embeds what such an app writes)", () => {
        const module = BrainModule.register({ derivationsOnly: true })
        const providers = module.providers ?? []

        expect(providers).toContain(BrainPolicyDerivationsService)
        expect(providers).not.toContain(FactEmbeddingsService)
        expect(providers).not.toContain(BrainService)
        expect(module.exports).toEqual([BrainPolicyDerivationsService])
    })
})

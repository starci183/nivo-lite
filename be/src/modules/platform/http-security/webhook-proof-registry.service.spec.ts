import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { WebhookProofRegistryService } from "./webhook-proof-registry.service"
import type { WebhookProof } from "./webhook-proof.port"

const proofOf = (provider: string): WebhookProof => ({ provider, prove: () => Promise.resolve(true) })

describe("WebhookProofRegistryService", () => {
    it("answers the proof registered for a provider and nothing for another", () => {
        const registry = new WebhookProofRegistryService()
        const proof = proofOf("zalo")

        registry.add(proof)

        expect(registry.get("zalo")).toBe(proof)
        expect(registry.get("telegram")).toBeUndefined()
    })

    it("refuses a second proof for the same provider", () => {
        const registry = new WebhookProofRegistryService()
        registry.add(proofOf("zalo"))

        let code: unknown
        try {
            registry.add(proofOf("zalo"))
        } catch (error) {
            code = error instanceof HttpSecurityError ? error.code : error
        }

        expect(code).toBe(HttpSecurityErrorCode.WebhookProviderUnknown)
    })
})

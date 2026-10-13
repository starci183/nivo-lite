import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { WebhookProofRegistryService } from "./webhook-proof-registry.service"
import type { WebhookProof } from "./webhook-proof.port"

const proofOf = (provider: string): WebhookProof => ({ provider, prove: () => Promise.resolve(true) })

describe("WebhookProofRegistryService", () => {
    it("asks the proof registered for a provider with the request", async () => {
        const registry = new WebhookProofRegistryService()
        const prove = jest.fn().mockResolvedValue(false)
        registry.add({ provider: "zalo", prove })
        const request = { scope: "c1", rawBody: undefined, signature: "mac", timestamp: undefined }

        await expect(registry.prove("zalo", request)).resolves.toBe(false)

        expect(prove.mock.calls).toEqual([[request]])
    })

    it("refuses a provider with no proof registered", async () => {
        const registry = new WebhookProofRegistryService()

        await expect(
            registry.prove("telegram", { scope: "c1", rawBody: undefined, signature: undefined, timestamp: undefined }),
        ).rejects.toMatchObject({ code: HttpSecurityErrorCode.WebhookProviderUnknown })
    })

    it("refuses a second proof for the same provider", () => {
        const registry = new WebhookProofRegistryService()
        registry.add(proofOf("zalo"))

        expect(() => registry.add(proofOf("zalo"))).toThrow(HttpSecurityError)
        expect(() => registry.add(proofOf("zalo"))).toThrow(
            expect.objectContaining({ code: HttpSecurityErrorCode.WebhookProviderUnknown }),
        )
    })
})

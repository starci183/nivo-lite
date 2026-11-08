import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { HttpSecurityError, HttpSecurityErrorCode, WEBHOOK_PROOF_REGISTRY } from "@modules/platform/http-security"
import { ScopedWebhookVerifier } from "./scoped-webhook-verifier.service"
import type { WebhookProofRegistry } from "@modules/platform/http-security"

const BODY = Buffer.from(JSON.stringify({ eventId: "evt-1", status: "confirmed" }))

/** The refusal the registry answers: the error the platform raises, standing in with its code. */
const refusal = (code: HttpSecurityErrorCode): HttpSecurityError => {
    const failure = mock<HttpSecurityError>({ code })
    Object.setPrototypeOf(failure, HttpSecurityError.prototype)
    return failure
}

/** A registry whose proof answers with the refusal of the code. */
const refusing = (code: HttpSecurityErrorCode): WebhookProofRegistry["verify"] =>
    jest.fn<Promise<void>, Parameters<WebhookProofRegistry["verify"]>>().mockRejectedValue(refusal(code))

/** The registry answer when no proof is registered for the provider. */
const unknownProvider = refusing(HttpSecurityErrorCode.WebhookProviderUnknown)

const build = async (prove: WebhookProofRegistry["verify"] = unknownProvider) => {
    const registry = mock<WebhookProofRegistry>({ verify: prove })
    const moduleRef = await Test.createTestingModule({
        providers: [ScopedWebhookVerifier, { provide: WEBHOOK_PROOF_REGISTRY, useValue: registry }],
    }).compile()
    return moduleRef.get(ScopedWebhookVerifier)
}

describe("ScopedWebhookVerifier scoped proofs", () => {
    const scoped = {
        provider: "zalo",
        scope: "connection-1",
        rawBody: BODY,
        signature: "mac",
        timestamp: undefined,
    }

    it("accepts a delivery the registered proof accepts and hands the proof the scope and the exact bytes", async () => {
        const prove = jest.fn<Promise<void>, Parameters<WebhookProofRegistry["verify"]>>()
        prove.mockResolvedValue(undefined)
        const service = await build(prove)

        await expect(service.verify(scoped)).resolves.toBeUndefined()

        expect(prove).toHaveBeenCalledWith("zalo", {
            scope: "connection-1",
            rawBody: BODY,
            signature: "mac",
            timestamp: undefined,
        })
    })

    it("refuses a delivery the registered proof rejects", async () => {
        const service = await build(refusing(HttpSecurityErrorCode.WebhookSignatureInvalid))

        await expect(service.verify(scoped)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.WebhookSignatureInvalid,
        })
    })

    it("refuses a provider with no registered proof", async () => {
        const service = await build()

        await expect(service.verify(scoped)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.WebhookProviderUnknown,
        })
    })
})

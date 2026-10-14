import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WEBHOOK_PROOF_REGISTRY } from "@modules/platform/http-security"
import type { WebhookProofRegistry, WebhookProofRequest } from "@modules/platform/http-security"
import { CassoProofService } from "./casso-proof.service"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"

const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"
const RAW = Buffer.from('{"data":[]}')
const REQUEST: WebhookProofRequest = {
    scope: CONNECTION,
    rawBody: RAW,
    signature: "v2-signature",
    timestamp: "v1-secure-token",
}

const build = async () => {
    const paymentProof = mock<PaymentProofService>()
    paymentProof.proveCasso.mockResolvedValue({
        connection: { connectionId: CONNECTION, workspaceId: "ws-1" },
        body: { data: [] },
    })
    const registry = mock<WebhookProofRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CassoProofService,
            { provide: WEBHOOK_PROOF_REGISTRY, useValue: registry },
            { provide: PaymentProofService, useValue: paymentProof },
        ],
    }).compile()
    return { proof: moduleRef.get(CassoProofService), registry, paymentProof }
}

describe("CassoProofService", () => {
    it("registers itself for the casso door when the module starts", async () => {
        const { proof, registry } = await build()

        proof.onModuleInit()

        expect(proof.provider).toBe("casso")
        expect(registry.add).toHaveBeenCalledTimes(1)
        expect(registry.add).toHaveBeenCalledWith(proof)
    })

    it.each<[string, WebhookProofRequest]>([
        ["V2 signature", { ...REQUEST, timestamp: undefined }],
        ["V1 secure token", { ...REQUEST, signature: undefined }],
        ["both headers", REQUEST],
    ])("delegates the %s and exact raw body for the scoped connection", async (_name, request) => {
        const { proof, paymentProof } = await build()

        await expect(proof.prove(request)).resolves.toBe(true)

        expect(paymentProof.proveCasso).toHaveBeenCalledTimes(1)
        expect(paymentProof.proveCasso).toHaveBeenCalledWith({
            connectionId: CONNECTION,
            rawBody: RAW,
            signature: request.signature,
            secureToken: request.timestamp,
        })
    })

    it.each([BillingErrorCode.WebhookUnauthorized, BillingErrorCode.WebhookInvalid])(
        "returns false for a payment proof refusal with code %s",
        async (code) => {
            const { proof, paymentProof } = await build()
            paymentProof.proveCasso.mockRejectedValue(new BillingError({ code }))

            await expect(proof.prove(REQUEST)).resolves.toBe(false)
        },
    )

    it("lets the payment proof refuse missing bytes and headers", async () => {
        const { proof, paymentProof } = await build()
        paymentProof.proveCasso.mockRejectedValue(new BillingError({ code: BillingErrorCode.WebhookInvalid }))

        await expect(
            proof.prove({ scope: CONNECTION, rawBody: undefined, signature: undefined, timestamp: undefined }),
        ).resolves.toBe(false)

        expect(paymentProof.proveCasso).toHaveBeenCalledTimes(1)
        expect(paymentProof.proveCasso).toHaveBeenCalledWith({
            connectionId: CONNECTION,
            rawBody: undefined,
            signature: undefined,
            secureToken: undefined,
        })
    })

    it.each([
        new BillingError({ code: BillingErrorCode.CredentialUnreadable }),
        new Error("storage unavailable"),
        { code: BillingErrorCode.WebhookUnauthorized },
        null,
    ])("propagates any failure that is not a refusal BillingError: %p", async (failure) => {
        const { proof, paymentProof } = await build()
        paymentProof.proveCasso.mockRejectedValue(failure)

        await expect(proof.prove(REQUEST)).rejects.toBe(failure)
    })
})

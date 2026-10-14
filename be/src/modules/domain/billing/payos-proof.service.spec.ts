import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WEBHOOK_PROOF_REGISTRY } from "@modules/platform/http-security"
import type { WebhookProofRegistry, WebhookProofRequest } from "@modules/platform/http-security"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"
import { PayosProofService } from "./payos-proof.service"

const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"
const RAW_BODY = Buffer.from('{"data":{"orderCode":5},"signature":"body-signature"}')
const REQUEST: WebhookProofRequest = {
    scope: CONNECTION,
    rawBody: RAW_BODY,
    signature: "unused-header",
    timestamp: "unused-timestamp",
}

const build = async () => {
    const payments = mock<PaymentProofService>()
    const registry = mock<WebhookProofRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PayosProofService,
            { provide: WEBHOOK_PROOF_REGISTRY, useValue: registry },
            { provide: PaymentProofService, useValue: payments },
        ],
    }).compile()
    return { proof: moduleRef.get(PayosProofService), registry, payments }
}

describe("PayosProofService", () => {
    it("registers itself with the payos provider key when the module starts", async () => {
        const { proof, registry } = await build()

        proof.onModuleInit()

        expect(proof.provider).toBe("payos")
        expect(registry.add).toHaveBeenCalledTimes(1)
        expect(registry.add).toHaveBeenCalledWith(proof)
    })

    describe("prove", () => {
        it("accepts the existing payment proof and passes only the connection and exact raw bytes", async () => {
            const { proof, payments } = await build()
            payments.provePayos.mockResolvedValue({
                kind: "proven",
                connection: { connectionId: CONNECTION, workspaceId: "ws-1" },
                body: { data: { orderCode: 5 } },
            })

            await expect(proof.prove(REQUEST)).resolves.toBe(true)

            expect(payments.provePayos).toHaveBeenCalledTimes(1)
            expect(payments.provePayos).toHaveBeenCalledWith({ connectionId: CONNECTION, rawBody: RAW_BODY })
            expect(payments.provePayos.mock.calls[0]?.[0].rawBody).toBe(RAW_BODY)
        })

        it("accepts a payOS confirmation sample", async () => {
            const { proof, payments } = await build()
            payments.provePayos.mockResolvedValue({ kind: "sample" })

            await expect(proof.prove(REQUEST)).resolves.toBe(true)
        })

        it("delegates a missing raw body and absent headers to the existing payment verifier", async () => {
            const { proof, payments } = await build()
            payments.provePayos.mockRejectedValue(new BillingError({ code: BillingErrorCode.WebhookInvalid }))

            await expect(
                proof.prove({ scope: CONNECTION, rawBody: undefined, signature: undefined, timestamp: undefined }),
            ).resolves.toBe(false)
            expect(payments.provePayos).toHaveBeenCalledWith({ connectionId: CONNECTION, rawBody: undefined })
        })

        it.each([BillingErrorCode.WebhookUnauthorized, BillingErrorCode.WebhookInvalid])(
            "returns false for the payment verifier's %s refusal",
            async (code) => {
                const { proof, payments } = await build()
                payments.provePayos.mockRejectedValue(new BillingError({ code }))

                await expect(proof.prove(REQUEST)).resolves.toBe(false)
            },
        )

        it.each([BillingErrorCode.CredentialUnreadable, BillingErrorCode.FeedNotConfigured])(
            "propagates an unrelated %s billing failure",
            async (code) => {
                const { proof, payments } = await build()
                const cause = new BillingError({ code })
                payments.provePayos.mockRejectedValue(cause)

                await expect(proof.prove(REQUEST)).rejects.toBe(cause)
            },
        )

        it.each([
            new Error("verification failed"),
            { code: BillingErrorCode.WebhookUnauthorized },
            "verification failed",
            null,
            undefined,
        ])("propagates a thrown value that is not a billing refusal: %p", async (cause) => {
            const { proof, payments } = await build()
            payments.provePayos.mockRejectedValue(cause)

            await expect(proof.prove(REQUEST)).rejects.toBe(cause)
        })
    })
})

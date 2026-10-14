import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DomainError } from "@modules/platform/errors"
import { WEBHOOK_PROOF_REGISTRY } from "@modules/platform/http-security"
import type { WebhookProofRegistry, WebhookProofRequest } from "@modules/platform/http-security"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"
import { VietcombankProofService } from "./vietcombank-proof.service"

/** A failure of another capability: it is not a billing refusal and must reach the caller. */
class UnrelatedError extends DomainError<"UNRELATED"> {}

const REQUEST: WebhookProofRequest = {
    scope: "platform",
    rawBody: Buffer.from('{"amount":1000}'),
    signature: "bank-header",
    timestamp: "unused-timestamp",
}

const build = async () => {
    const payments = mock<PaymentProofService>()
    const registry = mock<WebhookProofRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VietcombankProofService,
            { provide: WEBHOOK_PROOF_REGISTRY, useValue: registry },
            { provide: PaymentProofService, useValue: payments },
        ],
    }).compile()
    return { proof: moduleRef.get(VietcombankProofService), registry, payments }
}

describe("VietcombankProofService", () => {
    it("registers itself with the vietcombank provider key when the module starts", async () => {
        const { proof, registry } = await build()

        proof.onModuleInit()

        expect(proof.provider).toBe("vietcombank")
        expect(registry.add).toHaveBeenCalledTimes(1)
        expect(registry.add).toHaveBeenCalledWith(proof)
    })

    describe("prove", () => {
        it("accepts the bank verifier's result using only the bank-secret header", async () => {
            const { proof, payments } = await build()
            payments.verifySimulatedBank.mockReturnValue(undefined)

            await expect(proof.prove(REQUEST)).resolves.toBe(true)

            expect(payments.verifySimulatedBank).toHaveBeenCalledTimes(1)
            expect(payments.verifySimulatedBank).toHaveBeenCalledWith(REQUEST.signature)
        })

        it("ignores the route scope, body and timestamp when checking the configured platform secret", async () => {
            const { proof, payments } = await build()
            payments.verifySimulatedBank.mockReturnValue(undefined)

            await expect(
                proof.prove({ ...REQUEST, scope: "another-scope", rawBody: undefined, timestamp: undefined }),
            ).resolves.toBe(true)
            expect(payments.verifySimulatedBank).toHaveBeenCalledWith(REQUEST.signature)
        })

        it("passes an absent bank-secret header through and returns false for the verifier's refusal", async () => {
            const { proof, payments } = await build()
            payments.verifySimulatedBank.mockImplementation(() => {
                throw new BillingError({ code: BillingErrorCode.WebhookUnauthorized })
            })

            await expect(proof.prove({ ...REQUEST, signature: undefined })).resolves.toBe(false)
            expect(payments.verifySimulatedBank).toHaveBeenCalledWith(undefined)
        })

        it.each([
            BillingErrorCode.WebhookInvalid,
            BillingErrorCode.CredentialUnreadable,
            BillingErrorCode.FeedNotConfigured,
        ])("propagates an unrelated %s billing failure", async (code) => {
            const { proof, payments } = await build()
            const cause = new BillingError({ code })
            payments.verifySimulatedBank.mockImplementation(() => {
                throw cause
            })

            await expect(proof.prove(REQUEST)).rejects.toBe(cause)
        })

        it("propagates a failure of another capability", async () => {
            const { proof, payments } = await build()
            const cause = new UnrelatedError({ code: "UNRELATED" })
            payments.verifySimulatedBank.mockImplementation(() => {
                throw cause
            })

            await expect(proof.prove(REQUEST)).rejects.toBe(cause)
        })
    })
})

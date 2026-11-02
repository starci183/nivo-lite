import { Test } from "@nestjs/testing"
import type { RawBodyRequest } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { Request } from "express"
import { GenericWebhookIntakeService } from "@modules/domain/agent-inbound"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { GenericHttpModule, webhookVerifiers } from "./generic-http.module"
import { GenericWebhook } from "./generic.webhook"

const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"
const BODY = Buffer.from('{"type":"invoice.paid"}')
const ROUTE = { connectionId: CONNECTION }
const SIGNATURE = "abc123"

const build = async () => {
    const signature = mock<ScopedWebhookVerifier>({ verify: jest.fn().mockResolvedValue(undefined) })
    const intake = mock<GenericWebhookIntakeService>({
        accept: jest.fn().mockResolvedValue(undefined),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GenericWebhook,
            { provide: ScopedWebhookVerifier, useValue: signature },
            { provide: GenericWebhookIntakeService, useValue: intake },
        ],
    }).compile()
    return { webhook: moduleRef.get(GenericWebhook), signature, intake }
}

describe("GenericWebhook", () => {
    it("proves the signature of the endpoint first and only then hands the delivery to the intake, answering nothing", async () => {
        const { webhook, signature, intake } = await build()
        const effects: Array<string> = []
        signature.verify.mockImplementation(() => {
            effects.push("verify")
            return Promise.resolve()
        })
        intake.accept.mockImplementation(() => {
            effects.push("accept")
            return Promise.resolve()
        })

        await expect(
            webhook.receive(mock<RawBodyRequest<Request>>({ rawBody: BODY }), ROUTE, SIGNATURE, "invoice.paid", "d-1"),
        ).resolves.toBeUndefined()

        expect(effects).toEqual(["verify", "accept"])
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "generic_webhook",
            scope: CONNECTION,
            rawBody: BODY,
            signature: SIGNATURE,
            timestamp: undefined,
        })
        expect(intake.accept).toHaveBeenCalledWith({
            endpoint: CONNECTION,
            rawBody: BODY,
            signature: SIGNATURE,
            eventType: "invoice.paid",
            deliveryKey: "d-1",
        })
    })

    it("refuses a delivery whose signature is not proven and never reaches the intake", async () => {
        const { webhook, signature, intake } = await build()
        const failure = new Error("invalid signature")
        signature.verify.mockRejectedValue(failure)

        await expect(webhook.receive(mock<RawBodyRequest<Request>>({ rawBody: BODY }), ROUTE, SIGNATURE)).rejects.toBe(
            failure,
        )
        expect(intake.accept).not.toHaveBeenCalled()
    })

    it("lets an intake failure travel up, so the sender retries and the idempotency key keeps the retry from writing twice", async () => {
        const { webhook, intake } = await build()
        const failure = new Error("outbox down")
        intake.accept.mockRejectedValue(failure)

        await expect(webhook.receive(mock<RawBodyRequest<Request>>({ rawBody: BODY }), ROUTE, SIGNATURE)).rejects.toBe(
            failure,
        )
    })
})

describe("GenericHttpModule proof declaration", () => {
    it("declares the exact domain verification method", () => {
        expect(webhookVerifiers).toEqual([ScopedWebhookVerifier.prototype.verify])
        expect(GenericHttpModule.register({}).module).toBe(GenericHttpModule)
    })
})

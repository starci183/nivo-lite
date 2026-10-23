import { ZaloHttpModule, webhookVerifiers } from "./zalo-http.module"
import { Test } from "@nestjs/testing"
import type { RawBodyRequest } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { Request } from "express"
import { ZaloInboxService } from "@modules/domain/zalo-inbox"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { ZaloWebhook } from "./zalo.webhook"

const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"
const BODY = Buffer.from('{"event_name":"user_send_text","message":{"text":"Price?"}}')
const ROUTE = { connectionId: CONNECTION }
const MAC = "connection-mac"

const build = async () => {
    const signature = mock<ScopedWebhookVerifier>()
    signature.verify.mockResolvedValue(undefined)
    const deliveries = mock<ZaloInboxService>()
    deliveries.acceptZaloDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloWebhook,
            { provide: ScopedWebhookVerifier, useValue: signature },
            { provide: ZaloInboxService, useValue: deliveries },
        ],
    }).compile()
    return { webhook: moduleRef.get(ZaloWebhook), signature, deliveries }
}

/** A request whose `rawBody` is present and undefined, which a typed partial cannot spell under exact optional property types. */
const requestWithRaw = (rawBody: Buffer | undefined): RawBodyRequest<Request> => {
    const request = mock<RawBodyRequest<Request>>()
    Reflect.set(request, "rawBody", rawBody)
    return request
}

describe("ZaloWebhook", () => {
    it("verifies the scoped MAC first, waits for proof, then accepts exactly one delivery", async () => {
        const { webhook, signature, deliveries } = await build()
        const request = mock<RawBodyRequest<Request>>({ rawBody: BODY })
        const effects: Array<string> = []
        let prove: () => void = () => undefined
        const proof = new Promise<void>((resolve) => {
            prove = resolve
        })
        signature.verify.mockImplementation(() => {
            effects.push("verify")
            return proof
        })
        deliveries.acceptZaloDelivery.mockImplementation(() => {
            effects.push("acceptZaloDelivery")
            return Promise.resolve(undefined)
        })

        const received = webhook.receive(request, ROUTE, MAC)

        expect(effects).toEqual(["verify"])
        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "zalo",
            scope: CONNECTION,
            rawBody: BODY,
            signature: MAC,
            timestamp: undefined,
        })
        expect(deliveries.acceptZaloDelivery).not.toHaveBeenCalled()

        prove()

        await expect(received).resolves.toBeUndefined()
        expect(effects).toEqual(["verify", "acceptZaloDelivery"])
        expect(deliveries.acceptZaloDelivery).toHaveBeenCalledTimes(1)
        expect(deliveries.acceptZaloDelivery).toHaveBeenCalledWith(BODY, CONNECTION)
    })

    it("propagates a signature refusal without calling the domain", async () => {
        const { webhook, signature, deliveries } = await build()
        const failure = new Error("invalid MAC")
        signature.verify.mockRejectedValue(failure)

        await expect(webhook.receive(mock<RawBodyRequest<Request>>({ rawBody: BODY }), ROUTE, MAC)).rejects.toBe(
            failure,
        )

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "zalo",
            scope: CONNECTION,
            rawBody: BODY,
            signature: MAC,
            timestamp: undefined,
        })
        expect(deliveries.acceptZaloDelivery).not.toHaveBeenCalled()
    })
})

describe("Zalo delivery intake", () => {
    it("propagates a domain failure after one successful signature verification", async () => {
        const { webhook, signature, deliveries } = await build()
        const failure = new Error("inbox unavailable")
        deliveries.acceptZaloDelivery.mockRejectedValue(failure)

        await expect(webhook.receive(mock<RawBodyRequest<Request>>({ rawBody: BODY }), ROUTE, MAC)).rejects.toBe(
            failure,
        )

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "zalo",
            scope: CONNECTION,
            rawBody: BODY,
            signature: MAC,
            timestamp: undefined,
        })
        expect(deliveries.acceptZaloDelivery).toHaveBeenCalledTimes(1)
        expect(deliveries.acceptZaloDelivery).toHaveBeenCalledWith(BODY, CONNECTION)
    })

    it("hands missing raw bytes and a missing MAC to the signature verifier unchanged", async () => {
        const { webhook, signature, deliveries } = await build()

        await expect(webhook.receive(requestWithRaw(undefined), ROUTE)).resolves.toBeUndefined()

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "zalo",
            scope: CONNECTION,
            rawBody: undefined,
            signature: undefined,
            timestamp: undefined,
        })
        expect(deliveries.acceptZaloDelivery).toHaveBeenCalledTimes(1)
        expect(deliveries.acceptZaloDelivery).toHaveBeenCalledWith(undefined, CONNECTION)
    })
})

describe("ZaloHttpModule proof declaration", () => {
    it("declares the exact domain verification method", () => {
        expect(webhookVerifiers).toEqual([ScopedWebhookVerifier.prototype.verify])
        expect(ZaloHttpModule.register({}).module).toBe(ZaloHttpModule)
    })
})

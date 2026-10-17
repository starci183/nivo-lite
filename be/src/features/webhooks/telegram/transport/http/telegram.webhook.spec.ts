import { TelegramHttpModule, webhookVerifiers } from "./telegram-http.module"
import { Test } from "@nestjs/testing"
import type { RawBodyRequest } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { Request } from "express"
import { TelegramInboxService } from "@modules/domain/telegram-inbox"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { TelegramWebhook } from "./telegram.webhook"

const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"
const BODY = Buffer.from('{"update_id":91,"message":{"text":"Price?"}}')
const ROUTE = { connectionId: CONNECTION }
const TOKEN = "connection-secret"

const build = async () => {
    const signature = mock<ScopedWebhookVerifier>()
    signature.verify.mockResolvedValue(undefined)
    const deliveries = mock<TelegramInboxService>()
    deliveries.acceptTelegramDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramWebhook,
            { provide: ScopedWebhookVerifier, useValue: signature },
            { provide: TelegramInboxService, useValue: deliveries },
        ],
    }).compile()
    return { webhook: moduleRef.get(TelegramWebhook), signature, deliveries }
}

describe("TelegramWebhook", () => {
    it("verifies the scoped secret token first, waits for proof, then accepts exactly one delivery", async () => {
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
        deliveries.acceptTelegramDelivery.mockImplementation(() => {
            effects.push("acceptTelegramDelivery")
            return Promise.resolve(undefined)
        })

        const received = webhook.receive(request, ROUTE, TOKEN)

        expect(effects).toEqual(["verify"])
        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "telegram",
            scope: CONNECTION,
            rawBody: BODY,
            signature: TOKEN,
            timestamp: undefined,
        })
        expect(deliveries.acceptTelegramDelivery).not.toHaveBeenCalled()

        prove()

        await expect(received).resolves.toBeUndefined()
        expect(effects).toEqual(["verify", "acceptTelegramDelivery"])
        expect(deliveries.acceptTelegramDelivery).toHaveBeenCalledTimes(1)
        expect(deliveries.acceptTelegramDelivery).toHaveBeenCalledWith(BODY, CONNECTION)
    })

    it("propagates a signature refusal without calling the domain", async () => {
        const { webhook, signature, deliveries } = await build()
        const failure = new Error("invalid secret token")
        signature.verify.mockRejectedValue(failure)

        await expect(webhook.receive(mock<RawBodyRequest<Request>>({ rawBody: BODY }), ROUTE, TOKEN)).rejects.toBe(
            failure,
        )

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "telegram",
            scope: CONNECTION,
            rawBody: BODY,
            signature: TOKEN,
            timestamp: undefined,
        })
        expect(deliveries.acceptTelegramDelivery).not.toHaveBeenCalled()
    })
})

describe("Telegram delivery intake", () => {
    it("propagates a domain failure after one successful signature verification", async () => {
        const { webhook, signature, deliveries } = await build()
        const failure = new Error("inbox unavailable")
        deliveries.acceptTelegramDelivery.mockRejectedValue(failure)

        await expect(webhook.receive(mock<RawBodyRequest<Request>>({ rawBody: BODY }), ROUTE, TOKEN)).rejects.toBe(
            failure,
        )

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "telegram",
            scope: CONNECTION,
            rawBody: BODY,
            signature: TOKEN,
            timestamp: undefined,
        })
        expect(deliveries.acceptTelegramDelivery).toHaveBeenCalledTimes(1)
        expect(deliveries.acceptTelegramDelivery).toHaveBeenCalledWith(BODY, CONNECTION)
    })

    it("hands missing raw bytes and a missing token to the signature verifier unchanged", async () => {
        const { webhook, signature, deliveries } = await build()

        await expect(
            webhook.receive(mock<RawBodyRequest<Request>>({ rawBody: undefined }), ROUTE),
        ).resolves.toBeUndefined()

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "telegram",
            scope: CONNECTION,
            rawBody: undefined,
            signature: undefined,
            timestamp: undefined,
        })
        expect(deliveries.acceptTelegramDelivery).toHaveBeenCalledTimes(1)
        expect(deliveries.acceptTelegramDelivery).toHaveBeenCalledWith(undefined, CONNECTION)
    })
})

describe("TelegramHttpModule proof declaration", () => {
    it("declares the exact domain verification method", () => {
        expect(webhookVerifiers).toEqual([ScopedWebhookVerifier.prototype.verify])
        expect(TelegramHttpModule.register({}).module).toBe(TelegramHttpModule)
    })
})

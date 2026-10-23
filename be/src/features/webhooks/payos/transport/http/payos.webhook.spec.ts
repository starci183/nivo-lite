import { PayosHttpModule, webhookVerifiers } from "./payos-http.module"
import { HttpStatus } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import { HTTP_CODE_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { BankFeedService } from "@modules/domain/billing"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { PayosWebhook } from "./payos.webhook"

const RAW = Buffer.from(JSON.stringify({ code: "00" }))
const CONNECTION = "conn-1"
const DELIVERY = {
    provider: "payos",
    scope: CONNECTION,
    rawBody: RAW,
    signature: undefined,
    timestamp: undefined,
}

const build = async () => {
    const signature = mock<ScopedWebhookVerifier>()
    signature.verify.mockResolvedValue(undefined)
    const feed = mock<BankFeedService>()
    feed.acceptPayosDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: ScopedWebhookVerifier, useValue: signature },
            PayosWebhook,
            { provide: BankFeedService, useValue: feed },
        ],
    }).compile()
    return { door: moduleRef.get(PayosWebhook), signature, feed }
}

/** A request whose `rawBody` is present and undefined, which a typed partial cannot spell under exact optional property types. */
const requestWithRaw = (rawBody: Buffer | undefined): RawBodyRequest<Request> => {
    const request = mock<RawBodyRequest<Request>>()
    Reflect.set(request, "rawBody", rawBody)
    return request
}

describe("PayosWebhook", () => {
    it("verifies the scoped raw body first, waits for proof, then accepts exactly one delivery", async () => {
        const { door, signature, feed } = await build()
        const effects: Array<string> = []
        let prove: () => void = () => undefined
        const proof = new Promise<void>((resolve) => {
            prove = resolve
        })
        signature.verify.mockImplementation(() => {
            effects.push("verify")
            return proof
        })
        feed.acceptPayosDelivery.mockImplementation(() => {
            effects.push("acceptPayosDelivery")
            return Promise.resolve(undefined)
        })

        const received = door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), CONNECTION)

        expect(effects).toEqual(["verify"])
        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith(DELIVERY)
        expect(feed.acceptPayosDelivery).not.toHaveBeenCalled()

        prove()

        await expect(received).resolves.toBeUndefined()
        expect(effects).toEqual(["verify", "acceptPayosDelivery"])
        expect(feed.acceptPayosDelivery).toHaveBeenCalledTimes(1)
        expect(feed.acceptPayosDelivery).toHaveBeenCalledWith(RAW, CONNECTION)
    })

    it("propagates a signature refusal without calling the feed intake", async () => {
        const { door, signature, feed } = await build()
        const failure = new Error("invalid payOS proof")
        signature.verify.mockRejectedValue(failure)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), CONNECTION)).rejects.toBe(failure)

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith(DELIVERY)
        expect(feed.acceptPayosDelivery).not.toHaveBeenCalled()
    })

    it("propagates an intake failure after one successful signature verification", async () => {
        const { door, signature, feed } = await build()
        const failure = new Error("feed unavailable")
        feed.acceptPayosDelivery.mockRejectedValue(failure)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), CONNECTION)).rejects.toBe(failure)

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith(DELIVERY)
        expect(feed.acceptPayosDelivery).toHaveBeenCalledTimes(1)
        expect(feed.acceptPayosDelivery).toHaveBeenCalledWith(RAW, CONNECTION)
    })

    it("hands missing raw bytes to verification and intake unchanged", async () => {
        const { door, signature, feed } = await build()

        await expect(door.receive(requestWithRaw(undefined), CONNECTION)).resolves.toBeUndefined()

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "payos",
            scope: CONNECTION,
            rawBody: undefined,
            signature: undefined,
            timestamp: undefined,
        })
        expect(feed.acceptPayosDelivery).toHaveBeenCalledTimes(1)
        expect(feed.acceptPayosDelivery).toHaveBeenCalledWith(undefined, CONNECTION)
    })

    it("acknowledges an accepted delivery with HTTP 200", () => {
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, PayosWebhook.prototype.receive)).toBe(HttpStatus.OK)
    })
})

describe("PayosHttpModule proof declaration", () => {
    it("declares the exact domain verification method", () => {
        expect(webhookVerifiers).toEqual([ScopedWebhookVerifier.prototype.verify])
        expect(PayosHttpModule.register({}).module).toBe(PayosHttpModule)
    })
})

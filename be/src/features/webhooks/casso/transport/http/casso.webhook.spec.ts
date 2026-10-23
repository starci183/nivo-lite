import { CassoHttpModule, webhookVerifiers } from "./casso-http.module"
import { HttpStatus } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import { HTTP_CODE_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { BankFeedService } from "@modules/domain/billing"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { CassoWebhook } from "./casso.webhook"

const RAW = Buffer.from(JSON.stringify({ error: 0 }))
const CONNECTION = "conn-1"
const SIGNATURE = "t=1,v1=ab"
const TOKEN = "token"
const DELIVERY = {
    provider: "casso",
    scope: CONNECTION,
    rawBody: RAW,
    signature: SIGNATURE,
    timestamp: TOKEN,
}

const build = async () => {
    const signature = mock<ScopedWebhookVerifier>()
    signature.verify.mockResolvedValue(undefined)
    const feed = mock<BankFeedService>()
    feed.acceptCassoDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: ScopedWebhookVerifier, useValue: signature },
            CassoWebhook,
            { provide: BankFeedService, useValue: feed },
        ],
    }).compile()
    return { door: moduleRef.get(CassoWebhook), signature, feed }
}

/** A request whose `rawBody` is present and undefined, which a typed partial cannot spell under exact optional property types. */
const requestWithRaw = (rawBody: Buffer | undefined): RawBodyRequest<Request> => {
    const request = mock<RawBodyRequest<Request>>()
    Reflect.set(request, "rawBody", rawBody)
    return request
}

describe("CassoWebhook", () => {
    it("verifies both scoped proof headers first, waits for proof, then accepts exactly one delivery", async () => {
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
        feed.acceptCassoDelivery.mockImplementation(() => {
            effects.push("acceptCassoDelivery")
            return Promise.resolve(undefined)
        })

        const received = door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), CONNECTION, SIGNATURE, TOKEN)

        expect(effects).toEqual(["verify"])
        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith(DELIVERY)
        expect(feed.acceptCassoDelivery).not.toHaveBeenCalled()

        prove()

        await expect(received).resolves.toBeUndefined()
        expect(effects).toEqual(["verify", "acceptCassoDelivery"])
        expect(feed.acceptCassoDelivery).toHaveBeenCalledTimes(1)
        expect(feed.acceptCassoDelivery).toHaveBeenCalledWith(RAW, CONNECTION)
    })

    it("propagates a signature refusal without calling the feed intake", async () => {
        const { door, signature, feed } = await build()
        const failure = new Error("invalid Casso proof")
        signature.verify.mockRejectedValue(failure)

        await expect(
            door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), CONNECTION, SIGNATURE, TOKEN),
        ).rejects.toBe(failure)

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith(DELIVERY)
        expect(feed.acceptCassoDelivery).not.toHaveBeenCalled()
    })
})

describe("Casso delivery intake", () => {
    it("propagates an intake failure after one successful signature verification", async () => {
        const { door, signature, feed } = await build()
        const failure = new Error("feed unavailable")
        feed.acceptCassoDelivery.mockRejectedValue(failure)

        await expect(
            door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), CONNECTION, SIGNATURE, TOKEN),
        ).rejects.toBe(failure)

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith(DELIVERY)
        expect(feed.acceptCassoDelivery).toHaveBeenCalledTimes(1)
        expect(feed.acceptCassoDelivery).toHaveBeenCalledWith(RAW, CONNECTION)
    })

    it("hands missing raw bytes and both missing headers to verification and intake unchanged", async () => {
        const { door, signature, feed } = await build()

        await expect(door.receive(requestWithRaw(undefined), CONNECTION, undefined, undefined)).resolves.toBeUndefined()

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "casso",
            scope: CONNECTION,
            rawBody: undefined,
            signature: undefined,
            timestamp: undefined,
        })
        expect(feed.acceptCassoDelivery).toHaveBeenCalledTimes(1)
        expect(feed.acceptCassoDelivery).toHaveBeenCalledWith(undefined, CONNECTION)
    })

    it("acknowledges an accepted delivery with HTTP 200", () => {
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, CassoWebhook.prototype.receive)).toBe(HttpStatus.OK)
    })
})

describe("CassoHttpModule proof declaration", () => {
    it("declares the exact domain verification method", () => {
        expect(webhookVerifiers).toEqual([ScopedWebhookVerifier.prototype.verify])
        expect(CassoHttpModule.register({}).module).toBe(CassoHttpModule)
    })
})

import { VietcombankHttpModule, webhookVerifiers } from "./vietcombank-http.module"
import { HttpStatus } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import { HTTP_CODE_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { BankFeedService } from "@modules/domain/billing"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { VietcombankWebhook } from "./vietcombank.webhook"

const RAW = Buffer.from(JSON.stringify({ amount_vnd: 1 }))
const SECRET = "bank-secret"
const DELIVERY = {
    provider: "vietcombank",
    scope: "platform",
    rawBody: RAW,
    signature: SECRET,
    timestamp: undefined,
}
const INTAKE = { secret: SECRET, rawBody: RAW }

const build = async () => {
    const signature = mock<ScopedWebhookVerifier>()
    signature.verify.mockResolvedValue(undefined)
    const feed = mock<BankFeedService>()
    feed.acceptSimulatedCredit.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: ScopedWebhookVerifier, useValue: signature },
            VietcombankWebhook,
            { provide: BankFeedService, useValue: feed },
        ],
    }).compile()
    return { door: moduleRef.get(VietcombankWebhook), signature, feed }
}

describe("VietcombankWebhook", () => {
    it("verifies the platform shared secret first, waits for proof, then accepts exactly one credit", async () => {
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
        feed.acceptSimulatedCredit.mockImplementation(() => {
            effects.push("acceptSimulatedCredit")
            return Promise.resolve(undefined)
        })

        const received = door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), SECRET)

        expect(effects).toEqual(["verify"])
        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith(DELIVERY)
        expect(feed.acceptSimulatedCredit).not.toHaveBeenCalled()

        prove()

        await expect(received).resolves.toBeUndefined()
        expect(effects).toEqual(["verify", "acceptSimulatedCredit"])
        expect(feed.acceptSimulatedCredit).toHaveBeenCalledTimes(1)
        expect(feed.acceptSimulatedCredit).toHaveBeenCalledWith(INTAKE)
    })

    it("propagates a signature refusal without calling the feed intake", async () => {
        const { door, signature, feed } = await build()
        const failure = new Error("invalid bank proof")
        signature.verify.mockRejectedValue(failure)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), SECRET)).rejects.toBe(failure)

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith(DELIVERY)
        expect(feed.acceptSimulatedCredit).not.toHaveBeenCalled()
    })

    it("propagates an intake failure after one successful signature verification", async () => {
        const { door, signature, feed } = await build()
        const failure = new Error("feed unavailable")
        feed.acceptSimulatedCredit.mockRejectedValue(failure)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), SECRET)).rejects.toBe(failure)

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith(DELIVERY)
        expect(feed.acceptSimulatedCredit).toHaveBeenCalledTimes(1)
        expect(feed.acceptSimulatedCredit).toHaveBeenCalledWith(INTAKE)
    })

    it("hands missing raw bytes and a missing shared secret to verification and intake unchanged", async () => {
        const { door, signature, feed } = await build()

        await expect(
            door.receive(mock<RawBodyRequest<Request>>({ rawBody: undefined }), undefined),
        ).resolves.toBeUndefined()

        expect(signature.verify).toHaveBeenCalledTimes(1)
        expect(signature.verify).toHaveBeenCalledWith({
            provider: "vietcombank",
            scope: "platform",
            rawBody: undefined,
            signature: undefined,
            timestamp: undefined,
        })
        expect(feed.acceptSimulatedCredit).toHaveBeenCalledTimes(1)
        expect(feed.acceptSimulatedCredit).toHaveBeenCalledWith({ secret: undefined, rawBody: undefined })
    })

    it("acknowledges an accepted credit with HTTP 200", () => {
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, VietcombankWebhook.prototype.receive)).toBe(HttpStatus.OK)
    })
})

describe("VietcombankHttpModule proof declaration", () => {
    it("declares the exact domain verification method", () => {
        expect(webhookVerifiers).toEqual([ScopedWebhookVerifier.prototype.verify])
        expect(VietcombankHttpModule.register({}).module).toBe(VietcombankHttpModule)
    })
})

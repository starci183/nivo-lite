import { createHash } from "node:crypto"
import { HttpStatus } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import { HTTP_CODE_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { BankFeedService, PaymentProofService } from "@modules/domain/billing"
import type { BillingOptions } from "@modules/domain/billing"
import { PublicReason } from "@modules/domain/identity"
import { RateTier } from "@modules/platform/http-security"
import { SepayFeedHttpModule, webhookVerifiers } from "./sepay-feed-http.module"
import { PROVIDER_ACK, SepayFeedWebhook } from "./sepay-feed.webhook"

const RAW = Buffer.from(JSON.stringify({ id: 3 }))
const OPTIONS: BillingOptions = {
    sepayApiKey: undefined,
    bankAccount: { account: "", bank: "", holder: "" },
    simulatedBank: { secret: undefined, workspaceId: undefined },
    channelTokenKey: undefined,
}

const build = async () => {
    const secrets = mock<ConstructorParameters<typeof PaymentProofService>[1]>()
    secrets.load.mockResolvedValue({
        workspaceId: "ws-1",
        credential: "{}",
        webhookSecret: createHash("sha256").update("k").digest("hex"),
    })
    const feed = new BankFeedService(
        mockEntityManager({}),
        mock(),
        mock(),
        OPTIONS,
        new PaymentProofService(OPTIONS, secrets),
        mock(),
        mock(),
        mock(),
        mock(),
    )
    const verification = jest.spyOn(feed, "verifySepayFeedDelivery")
    const intake = jest.spyOn(feed, "acceptSepayFeedDelivery").mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        controllers: [SepayFeedWebhook],
        providers: [{ provide: BankFeedService, useValue: feed }],
    }).compile()
    return {
        door: moduleRef.get(SepayFeedWebhook),
        feed: { verifySepayFeedDelivery: verification, acceptSepayFeedDelivery: intake },
    }
}

describe("SepayFeedWebhook", () => {
    it.each(["Apikey k", " \tAPIKEY k \t"])(
        "hands the url connection, the header %j and the raw bytes to the feed intake and answers success",
        async (authorization) => {
            const { door, feed } = await build()

            await expect(
                door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", authorization),
            ).resolves.toBe(PROVIDER_ACK)

            expect(feed.verifySepayFeedDelivery).toHaveBeenCalledTimes(1)
            expect(feed.verifySepayFeedDelivery).toHaveBeenCalledWith({
                connectionId: "conn-1",
                authorization,
                rawBody: RAW,
            })
            expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledTimes(1)
            expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledWith({
                connectionId: "conn-1",
                authorization,
                rawBody: RAW,
            })
            expect(feed.acceptSepayFeedDelivery.mock.calls[0]?.[0].rawBody).toBe(RAW)
        },
    )

    it("answers success again when SePay repeats an accepted delivery", async () => {
        const { door, feed } = await build()
        const request = mock<RawBodyRequest<Request>>({ rawBody: RAW })

        await expect(door.receive(request, "conn-1", "Apikey k")).resolves.toBe(PROVIDER_ACK)
        await expect(door.receive(request, "conn-1", "Apikey k")).resolves.toBe(PROVIDER_ACK)

        expect(feed.verifySepayFeedDelivery).toHaveBeenCalledTimes(2)
        expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledTimes(2)
        expect(feed.acceptSepayFeedDelivery).toHaveBeenNthCalledWith(1, {
            connectionId: "conn-1",
            authorization: "Apikey k",
            rawBody: RAW,
        })
        expect(feed.acceptSepayFeedDelivery).toHaveBeenNthCalledWith(2, {
            connectionId: "conn-1",
            authorization: "Apikey k",
            rawBody: RAW,
        })
    })

    it("awaits proof, then intake, before returning the provider acknowledgement", async () => {
        const { door, feed } = await build()
        const order: Array<string> = []
        let finishProof: () => void = jest.fn()
        let finishIntake: () => void = jest.fn()
        const proof = new Promise<void>((resolve) => {
            finishProof = resolve
        })
        const intake = new Promise<void>((resolve) => {
            finishIntake = resolve
        })
        feed.verifySepayFeedDelivery.mockImplementation(() => {
            order.push("verify")
            return proof
        })
        feed.acceptSepayFeedDelivery.mockImplementation(() => {
            order.push("intake")
            return intake
        })

        const response = door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", "Apikey k")
        const acknowledgement = response.then((ack) => {
            order.push("ack")
            return ack
        })

        expect(order).toEqual(["verify"])
        expect(feed.acceptSepayFeedDelivery).not.toHaveBeenCalled()
        finishProof()
        await proof
        await Promise.resolve()
        expect(order).toEqual(["verify", "intake"])
        finishIntake()
        await expect(acknowledgement).resolves.toBe(PROVIDER_ACK)
        expect(order).toEqual(["verify", "intake", "ack"])
    })

    it("lets a refused proof reach SePay before calling the intake", async () => {
        const { door, feed } = await build()
        const refusal = "refused proof"
        feed.verifySepayFeedDelivery.mockRejectedValue(refusal)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", undefined)).rejects.toBe(
            refusal,
        )

        expect(feed.acceptSepayFeedDelivery).not.toHaveBeenCalled()
    })

    it.each(["Apikey wrong", undefined, "Bearer k"])(
        "refuses header %p against the stored connection digest before intake",
        async (authorization) => {
            const { door, feed } = await build()

            await expect(
                door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", authorization),
            ).rejects.toMatchObject({ code: "BILLING_WEBHOOK_UNAUTHORIZED" })

            expect(feed.acceptSepayFeedDelivery).not.toHaveBeenCalled()
        },
    )

    it("lets a refusal of the intake reach SePay", async () => {
        const { door, feed } = await build()
        const refusal = "refused"
        feed.acceptSepayFeedDelivery.mockRejectedValue(refusal)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", "Apikey k")).rejects.toBe(
            refusal,
        )

        expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledTimes(1)
        expect(feed.acceptSepayFeedDelivery).toHaveBeenCalledWith({
            connectionId: "conn-1",
            authorization: "Apikey k",
            rawBody: RAW,
        })
    })

    it("acknowledges accepted deliveries with HTTP 200", () => {
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, SepayFeedWebhook.prototype.receive)).toBe(HttpStatus.OK)
        expect(Reflect.getMetadata("domain.identity.public", SepayFeedWebhook.prototype.receive)).toEqual({
            reason: PublicReason.SignedWebhook,
        })
        expect(Reflect.getMetadata("platform.http-security.rate-tier", SepayFeedWebhook.prototype.receive)).toBe(
            RateTier.Strict,
        )
    })

    it("declares the connection proof and registers the existing feed door", () => {
        expect(webhookVerifiers).toEqual([BankFeedService.prototype.verifySepayFeedDelivery])
        expect(Reflect.getMetadata("controllers", SepayFeedHttpModule)).toEqual([SepayFeedWebhook])
        expect(PROVIDER_ACK).toEqual({ success: true })
    })
})

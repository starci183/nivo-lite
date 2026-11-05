import { HttpStatus } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import { HTTP_CODE_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { BankFeedIntakeService, BankFeedReceiptsService, BillingError, BillingErrorCode } from "@modules/domain/billing"
import { PublicReason } from "@modules/domain/identity"
import { RateTier } from "@modules/platform/http-security"
import { SepayFeedHttpModule, webhookVerifiers } from "./sepay-feed-http.module"
import { PROVIDER_ACK, SepayFeedWebhook } from "./sepay-feed.webhook"

const RAW = Buffer.from(JSON.stringify({ id: 3 }))

const build = async () => {
    const feed = mock<BankFeedReceiptsService>()
    feed.verifyFeedDelivery.mockResolvedValue(undefined)
    const intake = mock<BankFeedIntakeService>()
    intake.acceptDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayFeedWebhook,
            { provide: BankFeedReceiptsService, useValue: feed },
            { provide: BankFeedIntakeService, useValue: intake },
        ],
    }).compile()
    return { door: moduleRef.get(SepayFeedWebhook), feed, intake }
}

describe("SepayFeedWebhook", () => {
    it.each(["Apikey k", " \tAPIKEY k \t"])(
        "hands the url connection, the header %j and the raw bytes to the feed intake and answers success",
        async (authorization) => {
            const { door, feed, intake } = await build()

            await expect(
                door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", authorization),
            ).resolves.toBe(PROVIDER_ACK)

            expect(feed.verifyFeedDelivery).toHaveBeenCalledTimes(1)
            expect(feed.verifyFeedDelivery).toHaveBeenCalledWith(authorization, "conn-1", RAW, "sepay")
            expect(intake.acceptDelivery).toHaveBeenCalledTimes(1)
            expect(intake.acceptDelivery).toHaveBeenCalledWith(RAW, "conn-1", "sepay")
            expect(intake.acceptDelivery.mock.calls[0]?.[0]).toBe(RAW)
        },
    )

    it("answers success again when SePay repeats an accepted delivery", async () => {
        const { door, feed, intake } = await build()
        const request = mock<RawBodyRequest<Request>>({ rawBody: RAW })

        await expect(door.receive(request, "conn-1", "Apikey k")).resolves.toBe(PROVIDER_ACK)
        await expect(door.receive(request, "conn-1", "Apikey k")).resolves.toBe(PROVIDER_ACK)

        expect(feed.verifyFeedDelivery).toHaveBeenCalledTimes(2)
        expect(intake.acceptDelivery).toHaveBeenCalledTimes(2)
        expect(intake.acceptDelivery).toHaveBeenNthCalledWith(1, RAW, "conn-1", "sepay")
        expect(intake.acceptDelivery).toHaveBeenNthCalledWith(2, RAW, "conn-1", "sepay")
    })
})

describe("SepayFeedWebhook", () => {
    it("awaits proof, then intake, before returning the provider acknowledgement", async () => {
        const { door, feed, intake } = await build()
        const order: Array<string> = []
        let finishProof: () => void = jest.fn()
        let finishIntake: () => void = jest.fn()
        const proof = new Promise<void>((resolve) => {
            finishProof = resolve
        })
        const intakeDone = new Promise<void>((resolve) => {
            finishIntake = resolve
        })
        feed.verifyFeedDelivery.mockImplementation(() => {
            order.push("verify")
            return proof
        })
        intake.acceptDelivery.mockImplementation(() => {
            order.push("intake")
            return intakeDone
        })

        const response = door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", "Apikey k")
        const acknowledgement = response.then((ack) => {
            order.push("ack")
            return ack
        })

        expect(order).toEqual(["verify"])
        expect(intake.acceptDelivery).not.toHaveBeenCalled()
        finishProof()
        await proof
        await Promise.resolve()
        expect(order).toEqual(["verify", "intake"])
        finishIntake()
        await expect(acknowledgement).resolves.toBe(PROVIDER_ACK)
        expect(order).toEqual(["verify", "intake", "ack"])
    })

    it("lets a refused proof reach SePay before calling the intake", async () => {
        const { door, feed, intake } = await build()
        const refusal = "refused proof"
        feed.verifyFeedDelivery.mockRejectedValue(refusal)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", undefined)).rejects.toBe(
            refusal,
        )

        expect(intake.acceptDelivery).not.toHaveBeenCalled()
    })

    it.each(["Apikey wrong", undefined, "Bearer k"])(
        "propagates a stored connection digest refusal for header %p before intake",
        async (authorization) => {
            const { door, feed, intake } = await build()
            feed.verifyFeedDelivery.mockRejectedValue(new BillingError({ code: BillingErrorCode.WebhookUnauthorized }))

            await expect(
                door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", authorization),
            ).rejects.toMatchObject({ code: "BILLING_WEBHOOK_UNAUTHORIZED" })

            expect(intake.acceptDelivery).not.toHaveBeenCalled()
        },
    )
})

describe("SepayFeedWebhook", () => {
    it("lets a refusal of the intake reach SePay", async () => {
        const { door, intake } = await build()
        const refusal = "refused"
        intake.acceptDelivery.mockRejectedValue(refusal)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "conn-1", "Apikey k")).rejects.toBe(
            refusal,
        )

        expect(intake.acceptDelivery).toHaveBeenCalledTimes(1)
        expect(intake.acceptDelivery).toHaveBeenCalledWith(RAW, "conn-1", "sepay")
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
        expect(webhookVerifiers).toEqual([BankFeedReceiptsService.prototype.verifyFeedDelivery])
        expect(Reflect.getMetadata("controllers", SepayFeedHttpModule)).toEqual([SepayFeedWebhook])
        expect(PROVIDER_ACK).toEqual({ success: true })
    })
})

import { HttpStatus } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import { HTTP_CODE_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import { BillingError, BillingErrorCode } from "@modules/domain/billing"
import { PublicReason } from "@modules/domain/identity"
import { SepayTransactionsService } from "@modules/domain/sepay-transactions"
import { RateTier } from "@modules/platform/http-security"
import { SepayHttpModule, webhookVerifiers } from "./sepay-http.module"
import { PROVIDER_ACK, SepayWebhook } from "./sepay.webhook"

const RAW = Buffer.from(JSON.stringify({ id: 9001 }))

const build = async () => {
    const settlement = mock<SepayTransactionsService>()
    settlement.acceptSepayDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [SepayWebhook, { provide: SepayTransactionsService, useValue: settlement }],
    }).compile()
    return { door: moduleRef.get(SepayWebhook), settlement }
}

describe("SepayWebhook", () => {
    it.each(["Apikey k", " \tAPIKEY k \t"])(
        "hands the header %j and the exact raw bytes to the settlement and answers success",
        async (authorization) => {
            const { door, settlement } = await build()

            await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), authorization)).resolves.toBe(
                PROVIDER_ACK,
            )

            expect(settlement.verifySepayDelivery).toHaveBeenCalledTimes(1)
            expect(settlement.verifySepayDelivery).toHaveBeenCalledWith(authorization)
            expect(settlement.acceptSepayDelivery).toHaveBeenCalledTimes(1)
            expect(settlement.acceptSepayDelivery).toHaveBeenCalledWith({ authorization, rawBody: RAW })
            expect(settlement.acceptSepayDelivery.mock.calls[0]?.[0].rawBody).toBe(RAW)
        },
    )

    it("answers success again when SePay repeats an accepted delivery", async () => {
        const { door, settlement } = await build()
        const request = mock<RawBodyRequest<Request>>({ rawBody: RAW })

        await expect(door.receive(request, "Apikey k")).resolves.toBe(PROVIDER_ACK)
        await expect(door.receive(request, "Apikey k")).resolves.toBe(PROVIDER_ACK)

        expect(settlement.verifySepayDelivery).toHaveBeenCalledTimes(2)
        expect(settlement.verifySepayDelivery).toHaveBeenNthCalledWith(1, "Apikey k")
        expect(settlement.verifySepayDelivery).toHaveBeenNthCalledWith(2, "Apikey k")
        expect(settlement.acceptSepayDelivery).toHaveBeenCalledTimes(2)
        expect(settlement.acceptSepayDelivery).toHaveBeenNthCalledWith(1, { authorization: "Apikey k", rawBody: RAW })
        expect(settlement.acceptSepayDelivery).toHaveBeenNthCalledWith(2, { authorization: "Apikey k", rawBody: RAW })
    })

    it("proves the key before intake and acknowledges only after intake completes", async () => {
        const { door, settlement } = await build()
        const order: Array<string> = []
        let completeIntake: (() => void) | undefined
        const intake = new Promise<void>((resolve) => {
            completeIntake = resolve
        })
        settlement.verifySepayDelivery.mockImplementation(() => {
            order.push("verify")
        })
        settlement.acceptSepayDelivery.mockImplementation(async () => {
            await intake
            order.push("intake")
        })

        const response = door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "Apikey k")
        const acknowledged = jest.fn(() => order.push("ack"))
        void response.then(acknowledged)
        await Promise.resolve()

        expect(acknowledged).not.toHaveBeenCalled()
        expect(order).toEqual(["verify"])
        completeIntake?.()

        await expect(response).resolves.toBe(PROVIDER_ACK)
        expect(order).toEqual(["verify", "intake", "ack"])
    })
})
describe("SepayWebhook", () => {
    it.each([undefined, "Bearer k", "Apikey wrong"])(
        "refuses the invalid key %j before accessing the request or accepting a delivery",
        async (authorization) => {
            const { door, settlement } = await build()
            settlement.verifySepayDelivery.mockImplementation(() => {
                throw new BillingError({ code: BillingErrorCode.WebhookUnauthorized })
            })
            const rawBody = jest.fn(() => RAW)
            const request = mock<RawBodyRequest<Request>>()
            Object.defineProperty(request, "rawBody", { get: rawBody })

            await expect(door.receive(request, authorization)).rejects.toMatchObject({
                code: BillingErrorCode.WebhookUnauthorized,
            })

            expect(settlement.verifySepayDelivery).toHaveBeenCalledWith(authorization)
            expect(rawBody).not.toHaveBeenCalled()
            expect(settlement.acceptSepayDelivery).not.toHaveBeenCalled()
        },
    )

    it("lets a failure of the settlement reach SePay so it retries", async () => {
        const { door, settlement } = await build()
        const failure = new BillingError({ code: BillingErrorCode.WebhookInvalid })
        settlement.acceptSepayDelivery.mockRejectedValue(failure)

        await expect(door.receive(mock<RawBodyRequest<Request>>({ rawBody: RAW }), "Apikey k")).rejects.toBe(failure)

        expect(settlement.acceptSepayDelivery).toHaveBeenCalledTimes(1)
        expect(settlement.acceptSepayDelivery).toHaveBeenCalledWith({ authorization: "Apikey k", rawBody: RAW })
    })

    it("keeps signed public access, the strict rate limit and HTTP 200 acknowledgement", () => {
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, SepayWebhook.prototype.receive)).toBe(HttpStatus.OK)
        expect(Reflect.getMetadata("domain.identity.public", SepayWebhook.prototype.receive)).toEqual({
            reason: PublicReason.SignedWebhook,
        })
        expect(Reflect.getMetadata("platform.http-security.rate-tier", SepayWebhook.prototype.receive)).toBe(
            RateTier.Strict,
        )
        expect(PROVIDER_ACK).toEqual({ success: true })
    })

    it("declares the domain proof and registers the same HTTP door", () => {
        expect(webhookVerifiers).toEqual([SepayTransactionsService.prototype.verifySepayDelivery])
        expect(Reflect.getMetadata("controllers", SepayHttpModule)).toEqual([SepayWebhook])
    })
})

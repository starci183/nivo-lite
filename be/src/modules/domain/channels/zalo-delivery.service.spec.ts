import { FakeClock, builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesErrorCode, AgentMessagesService } from "@modules/domain/agent-messages"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ZALO, ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DeliveryRequest, RenewalNotification } from "./channels.contracts"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"

const NOW = Date.parse("2026-10-12T10:00:00.000Z")
const HOUR = 3_600_000
const INSIDE = NOW - 2 * HOUR
const OUTSIDE = NOW - 30 * 24 * HOUR

const QR = "https://qr.sepay.vn/img?acc=0123456789&bank=MB&amount=1500000&des=INV2026100001&template=compact"

const target: ConversationTarget = {
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "zalo",
    externalId: "user-1",
    connectionId: "c-1",
}

const request: DeliveryRequest = { conversationId: "conv-1", messageId: "msg-1", text: "Hello" }
const withQr: DeliveryRequest = { ...request, text: `Hoa don INV-202610-0001\nQR: ${QR}` }
const byConsultation = { delivered: true, failure: null, via: "consultation" }
const byZns = { delivered: true, failure: null, via: "zns" }

const renewal: RenewalNotification = {
    kind: "renewal",
    phone: "0912 345 678",
    fields: {
        customerName: "Nguyen Lan",
        plan: "Goi Pro",
        endDate: "2026-11-27",
        amount: 1_500_000,
        transferContent: "INV2026100001",
        invoiceNumber: "INV-202610-0001",
    },
}
const notice: DeliveryRequest = { ...request, notification: renewal }

const zaloConnection = builder<ConnectionRecord>({
    id: "c-1",
    workspaceId: "ws-1",
    provider: "zalo_oa",
    name: "Shop OA",
    meta: {
        app_id: "123456",
        zns_renewal_template_id: "246810",
        zns_renewal_param_customer_name: "customer_name",
        zns_renewal_param_end_date: "end_date",
        zns_renewal_param_amount: "amount",
        zns_renewal_param_invoice_number: "invoice_no",
    },
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    createdBy: "owner-1",
    firstEvent: null,
})

const znsMessage = {
    phone: "84912345678",
    templateId: "246810",
    templateData: {
        customer_name: "Nguyen Lan",
        end_date: "27/11/2026",
        amount: "1500000",
        invoice_no: "INV-202610-0001",
    },
    trackingId: "msg-1",
}

const refusal = (zaloCode: number, path = "/v3.0/oa/message/cs") =>
    new ZaloError({ code: ZaloErrorCode.Rejected, params: { path, reason: "no", zaloCode } })

const build = async (lastCustomerAt: number | null = INSIDE) => {
    const messages = mock<AgentMessagesService>()
    messages.lastCustomerAt.mockResolvedValue(
        lastCustomerAt === null
            ? { kind: "refused", code: AgentMessagesErrorCode.NotFound }
            : { kind: "ok", value: new Date(lastCustomerAt) },
    )
    const zalo = mock<ZaloClient>()
    zalo.sendCsText.mockResolvedValue(undefined)
    zalo.sendCsImage.mockResolvedValue(undefined)
    zalo.sendZns.mockResolvedValue({ messageId: "z-9" })
    const credentials = mock<ZaloCredentialsService>()
    credentials.accessToken.mockResolvedValue("access-1")
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(zaloConnection())
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloDeliveryService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: ZALO, useValue: zalo },
            { provide: LOGGER, useValue: logger },
            { provide: AgentMessagesService, useValue: messages },
            { provide: ZaloCredentialsService, useValue: credentials },
            { provide: ConnectionsService, useValue: connections },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloDeliveryService), zalo, credentials, connections, logger }
}

describe("ZaloDeliveryService", () => {
    describe("send inside the window", () => {
        it("sends the text, then the SePay QR as an image", async () => {
            const { service, zalo } = await build()

            await expect(service.send(target, "user-1", withQr)).resolves.toEqual(byConsultation)

            expect(zalo.sendCsText).toHaveBeenCalledWith("access-1", "user-1", withQr.text)
            expect(zalo.sendCsImage).toHaveBeenCalledWith("access-1", "user-1", QR)
        })

        it("sends no image for a text without a QR link", async () => {
            const { service, zalo } = await build()

            await expect(service.send(target, "user-1", request)).resolves.toEqual(byConsultation)
            expect(zalo.sendCsImage).not.toHaveBeenCalled()
        })

        it("keeps the text delivered and records a warning when the image is refused", async () => {
            const { service, zalo, logger } = await build()
            zalo.sendCsImage.mockRejectedValue(refusal(-201))

            await expect(service.send(target, "user-1", withQr)).resolves.toEqual({
                ...byConsultation,
                note: "qr_image_failed",
            })
            expect(logger.warn).toHaveBeenCalledWith("channels.zalo.qr-image-failed", {
                conversationId: "conv-1",
                failure: "zalo_error",
            })
        })

        it("does not resend the text when the token refresh is busy for the image", async () => {
            const { service, zalo, credentials } = await build()
            credentials.accessToken.mockResolvedValueOnce("access-1")
            credentials.accessToken.mockRejectedValueOnce(
                new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy }),
            )

            await expect(service.send(target, "user-1", withQr)).resolves.toEqual({
                ...byConsultation,
                note: "qr_image_failed",
            })
            expect(zalo.sendCsText).toHaveBeenCalledTimes(1)
        })

        it("does not try the image when the text was refused", async () => {
            const { service, zalo } = await build()
            zalo.sendCsText.mockRejectedValue(refusal(-213))

            await expect(service.send(target, "user-1", withQr)).resolves.toEqual({
                delivered: false,
                failure: "zalo_unfollowed",
            })
            expect(zalo.sendCsImage).not.toHaveBeenCalled()
        })
    })
})

describe("ZaloDeliveryService", () => {
    describe("send without a connection or a window", () => {
        it("says not connected when the conversation has no connection", async () => {
            const { service, zalo } = await build()

            await expect(service.send({ ...target, connectionId: null }, "user-1", notice)).resolves.toEqual({
                delivered: false,
                failure: "zalo_not_connected",
            })
            expect(zalo.sendZns).not.toHaveBeenCalled()
        })

        it("keeps the refusal without a notice, whether the window is closed or the user id is missing", async () => {
            const { service, connections } = await build(OUTSIDE)

            await expect(service.send(target, "user-1", request)).resolves.toEqual({
                delivered: false,
                failure: "zalo_window_expired",
            })
            await expect(service.send(target, null, request)).resolves.toEqual({
                delivered: false,
                failure: "zalo_not_connected",
            })
            expect(connections.find).not.toHaveBeenCalled()
        })

        it("treats a conversation the customer never wrote in as open", async () => {
            const { service, zalo } = await build(null)

            await expect(service.send(target, "user-1", notice)).resolves.toEqual(byConsultation)
            expect(zalo.sendZns).not.toHaveBeenCalled()
        })
    })
})

describe("ZaloDeliveryService", () => {
    describe("send by ZNS", () => {
        it("sends the renewal by ZNS outside the window when a template and a phone exist", async () => {
            const { service, zalo, connections, logger } = await build(OUTSIDE)

            await expect(service.send(target, "user-1", notice)).resolves.toEqual(byZns)

            expect(connections.find).toHaveBeenCalledWith("ws-1", "c-1")
            expect(zalo.sendZns).toHaveBeenCalledWith("access-1", znsMessage)
            expect(zalo.sendCsText).not.toHaveBeenCalled()
            expect(logger.info).toHaveBeenCalledWith("channels.zalo.zns-sent", {
                conversationId: "conv-1",
                zaloMessageId: "z-9",
            })
        })

        it("falls back to ZNS when Zalo itself says the window is closed", async () => {
            const { service, zalo } = await build()
            zalo.sendCsText.mockRejectedValue(refusal(-230))

            await expect(service.send(target, "user-1", notice)).resolves.toEqual(byZns)
            expect(zalo.sendZns).toHaveBeenCalledWith("access-1", znsMessage)
        })

        it("reaches the customer by ZNS when the conversation has no Zalo user id", async () => {
            const { service, zalo } = await build()

            await expect(service.send(target, null, notice)).resolves.toEqual(byZns)
            expect(zalo.sendCsText).not.toHaveBeenCalled()
        })

        it("renews a rejected token once for ZNS", async () => {
            const { service, zalo, credentials } = await build(OUTSIDE)
            credentials.accessToken.mockResolvedValueOnce("access-1")
            credentials.accessToken.mockResolvedValueOnce("access-2")
            zalo.sendZns.mockRejectedValueOnce(refusal(-124, "/message/template"))

            await expect(service.send(target, "user-1", notice)).resolves.toEqual(byZns)
            expect(credentials.accessToken).toHaveBeenNthCalledWith(2, "c-1", { stale: "access-1" })
            expect(zalo.sendZns).toHaveBeenLastCalledWith("access-2", znsMessage)
        })

        it.each([
            [-108, "zalo_recipient"],
            [-109, "zalo_template"],
            [-115, "zalo_quota"],
            [-117, "zalo_not_permitted"],
        ])("reports the ZNS refusal %s as %s and logs it", async (zaloCode, failure) => {
            const { service, zalo, logger } = await build(OUTSIDE)
            zalo.sendZns.mockRejectedValue(refusal(zaloCode, "/message/template"))

            await expect(service.send(target, "user-1", notice)).resolves.toEqual({ delivered: false, failure })
            expect(logger.error).toHaveBeenCalledWith("channels.delivery.failed", expect.anything(), {
                conversationId: "conv-1",
                channel: "zalo",
            })
        })

        it("lets the caller retry when the token refresh is busy for ZNS", async () => {
            const { service, credentials } = await build(OUTSIDE)
            const busy = new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy })
            credentials.accessToken.mockRejectedValue(busy)

            await expect(service.send(target, "user-1", notice)).rejects.toBe(busy)
        })
    })
})

describe("ZaloDeliveryService", () => {
    describe("send when ZNS cannot be used", () => {
        it("keeps the window refusal and notes that no template is configured", async () => {
            const { service, zalo, connections, logger } = await build(OUTSIDE)
            connections.find.mockResolvedValue(zaloConnection({ meta: { app_id: "123456" } }))

            await expect(service.send(target, "user-1", notice)).resolves.toEqual({
                delivered: false,
                failure: "zalo_window_expired",
                note: "zns_not_configured",
            })
            expect(zalo.sendZns).not.toHaveBeenCalled()
            expect(logger.warn).toHaveBeenCalledWith("channels.zalo.zns-fallback-skipped", {
                conversationId: "conv-1",
                refusal: "zalo_window_expired",
                note: "zns_not_configured",
            })
        })

        it("notes that no template is configured when the connection is gone", async () => {
            const { service, connections } = await build(OUTSIDE)
            connections.find.mockResolvedValue(null)

            await expect(service.send(target, "user-1", notice)).resolves.toEqual({
                delivered: false,
                failure: "zalo_window_expired",
                note: "zns_not_configured",
            })
        })

        it.each([
            ["no phone", null],
            ["a phone that is not Vietnamese", "+6591234567"],
        ])("keeps the window refusal and notes the missing phone for %s", async (_label, phone) => {
            const { service, zalo } = await build(OUTSIDE)

            await expect(
                service.send(target, "user-1", { ...request, notification: { ...renewal, phone } }),
            ).resolves.toEqual({
                delivered: false,
                failure: "zalo_window_expired",
                note: "zns_no_phone",
            })
            expect(zalo.sendZns).not.toHaveBeenCalled()
        })
    })

    describe("sendText", () => {
        it("sends a consultation text with a token renewed once after a rejection", async () => {
            const { service, zalo, credentials } = await build()
            credentials.accessToken.mockResolvedValueOnce("access-1")
            credentials.accessToken.mockResolvedValueOnce("access-2")
            zalo.sendCsText.mockRejectedValueOnce(refusal(-216))

            await expect(service.sendText("c-1", "staff-1", "Shift starts")).resolves.toBeUndefined()
            expect(zalo.sendCsText).toHaveBeenLastCalledWith("access-2", "staff-1", "Shift starts")
        })

        it("throws any other refusal", async () => {
            const { service, zalo } = await build()
            zalo.sendCsText.mockRejectedValue(refusal(-213))

            await expect(service.sendText("c-1", "staff-1", "Shift starts")).rejects.toMatchObject({
                params: { zaloCode: -213 },
            })
        })
    })
})

describe("ZaloDeliveryService", () => {
    describe("send refusals of the consultation text", () => {
        it("renews the token once when Zalo rejects it and sends again with the new one", async () => {
            const { service, zalo, credentials } = await build()
            credentials.accessToken.mockResolvedValueOnce("access-1")
            credentials.accessToken.mockResolvedValueOnce("access-2")
            zalo.sendCsText.mockRejectedValueOnce(refusal(-216))

            await expect(service.send(target, "user-1", request)).resolves.toEqual(byConsultation)
            expect(credentials.accessToken).toHaveBeenNthCalledWith(2, "c-1", { stale: "access-1" })
            expect(zalo.sendCsText).toHaveBeenLastCalledWith("access-2", "user-1", "Hello")
        })

        it("classifies any other refusal for the workbench and logs it", async () => {
            const { service, zalo, logger } = await build()
            zalo.sendCsText.mockRejectedValue(refusal(-234))

            await expect(service.send(target, "user-1", request)).resolves.toEqual({
                delivered: false,
                failure: "zalo_night_hours",
            })
            expect(logger.error).toHaveBeenCalledWith("channels.delivery.failed", expect.anything(), {
                conversationId: "conv-1",
                channel: "zalo",
            })
        })

        it("treats a connection that is gone as a failure of the generic kind", async () => {
            const { service, credentials } = await build()
            credentials.accessToken.mockRejectedValue(new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound }))

            await expect(service.send(target, "user-1", request)).resolves.toEqual({
                delivered: false,
                failure: "zalo_error",
            })
        })

        it("refuses outside the window without calling Zalo when there is no notice", async () => {
            const { service, zalo } = await build(NOW - 49 * HOUR)

            await expect(service.send(target, "user-1", request)).resolves.toEqual({
                delivered: false,
                failure: "zalo_window_expired",
            })
            expect(zalo.sendCsText).not.toHaveBeenCalled()
        })
    })
})

import { mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import { WebhookDeliveryError, WebhookDeliveryErrorCode, type WebhookDeliveryClient } from "@modules/integrations/webhook-delivery"
import type { Logger } from "@modules/platform/logging"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { WebhookConnectionsError, WebhookConnectionsErrorCode } from "./errors/webhook-connections.error"
import { WebhookConnectionsLogEvent } from "./webhook-connections.log-events"
import { WebhookLiveSendService } from "./webhook-live-send.service"
import type { WebhookSendRequest } from "./webhook-send.port"

const TARGET = "https://receiver.test/hook"
const CONNECTION = connectionRecord({ id: "wh-live", workspaceId: "ws-1", provider: "webhook" })
const REQUEST: WebhookSendRequest = { body: '{"id":"d-1"}', headers: { "x-nivo-delivery": "d-1" } }

const build = () => {
    const connections = mock<ConnectionsService>()
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify({ url: TARGET }), webhookSecret: "s" })
    connections.publicOrigin.mockReturnValue("https://nivo.vn")
    const delivery = mock<WebhookDeliveryClient>()
    delivery.resolveTarget.mockResolvedValue(new URL(TARGET))
    delivery.post.mockResolvedValue({ status: 200, failure: null, durationMs: 7 })
    const logger = mock<Logger>()
    return { connections, delivery, logger, live: new WebhookLiveSendService(connections, delivery, logger) }
}

describe("WebhookLiveSendService", () => {
    it("reads the sealed address, resolves it as a target (private addresses refused with a public origin) and posts the signed delivery there", async () => {
        const { live, delivery, connections } = build()

        await expect(live.post(CONNECTION, REQUEST)).resolves.toEqual({ status: 200, failure: null, durationMs: 7 })

        expect(connections.readSecret).toHaveBeenCalledWith("wh-live")
        expect(delivery.resolveTarget).toHaveBeenCalledWith(TARGET, true)
        expect(delivery.post).toHaveBeenCalledWith({ url: new URL(TARGET), body: REQUEST.body, headers: REQUEST.headers })
    })

    it("answers what the receiver answered, or why none did, without throwing", async () => {
        const { live, delivery } = build()
        delivery.post.mockResolvedValue({ status: null, failure: "timeout", durationMs: 10_000 })

        await expect(live.post(CONNECTION, REQUEST)).resolves.toEqual({ status: null, failure: "timeout", durationMs: 10_000 })
    })

    it.each([
        ["no sealed address", null],
        ["an address field that is empty", { plain: JSON.stringify({ url: "" }), webhookSecret: "s" }],
    ])("is the typed NO_URL for %s: nothing was sent", async (_name, secret) => {
        const { live, delivery, connections } = build()
        connections.readSecret.mockResolvedValue(secret)

        await expect(live.post(CONNECTION, REQUEST)).rejects.toEqual(new WebhookConnectionsError({ code: WebhookConnectionsErrorCode.NoUrl }))
        expect(delivery.post).not.toHaveBeenCalled()
    })

    it("logs an unreadable sealed address and is NO_URL", async () => {
        const { live, connections, logger } = build()
        connections.readSecret.mockResolvedValue({ plain: "not json", webhookSecret: "s" })

        await expect(live.post(CONNECTION, REQUEST)).rejects.toMatchObject({ code: WebhookConnectionsErrorCode.NoUrl })
        expect(logger.error).toHaveBeenCalledWith(WebhookConnectionsLogEvent.AddressUnreadable, expect.anything(), { connectionId: "wh-live" })
    })

    it("is the typed URL_REFUSED, with the client's refusal as its cause, for an address that cannot be a delivery target", async () => {
        const { live, delivery } = build()
        const refusal = new WebhookDeliveryError({ code: WebhookDeliveryErrorCode.TargetRefused })
        delivery.resolveTarget.mockRejectedValue(refusal)

        await expect(live.post(CONNECTION, REQUEST)).rejects.toMatchObject({ code: WebhookConnectionsErrorCode.UrlRefused, cause: refusal })
        expect(delivery.post).not.toHaveBeenCalled()
    })

    it("lets any other failure travel up unchanged", async () => {
        const { live, delivery } = build()
        const failure = new Error("dns down")
        delivery.resolveTarget.mockRejectedValue(failure)

        await expect(live.post(CONNECTION, REQUEST)).rejects.toBe(failure)
    })
})

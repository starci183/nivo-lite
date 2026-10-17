import { HOUR_MS, PRIVATE_REPLIES_PER_HOUR } from "./meta.contracts"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaMessagingClient } from "./meta-messaging.client"
import type { MetaPageAccess } from "./meta.contracts"
import { META_OPTIONS } from "./meta.decorators"
import type { MetaOptions } from "./meta.options"

const OPTIONS: MetaOptions = {
    app: { appId: "app-1", appSecret: new Secret("secret-1") },
    webhookVerifyToken: new Secret("verify-1"),
    loginConfigId: undefined,
    graphVersion: undefined,
    siteUrl: "https://nivo.vn",
    channelTokenKey: new Secret(Buffer.alloc(32, 3).toString("base64")),
    sendPerMinute: 2,
    timeoutMs: 4000,
}
const PAGE: MetaPageAccess = { pageId: "PAGE", pageToken: "ptok", igId: "IG" }
const PAGE_NO_IG: MetaPageAccess = { pageId: "PAGE", pageToken: "ptok", igId: null }

const build = async (options: MetaOptions = OPTIONS) => {
    const http = mock<HttpClient>()
    const logger = mock<Logger>()
    const clock = new FakeClock("2026-10-12T03:00:00.000Z")
    const moduleRef = await Test.createTestingModule({
        providers: [
            MetaMessagingClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: META_OPTIONS, useValue: { ...options } },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(MetaMessagingClient), http, clock, logger }
}

const answer = (body: unknown, status = 200) => ({ status, body })
const graphError = (error: object, status = 400) => answer({ error }, status)

describe("MetaMessagingClient deliverMessage", () => {
    it("sends a response and returns the message ids", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue(answer({ message_id: "mid-1" }))

        await expect(client.deliverMessage(PAGE, "facebook", "PSID", "hello", "standard")).resolves.toEqual({
            ok: true,
            ids: ["mid-1"],
        })
        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "POST",
                body: { recipient: { id: "PSID" }, messaging_type: "RESPONSE", message: { text: "hello" } },
            }),
        )
    })

    it("tags a human agent message and tolerates a send with no id", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue(answer({}))

        await expect(client.deliverMessage(PAGE, "instagram", "IGSID", "hi", "human_agent")).resolves.toEqual({
            ok: true,
            ids: [],
        })
        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({
                body: expect.objectContaining({ messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" }),
            }),
        )
    })

    it("refuses empty text and an Instagram send without a linked account", async () => {
        const { client, http } = await build()

        await expect(client.deliverMessage(PAGE, "facebook", "P", "  ", "standard")).resolves.toEqual({
            ok: false,
            reason: "empty_text",
        })
        await expect(client.deliverMessage(PAGE_NO_IG, "instagram", "P", "x", "standard")).resolves.toEqual({
            ok: false,
            reason: "not_connected",
            detail: "no Instagram account linked to this Page",
        })
        expect(http.request).not.toHaveBeenCalled()
    })

    it("stops at the rate limit and says how far it got", async () => {
        const { client, http } = await build({ ...OPTIONS, sendPerMinute: 1 })
        http.request.mockResolvedValue(answer({ message_id: "m" }))
        const long = `${"word ".repeat(600)}end`

        await expect(client.deliverMessage(PAGE, "facebook", "P", long, "standard")).resolves.toMatchObject({
            ok: false,
            reason: "rate_limited",
            detail: expect.stringContaining("sent 1 of"),
        })
        await expect(client.deliverMessage(PAGE, "facebook", "P", "again", "standard")).resolves.toEqual({
            ok: false,
            reason: "rate_limited",
        })
    })
})
describe("MetaMessagingClient deliverMessage", () => {
    it("turns a Graph refusal and a transport failure into reasons", async () => {
        const { client, http } = await build({ ...OPTIONS, sendPerMinute: 10 })
        http.request.mockResolvedValueOnce(graphError({ message: "expired", code: 10, error_subcode: 2018278 }))
        http.request.mockRejectedValueOnce(new Error("down"))
        http.request.mockRejectedValueOnce("offline")

        await expect(client.deliverMessage(PAGE, "facebook", "P", "x", "standard")).resolves.toEqual({
            ok: false,
            reason: "window_expired",
            detail: "expired",
        })
        await expect(client.deliverMessage(PAGE, "facebook", "P", "x", "standard")).resolves.toEqual({
            ok: false,
            reason: "error",
            detail: "down",
        })
        await expect(client.deliverMessage(PAGE, "facebook", "P", "x", "standard")).resolves.toEqual({
            ok: false,
            reason: "error",
            detail: "network error",
        })
    })
})
describe("MetaMessagingClient publicReply", () => {
    it("replies under a Facebook comment and an Instagram comment", async () => {
        const { client, http } = await build({ ...OPTIONS, sendPerMinute: 10 })
        http.request.mockResolvedValueOnce(answer({ id: "r1" }))
        http.request.mockResolvedValueOnce(answer({}))

        await expect(client.publicReply(PAGE, "facebook", "C1", " thanks ")).resolves.toEqual({
            ok: true,
            ids: ["r1"],
        })
        await expect(client.publicReply(PAGE, "instagram", "C2", "thanks")).resolves.toEqual({ ok: true, ids: [] })
        expect(http.request).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ url: expect.stringContaining("/C1/comments?") }),
        )
        expect(http.request).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ url: expect.stringContaining("/C2/replies?") }),
        )
    })

    it("refuses empty text, rate limits and reports a failure", async () => {
        const { client, http } = await build({ ...OPTIONS, sendPerMinute: 1 })
        http.request.mockRejectedValueOnce(new Error("down"))

        await expect(client.publicReply(PAGE, "facebook", "C", "")).resolves.toEqual({
            ok: false,
            reason: "empty_text",
        })
        await expect(client.publicReply(PAGE, "facebook", "C", "x")).resolves.toEqual({
            ok: false,
            reason: "error",
            detail: "down",
        })
        await expect(client.publicReply(PAGE, "facebook", "C", "x")).resolves.toEqual({
            ok: false,
            reason: "rate_limited",
        })
    })
})
describe("MetaMessagingClient private replies", () => {
    it("takes the hourly and the send slot", async () => {
        const { client } = await build({ ...OPTIONS, sendPerMinute: 1 })

        expect(client.takePrivateReplySlots("PAGE")).toBe(true)
        expect(client.takePrivateReplySlots("PAGE")).toBe(false)
    })

    it("sends the private message and returns the recipient it reached", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce(answer({ message_id: "m1", recipient_id: "PSID" }))
        http.request.mockResolvedValueOnce(answer({}))
        http.request.mockRejectedValueOnce(new Error("down"))

        await expect(client.privateMessage(PAGE, "facebook", "C", "hello")).resolves.toEqual({
            ok: true,
            ids: ["m1"],
            recipientId: "PSID",
        })
        await expect(client.privateMessage(PAGE, "facebook", "C", "hello")).resolves.toEqual({ ok: true, ids: [] })
        await expect(client.privateMessage(PAGE, "facebook", "C", "  ")).resolves.toEqual({
            ok: false,
            reason: "error",
            detail: "down",
        })
        expect(http.request).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ body: { recipient: { comment_id: "C" }, message: { text: "hello" } } }),
        )
    })
})
describe("MetaMessagingClient private replies", () => {
    it("refuses the exhausted hourly quota and restores it after one hour", async () => {
        const { client, clock } = await build({ ...OPTIONS, sendPerMinute: PRIVATE_REPLIES_PER_HOUR + 1 })

        for (let reply = 0; reply < PRIVATE_REPLIES_PER_HOUR; reply += 1) {
            expect(client.takePrivateReplySlots("PAGE")).toBe(true)
        }
        expect(client.takePrivateReplySlots("PAGE")).toBe(false)
        expect(client.takePrivateReplySlots("OTHER_PAGE")).toBe(true)
        clock.advance(HOUR_MS)
        expect(client.takePrivateReplySlots("PAGE")).toBe(true)
    })
})

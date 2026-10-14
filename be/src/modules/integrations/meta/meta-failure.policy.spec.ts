import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaErrorCode } from "./errors/meta.error"
import { MetaClient } from "./meta.client"
import { HOUR_MS, PRIVATE_REPLIES_PER_HOUR } from "./meta.contracts"
import type { MetaPageAccess } from "./meta.contracts"
import { META_OPTIONS } from "./meta.decorators"
import { MetaLogEvent } from "./meta.log-events"
import type { MetaOptions } from "./meta.options"
import type { GraphErrorFacts } from "./meta-failure.policy"
import { classifyGraphError } from "./meta-failure.policy"

const facts = (partial: GraphErrorFacts): GraphErrorFacts => partial

describe("classifyGraphError", () => {
    it.each<[GraphErrorFacts, string]>([
        [facts({ code: 190 }), "token"],
        [facts({ status: 401 }), "token"],
        [facts({ code: 4 }), "rate_limited"],
        [facts({ code: 17 }), "rate_limited"],
        [facts({ code: 32 }), "rate_limited"],
        [facts({ code: 613 }), "rate_limited"],
        [facts({ code: 80006 }), "rate_limited"],
        [facts({ code: 80002 }), "rate_limited"],
        [facts({ status: 429 }), "rate_limited"],
        [facts({ code: 10, subcode: 2018278 }), "window_expired"],
        [facts({ code: 551 }), "recipient_unavailable"],
        [facts({ code: 100, subcode: 2018001 }), "recipient_unavailable"],
        [facts({ code: 1, subcode: 2018108 }), "recipient_unavailable"],
        [facts({ code: 10, subcode: 1 }), "permission"],
        [facts({ code: 200 }), "permission"],
        [facts({ code: 299 }), "permission"],
        [facts({ code: 1, message: "Already replied in private" }), "already_replied"],
        [facts({ code: 1, message: "private reply already sent" }), "already_replied"],
        [facts({ code: 100, subcode: 33 }), "not_found"],
        [facts({ code: 100, status: 404 }), "not_found"],
        [facts({ code: 100, subcode: 1, status: 400 }), "error"],
        [facts({ code: 199 }), "error"],
        [facts({ code: 300 }), "error"],
        [facts({}), "error"],
        [facts({ code: null, subcode: null }), "error"],
    ])("maps %j to %s", (graph, failure) => {
        expect(classifyGraphError(graph)).toBe(failure)
    })
})

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
            MetaClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: META_OPTIONS, useValue: options },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(MetaClient), http, clock, logger }
}

const answer = (body: unknown, status = 200) => ({ status, body })
const graphError = (error: object, status = 400) => answer({ error }, status)

describe("MetaClient", () => {
    describe("exchangeCode", () => {
        it("keeps the short token when the long exchange fails or says nothing", async () => {
            const { client, http, logger } = await build()
            const cause = new Error("down")
            http.request.mockResolvedValueOnce(answer({ access_token: "short" }))
            http.request.mockRejectedValueOnce(cause)
            http.request.mockResolvedValueOnce(answer({ access_token: "short2" }))
            http.request.mockResolvedValueOnce(answer({}))

            await expect(client.exchangeCode("c")).resolves.toBe("short")
            await expect(client.exchangeCode("c")).resolves.toBe("short2")
            expect(logger.error).toHaveBeenCalledTimes(1)
            expect(logger.error).toHaveBeenCalledWith(
                MetaLogEvent.LongTokenUnavailable,
                expect.objectContaining({ code: MetaErrorCode.Unreachable, cause }),
            )
        })
    })

    describe("graph errors", () => {
        it("classifies a Graph error and keeps Meta's text as the cause", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(
                graphError({ message: "Invalid OAuth access token", code: 190, error_subcode: 460 }, 400),
            )
            http.request.mockResolvedValueOnce(graphError({ message: 42, code: "x" }, 500))
            http.request.mockResolvedValueOnce(answer("bad", 502))
            http.request.mockResolvedValueOnce(answer({ error: { message: "x", code: 4 } }, 200))
            http.request.mockResolvedValueOnce(answer({}, 199))

            await expect(client.listPages("t")).rejects.toMatchObject({
                code: MetaErrorCode.Refused,
                params: { failure: "token", status: 400 },
                cause: expect.objectContaining({ message: "Invalid OAuth access token" }),
            })
            await expect(client.listPages("t")).rejects.toMatchObject({ params: { failure: "error", status: 500 } })
            await expect(client.listPages("t")).rejects.toMatchObject({ params: { failure: "error", status: 502 } })
            await expect(client.listPages("t")).rejects.toMatchObject({
                params: { failure: "rate_limited", status: 200 },
            })
            await expect(client.listPages("t")).rejects.toMatchObject({
                code: MetaErrorCode.Refused,
                params: { failure: "error", status: 199 },
                cause: expect.objectContaining({ message: "Graph 199" }),
            })
        })
    })

    describe("listPages", () => {
        it("ignores malformed rows and treats a missing Instagram account and paging cursor as absent", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(
                answer({
                    data: [null, [], "bad", { id: "P5", access_token: "t5" }],
                    paging: { next: "n", cursors: null },
                }),
            )
            http.request.mockResolvedValueOnce(answer(null))
            http.request.mockResolvedValueOnce(answer([]))

            await expect(client.listPages("t")).resolves.toEqual([
                { id: "P5", name: "P5", category: null, token: "t5", ig: null },
            ])
            expect(http.request).toHaveBeenCalledTimes(1)
            await expect(client.listPages("t")).resolves.toEqual([])
            await expect(client.listPages("t")).resolves.toEqual([])
            expect(http.request).toHaveBeenCalledTimes(3)
        })
    })

    describe("subscriptions", () => {
        it("reports a Page that is not subscribed and an unreadable app subscription", async () => {
            const { client, http, logger } = await build()
            const cause = new Error("down")
            http.request.mockResolvedValueOnce(answer({}))
            http.request.mockRejectedValueOnce(cause)
            http.request.mockResolvedValueOnce(answer({ data: [{ id: "x" }] }))
            http.request.mockResolvedValueOnce(
                answer({ data: [{ object: "page", callback_url: "https://other.test", fields: [] }] }),
            )

            await expect(client.subscriptionStatus({ pageId: "PAGE", pageToken: "ptok" })).resolves.toEqual({
                page: {
                    subscribed: false,
                    fields: [],
                    missing: ["messages", "messaging_postbacks", "feed", "leadgen"],
                },
                app: null,
            })
            const second = await client.subscriptionStatus({ pageId: "PAGE", pageToken: "ptok" })
            expect(second.page.subscribed).toBe(false)
            expect(second.app?.page).toMatchObject({ callbackUrl: "https://other.test", urlMatches: false })
            expect(logger.error).toHaveBeenCalledTimes(1)
            expect(logger.error).toHaveBeenCalledWith(
                MetaLogEvent.AppSubscriptionsUnavailable,
                expect.objectContaining({ code: MetaErrorCode.Unreachable, cause }),
            )
        })

        it("reports an unsubscribed Page when no app or Page subscriptions exist", async () => {
            const { client, http } = await build({ ...OPTIONS, app: null })
            http.request.mockResolvedValueOnce(answer({ data: [] }))

            await expect(client.subscriptionStatus({ pageId: "PAGE", pageToken: "ptok" })).resolves.toEqual({
                page: {
                    subscribed: false,
                    fields: [],
                    missing: ["messages", "messaging_postbacks", "feed", "leadgen"],
                },
                app: null,
            })
            expect(http.request).toHaveBeenCalledTimes(1)
        })
    })

    describe("private replies", () => {
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

    describe("reads", () => {
        it("fetches a profile name from the best field", async () => {
            const { client, http, logger } = await build()
            const cause = new Error("down")
            http.request.mockResolvedValueOnce(answer({ name: " Full Name " }))
            http.request.mockResolvedValueOnce(answer({ first_name: "An", last_name: "B" }))
            http.request.mockResolvedValueOnce(answer({ username: " ig_user " }))
            http.request.mockResolvedValueOnce(answer({}))
            http.request.mockRejectedValueOnce(cause)

            await expect(client.fetchProfileName(PAGE, "facebook", "U")).resolves.toBe("Full Name")
            await expect(client.fetchProfileName(PAGE, "facebook", "U")).resolves.toBe("An B")
            await expect(client.fetchProfileName(PAGE, "instagram", "U")).resolves.toBe("ig_user")
            await expect(client.fetchProfileName(PAGE, "instagram", "U")).resolves.toBeNull()
            await expect(client.fetchProfileName(PAGE, "instagram", "U")).resolves.toBeNull()
            expect(http.request).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    url: expect.stringContaining("fields=name%2Cfirst_name%2Clast_name"),
                    timeoutMs: 5000,
                }),
            )
            expect(logger.error).toHaveBeenCalledTimes(1)
            expect(logger.error).toHaveBeenCalledWith(
                MetaLogEvent.ProfileUnavailable,
                expect.objectContaining({ code: MetaErrorCode.Unreachable, cause }),
            )
        })

        it("fetches the text of a mention", async () => {
            const { client, http, logger } = await build()
            const cause = new Error("down")
            http.request.mockResolvedValueOnce(answer({ mentioned_comment: { text: "hi @shop", username: "u" } }))
            http.request.mockResolvedValueOnce(answer({}))
            http.request.mockRejectedValueOnce(cause)

            await expect(client.fetchMention(PAGE_NO_IG, "C")).resolves.toEqual({ text: null, username: null })
            await expect(client.fetchMention(PAGE, "C")).resolves.toEqual({ text: "hi @shop", username: "u" })
            await expect(client.fetchMention(PAGE, "C")).resolves.toEqual({ text: null, username: null })
            await expect(client.fetchMention(PAGE, "C")).resolves.toEqual({ text: null, username: null })
            expect(logger.error).toHaveBeenCalledTimes(1)
            expect(logger.error).toHaveBeenCalledWith(
                MetaLogEvent.MentionUnavailable,
                expect.objectContaining({ code: MetaErrorCode.Unreachable, cause }),
            )
        })
    })
})

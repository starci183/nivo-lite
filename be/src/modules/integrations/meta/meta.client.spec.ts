import { MetaLogEvent } from "./meta.log-events"
import { createHmac } from "node:crypto"
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
import type { MetaPageAccess } from "./meta.contracts"
import { META_OPTIONS } from "./meta.decorators"
import type { MetaOptions } from "./meta.options"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** A substring matcher, typed `unknown` so it flows into any slot. */
const stringLike = (text: string): unknown => expect.stringContaining(text)

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
            { provide: META_OPTIONS, useValue: { ...options } },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(MetaClient), http, clock, logger }
}

const answer = (body: unknown, status = 200) => ({ status, body })
const graphError = (error: object, status = 400) => answer({ error }, status)

describe("MetaClient configuration and trust", () => {
    it("has a verify token only when its configured value is nonblank", async () => {
        expect((await build()).client.hasVerifyToken()).toBe(true)
        expect((await build({ ...OPTIONS, webhookVerifyToken: new Secret("  ") })).client.hasVerifyToken()).toBe(false)
        expect((await build({ ...OPTIONS, webhookVerifyToken: undefined })).client.hasVerifyToken()).toBe(false)
    })

    it("is configured with an app and a site url, and exposes the callback urls", async () => {
        const { client } = await build()

        expect(client.isConfigured()).toBe(true)
        expect(client.redirectUri()).toBe("https://nivo.vn/api/connections/meta/callback")
        expect(client.webhookUrl()).toBe("https://nivo.vn/api/connections/meta/webhook")
        expect(client.authUrl("s1")).toContain("state=s1")
        expect((await build({ ...OPTIONS, app: null })).client.isConfigured()).toBe(false)
        expect((await build({ ...OPTIONS, siteUrl: undefined })).client.isConfigured()).toBe(false)
    })

    it("signs and verifies a state until it expires", async () => {
        const { client, clock } = await build()
        const state = client.sign({ workspaceId: "ws", userId: "u", returnTo: "/connections?id=c" })

        expect(client.verify(state)).toMatchObject({ w: "ws", p: "meta" })
        clock.advance(11 * 60 * 1000)
        expect(client.verify(state)).toBeNull()
    })

    it("verifies a delivery against the app secret and answers the hub challenge", async () => {
        const { client } = await build()
        const raw = Buffer.from("{}")
        const header = `sha256=${createHmac("sha256", "secret-1").update(raw).digest("hex")}`

        expect(client.verifyDelivery(header, raw)).toBe(true)
        expect(client.verifyDelivery("sha256=00", raw)).toBe(false)
        expect((await build({ ...OPTIONS, app: null })).client.verifyDelivery(header, raw)).toBe(false)
        expect(client.challenge({ mode: "subscribe", verifyToken: "verify-1", challenge: "c" })).toBe("c")
        expect(client.challenge({ mode: "subscribe", verifyToken: "no", challenge: "c" })).toBeNull()
        expect(
            (await build({ ...OPTIONS, webhookVerifyToken: undefined })).client.challenge({
                mode: "subscribe",
                verifyToken: "",
                challenge: "c",
            }),
        ).toBeNull()
    })

    it("parses a webhook body with the clock", async () => {
        const { client } = await build()
        const events = client.parse({
            object: "page",
            entry: [{ id: "P", messaging: [{ sender: { id: "U" }, message: { mid: "m", text: "t" } }] }],
        })

        expect(events[0]?.timestamp).toBe(new Date("2026-10-12T03:00:00.000Z").getTime())
    })
})
describe("MetaClient exchangeCode", () => {
    it("exchanges the code and then asks for the long-lived token", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce(answer({ access_token: "short" }))
        http.request.mockResolvedValueOnce(answer({ access_token: "long" }))

        await expect(client.exchangeCode("code-1")).resolves.toBe("long")
        expect(http.request).toHaveBeenNthCalledWith(
            1,
            objectLike({
                method: "GET",
                url: stringLike("redirect_uri=https%3A%2F%2Fnivo.vn%2Fapi%2Fconnections%2Fmeta%2Fcallback"),
                timeoutMs: 4000,
            }),
        )
    })

    it("refuses without configuration or without a token in the answer", async () => {
        const { client: noApp } = await build({ ...OPTIONS, app: null })
        const { client: noSite } = await build({ ...OPTIONS, siteUrl: undefined })
        const { client, http } = await build()
        http.request.mockResolvedValue(answer({}))

        await expect(noApp.exchangeCode("c")).rejects.toMatchObject({ code: MetaErrorCode.NotConfigured })
        await expect(noSite.exchangeCode("c")).rejects.toMatchObject({ code: MetaErrorCode.NotConfigured })
        await expect(client.exchangeCode("c")).rejects.toMatchObject({ code: MetaErrorCode.ContractMismatch })
    })
})
describe("MetaClient graph errors", () => {
    it("reports an unreachable Meta", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new Error("down"))

        await expect(client.listPages("t")).rejects.toMatchObject({ code: MetaErrorCode.Unreachable })
    })
})
describe("MetaClient listPages", () => {
    it("lists Pages with their Instagram accounts and follows paging", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce(
            answer({
                data: [
                    {
                        id: "P1",
                        name: "One",
                        category: "Shop",
                        access_token: "t1",
                        instagram_business_account: { id: "I1", username: "one", name: "One IG" },
                    },
                    { id: "P2", access_token: "t2", instagram_business_account: {} },
                    { id: "P3" },
                    { name: "no id", access_token: "t" },
                ],
                paging: { next: "n", cursors: { after: "cur" } },
            }),
        )
        http.request.mockResolvedValueOnce(
            answer({
                data: [{ id: "P4", access_token: "t4", instagram_business_account: { id: "I4" } }],
                paging: { cursors: {} },
            }),
        )

        await expect(client.listPages("user-token")).resolves.toEqual([
            {
                id: "P1",
                name: "One",
                category: "Shop",
                token: "t1",
                ig: { id: "I1", username: "one", name: "One IG" },
            },
            { id: "P2", name: "P2", category: null, token: "t2", ig: null },
            { id: "P4", name: "P4", category: null, token: "t4", ig: { id: "I4", username: null, name: null } },
        ])
        expect(http.request).toHaveBeenNthCalledWith(2, objectLike({ url: stringLike("after=cur") }))
    })

    it("stops after four pages and tolerates an answer with no data", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue(answer({ data: [], paging: { next: "n", cursors: { after: "c" } } }))

        await expect(client.listPages("t")).resolves.toEqual([])
        expect(http.request).toHaveBeenCalledTimes(4)
        http.request.mockClear()
        http.request.mockResolvedValue(answer({}))
        await expect(client.listPages("t")).resolves.toEqual([])
        expect(http.request).toHaveBeenCalledTimes(1)
    })
})
describe("MetaClient subscriptions", () => {
    it("subscribes and unsubscribes a Page", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue(answer({ success: true }))

        await client.subscribePage("PAGE", "ptok")
        await client.unsubscribePage("PAGE", "ptok")

        expect(http.request).toHaveBeenNthCalledWith(
            1,
            objectLike({
                method: "POST",
                url: stringLike("subscribed_fields=messages%2Cmessaging_postbacks%2Cfeed%2Cleadgen"),
            }),
        )
        expect(http.request).toHaveBeenNthCalledWith(2, objectLike({ method: "DELETE" }))
    })

    it("points both app objects at the webhook when it can", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue(answer({ success: true }))

        await expect(client.ensureAppSubscriptions()).resolves.toEqual({ done: true })
        expect(http.request).toHaveBeenCalledTimes(2)
        expect(http.request).toHaveBeenNthCalledWith(
            1,
            objectLike({ url: stringLike("access_token=app-1%7Csecret-1") }),
        )
    })

    it("says why it did nothing", async () => {
        await expect((await build({ ...OPTIONS, app: null })).client.ensureAppSubscriptions()).resolves.toEqual({
            done: false,
            reason: "not_configured",
        })
        await expect(
            (await build({ ...OPTIONS, webhookVerifyToken: undefined })).client.ensureAppSubscriptions(),
        ).resolves.toEqual({ done: false, reason: "no_verify_token" })
        await expect(
            (await build({ ...OPTIONS, webhookVerifyToken: new Secret("  ") })).client.ensureAppSubscriptions(),
        ).resolves.toEqual({ done: false, reason: "no_verify_token" })
        await expect(
            (await build({ ...OPTIONS, siteUrl: "http://localhost:3100" })).client.ensureAppSubscriptions(),
        ).resolves.toEqual({ done: false, reason: "local" })
        await expect(
            (await build({ ...OPTIONS, siteUrl: undefined })).client.ensureAppSubscriptions(),
        ).resolves.toEqual({ done: false, reason: "local" })
    })
})
describe("MetaClient subscriptions", () => {
    it("reads what Meta really has", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce(
            answer({ data: [{ id: "other" }, { id: "app-1", subscribed_fields: ["messages", null, 17, "feed"] }] }),
        )
        http.request.mockResolvedValueOnce(
            answer({
                data: [
                    {
                        object: "page",
                        callback_url: "https://nivo.vn/api/connections/meta/webhook",
                        fields: [{ name: "messages" }, {}],
                    },
                    { object: "user" },
                    { object: "instagram" },
                ],
            }),
        )

        const status = await client.subscriptionStatus({ pageId: "PAGE", pageToken: "ptok" })

        expect(status.page).toEqual({
            subscribed: true,
            fields: ["messages", "feed"],
            missing: ["messaging_postbacks", "leadgen"],
        })
        expect(status.app?.page).toMatchObject({ urlMatches: true, fields: ["messages", ""] })
        expect(status.app?.instagram).toEqual({
            callbackUrl: "",
            fields: [],
            missing: ["messages", "comments", "mentions"],
            urlMatches: false,
        })
    })

    it("counts a subscription that lists no fields", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce(answer({ data: [{ id: "app-1" }] }))
        http.request.mockRejectedValueOnce(new Error("down"))

        await expect(client.subscriptionStatus({ pageId: "PAGE", pageToken: "ptok" })).resolves.toMatchObject({
            page: { subscribed: true, fields: [] },
        })
    })

    it("takes the first subscription when there is no app to compare with", async () => {
        const { client, http } = await build({ ...OPTIONS, app: null })
        http.request.mockResolvedValueOnce(answer({ data: [{ id: "any", subscribed_fields: ["messages"] }] }))

        const status = await client.subscriptionStatus({ pageId: "PAGE", pageToken: "ptok" })

        expect(status.page.subscribed).toBe(true)
        expect(status.app).toBeNull()
    })
})
describe("MetaClient reads", () => {
    it("fetches and parses a lead", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue(answer({ field_data: [{ name: "email", values: ["a@b.vn"] }] }))

        await expect(client.fetchLead(PAGE, "L1")).resolves.toMatchObject({ email: "a@b.vn" })
    })
})

describe("MetaClient exchangeCode", () => {
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
            MetaLogEvent.LongLivedUnavailable,
            objectLike({ code: MetaErrorCode.Unreachable, cause }),
        )
    })
})
describe("MetaClient graph errors", () => {
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
            cause: objectLike({ message: "Invalid OAuth access token" }),
        })
        await expect(client.listPages("t")).rejects.toMatchObject({ params: { failure: "error", status: 500 } })
        await expect(client.listPages("t")).rejects.toMatchObject({ params: { failure: "error", status: 502 } })
        await expect(client.listPages("t")).rejects.toMatchObject({
            params: { failure: "rate_limited", status: 200 },
        })
        await expect(client.listPages("t")).rejects.toMatchObject({
            code: MetaErrorCode.Refused,
            params: { failure: "error", status: 199 },
            cause: objectLike({ message: "Graph 199" }),
        })
    })
})
describe("MetaClient listPages", () => {
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
describe("MetaClient subscriptions", () => {
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
            objectLike({ code: MetaErrorCode.Unreachable, cause }),
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
describe("MetaClient reads", () => {
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
            objectLike({
                url: stringLike("fields=name%2Cfirst_name%2Clast_name"),
                timeoutMs: 5000,
            }),
        )
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(
            MetaLogEvent.ProfileUnavailable,
            objectLike({ code: MetaErrorCode.Unreachable, cause }),
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
            objectLike({ code: MetaErrorCode.Unreachable, cause }),
        )
    })
})

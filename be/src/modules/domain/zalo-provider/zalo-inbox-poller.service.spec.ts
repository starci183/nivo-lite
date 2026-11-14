import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { PollLimiterService } from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ZALO, ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import type { ZaloChatMessage, ZaloClient } from "@modules/integrations/zalo"
import { CLOCK } from "@modules/platform/clock"
import { ZALO_ACCESS_TOKENS, type ZaloAccessTokens } from "./zalo-access-tokens.port"
import { ZALO_PROVIDER_OPTIONS } from "./zalo-provider.decorators"
import type { ZaloProviderConfig } from "./zalo-provider.options"
import { ZaloInboxPollerService } from "./zalo-inbox-poller.service"
import { ZALO_PLAN_LACKS_READING_NOTICE } from "./messages/zalo-provider.messages"
import { ZALO_POLL_PAGE_SIZE } from "./zalo-poll.policy"

const NOW = "2026-11-04T10:00:00.000Z"
const HOUR = 3_600_000
const at = (hoursAgo: number): number => Date.parse(NOW) - hoursAgo * HOUR

const connection = mock<ConnectionRecord>({
    id: "c-1",
    workspaceId: "ws-1",
    provider: "zalo_oa",
    meta: {},
    status: "connected",
    environment: "live",
})

const chat = (over: Partial<ZaloChatMessage>): ZaloChatMessage => ({
    messageId: "m-1",
    userId: "user-1",
    userName: "Bui Nguyen Dinh",
    fromUser: true,
    kind: "text",
    text: "I need advice",
    sentAt: at(1),
    ...over,
})

const window = { from: new Date(at(24 * 7)), to: undefined, limit: 200 }

const build = async (options: ZaloProviderConfig = {}) => {
    const zalo = mock<ZaloClient>()
    const tokens = mock<ZaloAccessTokens>()
    tokens.tokenOf.mockResolvedValue({ kind: "token", token: "token" })
    tokens.failureOf.mockReturnValue(null)
    const limiter = mock<PollLimiterService>()
    limiter.pass.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloInboxPollerService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: PollLimiterService, useValue: limiter },
            { provide: ZALO, useValue: zalo },
            { provide: ZALO_PROVIDER_OPTIONS, useValue: { ...options } },
            { provide: ZALO_ACCESS_TOKENS, useValue: tokens },
        ],
    }).compile()
    return { poller: moduleRef.get(ZaloInboxPollerService), zalo, tokens, limiter }
}

describe("ZaloInboxPollerService fetch", () => {
    it("reads the conversations that moved and answers the customer texts as one page with the newest and oldest instant", async () => {
        const { poller, zalo } = await build()
        zalo.recentChats.mockResolvedValue([
            chat({ messageId: "r-1", userId: "user-1" }),
            chat({ messageId: "r-2", userId: "user-1", fromUser: false }),
        ])
        zalo.conversation.mockResolvedValue([
            chat({ messageId: "m-3", sentAt: at(1) }),
            chat({ messageId: "m-2", kind: "photo", text: "", sentAt: at(2) }),
            chat({ messageId: "m-1", text: "   ", sentAt: at(3) }),
            chat({ messageId: "o-1", fromUser: false, sentAt: at(2) }),
        ])

        const page = await poller.fetch(connection, window)

        expect(zalo.conversation).toHaveBeenCalledTimes(1)
        expect(zalo.conversation).toHaveBeenCalledWith("token", "user-1", 0)
        expect(page).toEqual({
            kind: "page",
            items: [expect.objectContaining({ messageId: "m-3" })],
            fetched: 3,
            oldestAt: new Date(at(3)),
            newestAt: new Date(at(1)),
        })
    })

    it("answers an empty page when nothing moved inside the window", async () => {
        const { poller, zalo } = await build()
        zalo.recentChats.mockResolvedValue([chat({ sentAt: at(24 * 8) })])

        await expect(poller.fetch(connection, window)).resolves.toEqual({
            kind: "page",
            items: [],
            fetched: 0,
            oldestAt: undefined,
            newestAt: undefined,
        })
        expect(zalo.conversation).not.toHaveBeenCalled()
    })
})

describe("ZaloInboxPollerService fetch paging", () => {
    it("pages a full list on, keeps only rows between the window ends and stops once a row is older than the window", async () => {
        const { poller, zalo } = await build()
        const full = Array.from({ length: ZALO_POLL_PAGE_SIZE }, (_row, index) =>
            chat({ messageId: `n-${index}`, userId: `u-${index}`, sentAt: at(1 + index / 100) }),
        )
        zalo.recentChats
            .mockResolvedValueOnce(full)
            .mockResolvedValueOnce([chat({ userId: "old", sentAt: at(24 * 9) })])
        zalo.conversation.mockResolvedValue([])

        await poller.fetch(connection, { ...window, to: new Date(at(0.5)) })

        expect(zalo.recentChats).toHaveBeenNthCalledWith(2, "token", ZALO_POLL_PAGE_SIZE)
        expect(zalo.conversation).toHaveBeenCalledTimes(ZALO_POLL_PAGE_SIZE)
    })

    it("stops at the page limit", async () => {
        const { poller, zalo } = await build()
        zalo.recentChats.mockResolvedValue(
            Array.from({ length: ZALO_POLL_PAGE_SIZE }, (_row, index) =>
                chat({ userId: "same", sentAt: at(1 + index / 100) }),
            ),
        )
        zalo.conversation.mockResolvedValue([])

        await poller.fetch(connection, window)

        expect(zalo.recentChats).toHaveBeenCalledTimes(30)
    })

    it("leaves out a connection whose credential is unusable or holds no access token, as its token port says", async () => {
        const { poller, tokens, zalo } = await build()
        tokens.tokenOf.mockResolvedValueOnce({ kind: "skipped", reason: "not_ready" })
        await expect(poller.fetch(connection, window)).resolves.toEqual({ kind: "skipped", reason: "not_ready" })

        tokens.tokenOf.mockResolvedValueOnce({ kind: "skipped", reason: "no_token" })
        await expect(poller.fetch(connection, window)).resolves.toEqual({ kind: "skipped", reason: "no_token" })
        expect(zalo.recentChats).not.toHaveBeenCalled()
        expect(tokens.tokenOf).toHaveBeenCalledWith("c-1")
    })
})

describe("ZaloInboxPollerService stale messages", () => {
    it("marks each text fresh or past the stale age, with the name the listing shows; it stores nothing itself", async () => {
        const { poller, zalo } = await build({ staleAfterMs: HOUR })
        zalo.recentChats.mockResolvedValue([chat({ userId: "user-1", sentAt: at(0.5) })])
        zalo.conversation.mockResolvedValue([
            chat({ messageId: "new", sentAt: at(0.5) }),
            chat({ messageId: "old", userName: "", sentAt: at(2) }),
        ])

        const page = await poller.fetch(connection, window)

        expect(
            page.kind === "page" ? page.items.map((item) => [item.messageId, item.userName, item.stale]) : [],
        ).toEqual([
            ["new", "Bui Nguyen Dinh", false],
            ["old", "", true],
        ])
        expect("store" in poller).toBe(false)
    })
})

describe("ZaloInboxPollerService limits and the limiter", () => {
    it("declares what one OA may call", async () => {
        const { poller } = await build()

        expect(poller.provider).toBe("zalo_oa")
        expect(poller.limits).toEqual({ ratePerSecond: 2, burst: 4, concurrency: 2 })
    })

    it("takes a token of the connection's bucket before every call to Zalo", async () => {
        const { poller, zalo, limiter } = await build()
        zalo.recentChats.mockResolvedValue([chat({ userId: "user-1" }), chat({ userId: "user-2" })])
        zalo.conversation.mockResolvedValue([])

        await poller.fetch(connection, window)

        expect(limiter.pass).toHaveBeenCalledTimes(3)
        expect(limiter.pass).toHaveBeenCalledWith("zalo_oa", "c-1", poller.limits)
    })
})

describe("ZaloInboxPollerService classify", () => {
    it.each([
        [
            "a refused access token",
            new ZaloError({ code: ZaloErrorCode.TokenRejected }),
            { kind: "auth_failed", reason: "credential" },
        ],
        [
            "a refused refresh of the tokens (the refresh token is used up, expired or revoked)",
            new ZaloError({ code: ZaloErrorCode.TokenRefreshRefused, params: { zaloCode: -118 } }),
            { kind: "auth_failed", reason: "credential" },
        ],
        [
            "an OA tier package that lacks the feature",
            new ZaloError({
                code: ZaloErrorCode.Rejected,
                params: { zaloCode: -224, reason: "The OA needs to upgrade OA Tier Package to use this feature" },
            }),
            { kind: "unavailable", reason: "plan", notice: ZALO_PLAN_LACKS_READING_NOTICE },
        ],
        [
            "an app or OA without the permission",
            new ZaloError({ code: ZaloErrorCode.NotPermitted }),
            { kind: "auth_failed", reason: "permission" },
        ],
        [
            "a refusal that says in words the permission is missing but carries no listed numeric error (words decide nothing: it is given up on, the connection shows degraded)",
            new ZaloError({ code: ZaloErrorCode.Rejected, params: { reason: "Application does not have permission" } }),
            { kind: "fatal" },
        ],
        [
            "a listed numeric error of a missing permission",
            new ZaloError({ code: ZaloErrorCode.NotPermitted, params: { zaloCode: -138 } }),
            { kind: "auth_failed", reason: "permission" },
        ],
        ["a refusal that explains nothing", new ZaloError({ code: ZaloErrorCode.Rejected }), { kind: "fatal" }],
        [
            "an exhausted quota",
            new ZaloError({ code: ZaloErrorCode.QuotaExhausted }),
            { kind: "rate_limited", retryAfterSeconds: 0 },
        ],
        ["an unreachable Zalo", new ZaloError({ code: ZaloErrorCode.Unavailable }), { kind: "transient" }],
        ["any other Zalo refusal", new ZaloError({ code: ZaloErrorCode.TemplateRejected }), { kind: "fatal" }],
        ["anything the token port does not claim", new Error("boom"), { kind: "fatal" }],
    ])("maps %s", async (_name, error, expected) => {
        const { poller } = await build()

        expect(poller.classify(error)).toEqual(expected)
    })

    it("reads a failure of the credential side as its token port classifies it", async () => {
        const { poller, tokens } = await build()
        const busy = new Error("refresh busy")
        tokens.failureOf.mockImplementation((error) => (error === busy ? { kind: "transient" } : null))

        expect(poller.classify(busy)).toEqual({ kind: "transient" })
        expect(tokens.failureOf).toHaveBeenCalledWith(busy)
    })
})

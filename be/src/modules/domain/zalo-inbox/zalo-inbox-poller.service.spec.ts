import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ZaloCredentialsService } from "@modules/domain/channels"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ZALO } from "@modules/integrations/zalo"
import type { ZaloChatMessage, ZaloClient } from "@modules/integrations/zalo"
import { CLOCK } from "@modules/platform/clock"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { ZALO_INBOX_OPTIONS } from "./zalo-inbox.decorators"
import { ZaloInboxPoller } from "./zalo-inbox-poller.service"
import { ZaloInboxService } from "./zalo-inbox.service"
import { ZALO_POLL_PAGE_SIZE } from "./zalo-poll.policy"

const NOW = "2026-11-04T10:00:00.000Z"
const HOUR = 3_600_000
const at = (hoursAgo: number): number => Date.parse(NOW) - hoursAgo * HOUR

const connection = {
    id: "c-1",
    workspaceId: "ws-1",
    provider: "zalo_oa",
    meta: {},
    status: "connected",
    environment: "live",
} as ConnectionRecord

const chat = (over: Partial<ZaloChatMessage>): ZaloChatMessage => ({
    messageId: "m-1",
    userId: "user-1",
    userName: "Bui Nguyen Dinh",
    fromUser: true,
    kind: "text",
    text: "Tôi cần tư vấn",
    sentAt: at(1),
    ...over,
})

const window = { from: new Date(at(24 * 7)), to: undefined, limit: 200 }

const build = async (options = {}) => {
    const zalo = mock<ZaloClient>()
    const credentials = mock<ZaloCredentialsService>()
    credentials.load.mockResolvedValue({
        kind: "ok",
        value: { secret: { appId: "a", appSecret: "s", oaSecret: "o", accessToken: "t" }, expiresAt: null, workspaceId: "ws-1" },
    })
    credentials.accessToken.mockResolvedValue("token")
    const inbox = mock<ZaloInboxService>()
    inbox.acceptPolledMessage.mockResolvedValue(true)
    const timer = mock<Timer>()
    timer.schedule.mockImplementation((callback) => {
        callback()
        return () => undefined
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloInboxPoller,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: TIMER, useValue: timer },
            { provide: ZALO, useValue: zalo },
            { provide: ZALO_INBOX_OPTIONS, useValue: options },
            { provide: ZaloCredentialsService, useValue: credentials },
            { provide: ZaloInboxService, useValue: inbox },
        ],
    }).compile()
    return { poller: moduleRef.get(ZaloInboxPoller), zalo, credentials, inbox }
}

describe("ZaloInboxPoller fetch", () => {
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

    it("pages a full list on, keeps only rows between the window ends and stops once a row is older than the window", async () => {
        const { poller, zalo } = await build()
        const full = Array.from({ length: ZALO_POLL_PAGE_SIZE }, (_row, index) =>
            chat({ messageId: `n-${index}`, userId: `u-${index}`, sentAt: at(1 + index / 100) }),
        )
        zalo.recentChats.mockResolvedValueOnce(full).mockResolvedValueOnce([chat({ userId: "old", sentAt: at(24 * 9) })])
        zalo.conversation.mockResolvedValue([])

        await poller.fetch(connection, { ...window, to: new Date(at(0.5)) })

        expect(zalo.recentChats).toHaveBeenNthCalledWith(2, "token", ZALO_POLL_PAGE_SIZE)
        expect(zalo.conversation).toHaveBeenCalledTimes(ZALO_POLL_PAGE_SIZE)
    })

    it("stops at the page limit", async () => {
        const { poller, zalo } = await build()
        zalo.recentChats.mockResolvedValue(
            Array.from({ length: ZALO_POLL_PAGE_SIZE }, (_row, index) => chat({ userId: "same", sentAt: at(1 + index / 100) })),
        )
        zalo.conversation.mockResolvedValue([])

        await poller.fetch(connection, window)

        expect(zalo.recentChats).toHaveBeenCalledTimes(30)
    })

    it("leaves out a connection whose credential is unusable or holds no access token", async () => {
        const { poller, credentials, zalo } = await build()
        credentials.load.mockResolvedValueOnce({ kind: "refused", code: "x" as never })
        await expect(poller.fetch(connection, window)).resolves.toEqual({ kind: "skipped", reason: "not_ready" })

        credentials.load.mockResolvedValueOnce({
            kind: "ok",
            value: { secret: { appId: "a", appSecret: "s", oaSecret: "o" }, expiresAt: null, workspaceId: "ws-1" },
        })
        await expect(poller.fetch(connection, window)).resolves.toEqual({ kind: "skipped", reason: "no_token" })
        expect(zalo.recentChats).not.toHaveBeenCalled()
    })
})

describe("ZaloInboxPoller store", () => {
    it("hands a fresh message to the inbox for the connection and the customer name", async () => {
        const { poller, inbox } = await build()

        await expect(poller.store(connection, chat({}))).resolves.toBe(true)

        expect(inbox.acceptPolledMessage).toHaveBeenCalledWith(
            "c-1",
            { messageId: "m-1", userId: "user-1", text: "Tôi cần tư vấn", sentAt: at(1) },
            { workspaceId: "ws-1", sender: "Bui Nguyen Dinh", stale: false },
        )
    })

    it("marks a message past the stale age and names the customer by id when Zalo gave no name", async () => {
        const { poller, inbox } = await build({ staleAfterMs: HOUR })

        await poller.store(connection, chat({ userName: "", sentAt: at(2) }))

        expect(inbox.acceptPolledMessage).toHaveBeenCalledWith(
            "c-1",
            expect.anything(),
            { workspaceId: "ws-1", sender: "user-1", stale: true },
        )
    })

    it("answers false for a message the inbox already has", async () => {
        const { poller, inbox } = await build()
        inbox.acceptPolledMessage.mockResolvedValue(false)

        await expect(poller.store(connection, chat({}))).resolves.toBe(false)
    })
})

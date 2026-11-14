import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ZaloInboxPollerService, type PolledZaloItem } from "@modules/domain/zalo-provider"
import { ZaloInboxService } from "./zalo-inbox.service"
import { ZaloPolledInboxService } from "./zalo-polled-inbox.service"

const limits = { ratePerSecond: 2, burst: 4, concurrency: 2 }

const connection = mock<ConnectionRecord>({ id: "c-1", workspaceId: "ws-1", provider: "zalo_oa" })

const item = (over: Partial<PolledZaloItem> = {}): PolledZaloItem => ({
    messageId: "m-1",
    userId: "user-1",
    userName: "Bui Nguyen Dinh",
    fromUser: true,
    kind: "text",
    text: "I need advice",
    sentAt: 1_762_192_200_000,
    stale: false,
    ...over,
})

const build = async () => {
    const poller = mock<ZaloInboxPollerService>({ provider: "zalo_oa", limits })
    const inbox = mock<ZaloInboxService>()
    inbox.acceptPolledMessage.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloPolledInboxService,
            { provide: ZaloInboxPollerService, useValue: poller },
            { provide: ZaloInboxService, useValue: inbox },
        ],
    }).compile()
    return { polled: moduleRef.get(ZaloPolledInboxService), poller, inbox }
}

describe("ZaloPolledInboxService", () => {
    it("reads through the provider and is the provider's source for the scheduler (its key, limits and error classes)", async () => {
        const { polled, poller } = await build()
        const page = { kind: "page" as const, items: [item()], fetched: 1, oldestAt: undefined, newestAt: undefined }
        poller.fetch.mockResolvedValue(page)
        poller.classify.mockReturnValue({ kind: "transient" })
        const window = { from: new Date(0), to: undefined, limit: 200 }

        await expect(polled.fetch(connection, window)).resolves.toBe(page)
        expect(poller.fetch).toHaveBeenCalledWith(connection, window)
        expect([polled.provider, polled.limits, polled.classify(new Error("x"))]).toEqual(["zalo_oa", limits, { kind: "transient" }])
    })

    it("keeps a fresh polled text through the inbox the webhook feeds, with the listed name", async () => {
        const { polled, inbox } = await build()

        await expect(polled.store(connection, item())).resolves.toBe(true)

        expect(inbox.acceptPolledMessage).toHaveBeenCalledWith(
            "c-1",
            { messageId: "m-1", userId: "user-1", userName: "Bui Nguyen Dinh", text: "I need advice", sentAt: 1_762_192_200_000 },
            { workspaceId: "ws-1", sender: "Bui Nguyen Dinh", stale: false },
        )
    })

    it("hands a stale one on as stale and names the customer by id when the listing gave no name", async () => {
        const { polled, inbox } = await build()

        await polled.store(connection, item({ userName: "", stale: true }))

        expect(inbox.acceptPolledMessage).toHaveBeenCalledWith("c-1", expect.objectContaining({ userName: "" }), {
            workspaceId: "ws-1",
            sender: "user-1",
            stale: true,
        })
    })

    it("answers false for a message the inbox already has", async () => {
        const { polled, inbox } = await build()
        inbox.acceptPolledMessage.mockResolvedValue(false)

        await expect(polled.store(connection, item())).resolves.toBe(false)
    })
})

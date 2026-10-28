import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { EntityManager } from "typeorm"
import { ConversationsService } from "@modules/domain/conversations"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox, InboxReceipt } from "@modules/platform/inbox"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { ZaloInboxService } from "./zalo-inbox.service"
import { ZALO_DELIVERY_QUEUE } from "./zalo-inbox.contracts"
import { INSERT_ZALO_INBOX, FIND_PENDING_ZALO_INBOX, COMPLETE_ZALO_INBOX } from "./persistence/zalo-inbox.sql"

const body = Buffer.from(
    JSON.stringify({
        app_id: "app-1",
        event_name: "user_send_text",
        sender: { id: "user-1" },
        message: { msg_id: "m-1", text: "Hello" },
    }),
)
const payload = { connection: "c-1", rawBody: body.toString("utf8") }

const build = async (pending = [{ id: "receipt-1", payload }], claimed = [{ id: "receipt-1" }]) => {
    const tx = fakeTransaction(
        mockEntityManager({
            query: [
                [INSERT_ZALO_INBOX, claimed],
                [FIND_PENDING_ZALO_INBOX, pending],
                [COMPLETE_ZALO_INBOX, []],
            ],
        }),
    )
    const conversations = mock<ConversationsService>()
    conversations.acceptZalo.mockResolvedValue(undefined)
    const inbox = fakeInbox()
    const claim = inbox.claim.bind(inbox)
    const claimReceipt: Inbox["claim"] = async (
        source: string,
        eventId: string,
        manager?: EntityManager,
        receipt?: InboxReceipt,
    ) => {
        if (eventId === "" || manager === undefined || receipt === undefined) return false
        const rows = await manager.query<Array<{ readonly id: string }>>(receipt.insert, [
            source,
            eventId,
            JSON.stringify(receipt.payload),
        ])
        return rows.length > 0 && claim(source, eventId)
    }
    inbox.claim = claimReceipt
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloInboxService,
            { provide: INBOX, useValue: inbox },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: ConversationsService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloInboxService), tx, conversations, outbox, write }
}

describe("ZaloInboxService receipt delivery", () => {
    it("claims the connection-prefixed message identity and defers conversation effects", async () => {
        const { service, tx, conversations, write } = await build()
        await service.acceptZaloDelivery(body, "c-1")
        const manager = write.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(tx.em.query.mock.calls).toEqual([[INSERT_ZALO_INBOX, ["zalo", "c-1:m-1", JSON.stringify(payload)]]])
        expect(write).toHaveBeenCalledWith(
            manager,
            ZALO_DELIVERY_QUEUE,
            { deliveryId: "c-1:m-1" },
            { dedupeKey: "zalo-delivery:c-1:m-1" },
        )
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
    })

    it("does not publish duplicates", async () => {
        const { service, outbox, tx, conversations } = await build([], [])
        await service.acceptZaloDelivery(body, "c-1")
        expect(outbox.jobs).toEqual([])
        expect(tx.commits).toBe(1)
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
    })

    it("ignores unreadable deliveries without a claim", async () => {
        const { service, tx, outbox } = await build()
        await service.acceptZaloDelivery(undefined, "c-1")
        expect(tx.em.query).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })

    it("rolls back the intake if publication fails", async () => {
        const { service, tx, outbox } = await build()
        const failure = new Error("publication failed")
        outbox.failNext("write", failure)
        await expect(service.acceptZaloDelivery(body, "c-1")).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
    })
})

describe("ZaloInboxService deferred effects", () => {
    it("locks the pending receipt and completes it after the conversation effect", async () => {
        const { service, tx, conversations } = await build()
        conversations.acceptZalo.mockImplementation((_connection, _message, manager) => {
            expect(isTransactionManager(manager)).toBe(true)
            expect(tx.em.query.mock.calls).toEqual([[FIND_PENDING_ZALO_INBOX, ["c-1:m-1"]]])
            return Promise.resolve()
        })
        await service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(conversations.acceptZalo).toHaveBeenCalledTimes(1)
        expect(conversations.acceptZalo).toHaveBeenCalledWith(
            "c-1",
            { appId: "app-1", userId: "user-1", messageId: "m-1", text: "Hello" },
            conversations.acceptZalo.mock.calls[0]?.[2],
        )
        expect(tx.em.query.mock.calls).toEqual([
            [FIND_PENDING_ZALO_INBOX, ["c-1:m-1"]],
            [COMPLETE_ZALO_INBOX, ["receipt-1"]],
        ])
        expect(tx.commits).toBe(1)
    })

    it("does not repeat a missing or completed receipt", async () => {
        const { service, conversations, tx } = await build([])
        await service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
        expect(tx.em.query.mock.calls).toEqual([[FIND_PENDING_ZALO_INBOX, ["c-1:m-1"]]])
    })
})

describe("ZaloInboxService consumer recovery", () => {
    it("completes an ignored decoded message without a conversation effect", async () => {
        const { service, conversations, tx } = await build([
            {
                id: "receipt-1",
                payload: { connection: "c-1", rawBody: "{}" },
            },
        ])
        await service.processRecordedDelivery({ deliveryId: "c-1:m-1" })
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
        expect(tx.em.query).toHaveBeenCalledWith(COMPLETE_ZALO_INBOX, ["receipt-1"])
    })

    it("leaves completion unwritten and rolls back a failed consumer", async () => {
        const { service, tx, conversations } = await build()
        const failure = new Error("conversation failed")
        conversations.acceptZalo.mockRejectedValue(failure)
        await expect(service.processRecordedDelivery({ deliveryId: "c-1:m-1" })).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.em.query.mock.calls).toEqual([[FIND_PENDING_ZALO_INBOX, ["c-1:m-1"]]])
    })
})

describe("ZaloInboxService non-text events", () => {
    it("claims a follow event under its own connection-scoped id and completes it without a conversation effect", async () => {
        const { service, tx, conversations, write } = await build()
        const follow = JSON.stringify({ event_name: "follow", timestamp: "1700", follower: { id: "user-9" } })
        await service.acceptZaloDelivery(Buffer.from(follow), "c-1")
        expect(tx.em.query.mock.calls[0]?.[1]?.[1]).toBe("c-1:follow:1700:user-9")
        expect(write).toHaveBeenCalledWith(
            expect.anything(),
            ZALO_DELIVERY_QUEUE,
            { deliveryId: "c-1:follow:1700:user-9" },
            { dedupeKey: "zalo-delivery:c-1:follow:1700:user-9" },
        )
        expect(conversations.acceptZalo).not.toHaveBeenCalled()
    })
})

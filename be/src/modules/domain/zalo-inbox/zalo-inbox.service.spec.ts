import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConversationsService } from "@modules/domain/conversations"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { COMPLETE_ZALO_INBOX, INSERT_ZALO_INBOX } from "./persistence/zalo-inbox.sql"
import { ZaloInboxService } from "./zalo-inbox.service"

const BODY = Buffer.from(
    JSON.stringify({
        app_id: "app-1",
        event_name: "user_send_text",
        sender: { id: "user-1" },
        message: { msg_id: "m-1", text: "Hello" },
    }),
)

const build = async (claimed: ReadonlyArray<{ id: string }>) => {
    const tx = fakeTransaction(
        mockEntityManager({
            query: [
                [INSERT_ZALO_INBOX, claimed],
                [COMPLETE_ZALO_INBOX, claimed],
            ],
        }),
    )
    const conversations = mock<ConversationsService>()
    conversations.acceptZalo.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloInboxService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: ConversationsService, useValue: conversations },
        ],
    }).compile()
    return { inbox: moduleRef.get(ZaloInboxService), tx, conversations }
}

describe("ZaloInboxService", () => {
    describe("acceptZaloDelivery", () => {
        it("claims a new message, stores it in the transaction and marks the delivery complete", async () => {
            const { inbox, tx, conversations } = await build([{ id: "inbox-1" }])

            await inbox.acceptZaloDelivery("c-1", BODY)

            expect(tx.commits).toBe(1)
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_ZALO_INBOX, [
                "zalo",
                "c-1:m-1",
                JSON.stringify({ connectionId: "c-1", messageId: "m-1" }),
            ])
            expect(conversations.acceptZalo).toHaveBeenCalledWith(
                "c-1",
                { appId: "app-1", userId: "user-1", messageId: "m-1", text: "Hello" },
                expect.anything(),
            )
            expect(tx.em.query).toHaveBeenCalledWith(COMPLETE_ZALO_INBOX, ["inbox-1"])
        })

        it("acknowledges a redelivered message without storing it again", async () => {
            const { inbox, tx, conversations } = await build([])

            await inbox.acceptZaloDelivery("c-1", BODY)

            expect(tx.commits).toBe(1)
            expect(conversations.acceptZalo).not.toHaveBeenCalled()
        })

        it("acknowledges an event that is not a customer text without claiming it", async () => {
            const { inbox, tx, conversations } = await build([{ id: "inbox-1" }])

            await inbox.acceptZaloDelivery("c-1", Buffer.from(JSON.stringify({ event_name: "follow" })))

            expect(tx.em.query).not.toHaveBeenCalled()
            expect(conversations.acceptZalo).not.toHaveBeenCalled()
        })
    })
})

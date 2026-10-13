import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConversationsService } from "@modules/domain/conversations"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { COMPLETE_TELEGRAM_INBOX, INSERT_TELEGRAM_INBOX } from "./persistence/telegram-inbox.sql"
import { TelegramInboxService } from "./telegram-inbox.service"

const BODY = Buffer.from(
    JSON.stringify({
        update_id: 77,
        message: { message_id: 9, chat: { id: 555 }, text: "Hello", from: { first_name: "Minh" } },
    }),
)

const build = async (claimed: ReadonlyArray<{ id: string }>) => {
    const tx = fakeTransaction(
        mockEntityManager({
            query: [
                [INSERT_TELEGRAM_INBOX, claimed],
                [COMPLETE_TELEGRAM_INBOX, claimed],
            ],
        }),
    )
    const conversations = mock<ConversationsService>()
    conversations.acceptTelegram.mockResolvedValue(undefined)
    const catalog: MessageCatalog = { get: (key) => key }
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramInboxService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ConversationsService, useValue: conversations },
        ],
    }).compile()
    return { inbox: moduleRef.get(TelegramInboxService), tx, conversations }
}

describe("TelegramInboxService", () => {
    describe("acceptTelegramDelivery", () => {
        it("claims a new update, stores the message in the transaction and marks the delivery complete", async () => {
            const { inbox, tx, conversations } = await build([{ id: "inbox-1" }])

            await inbox.acceptTelegramDelivery("c-1", BODY)

            expect(tx.commits).toBe(1)
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_TELEGRAM_INBOX, [
                "telegram",
                "c-1:77",
                JSON.stringify({ connectionId: "c-1", updateId: 77, messageId: 9 }),
            ])
            expect(conversations.acceptTelegram).toHaveBeenCalledWith(
                "c-1",
                { updateId: 77, chatId: "555", messageId: 9, text: "Hello", visitor: "Minh", isStart: false },
                expect.anything(),
            )
            expect(tx.em.query).toHaveBeenCalledWith(COMPLETE_TELEGRAM_INBOX, ["inbox-1"])
        })

        it("labels a photo with the localized text in brackets", async () => {
            const { inbox, conversations } = await build([{ id: "inbox-1" }])
            const photo = Buffer.from(
                JSON.stringify({
                    update_id: 78,
                    message: { message_id: 10, chat: { id: 555 }, photo: [{}], caption: "Paid" },
                }),
            )

            await inbox.acceptTelegramDelivery("c-1", photo)

            expect(conversations.acceptTelegram).toHaveBeenCalledWith(
                "c-1",
                expect.objectContaining({ text: "[conversations.photoSent] Paid" }),
                expect.anything(),
            )
        })

        it("acknowledges a redelivered update without storing the message again", async () => {
            const { inbox, tx, conversations } = await build([])

            await inbox.acceptTelegramDelivery("c-1", BODY)

            expect(tx.commits).toBe(1)
            expect(conversations.acceptTelegram).not.toHaveBeenCalled()
        })

        it("acknowledges an update the chat does not answer without claiming it", async () => {
            const { inbox, tx, conversations } = await build([{ id: "inbox-1" }])

            await inbox.acceptTelegramDelivery(
                "c-1",
                Buffer.from(JSON.stringify({ update_id: 79, edited_message: {} })),
            )

            expect(tx.em.query).not.toHaveBeenCalled()
            expect(conversations.acceptTelegram).not.toHaveBeenCalled()
        })
    })
})

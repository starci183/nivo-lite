import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { ChatActivityService } from "@modules/domain/chat-activity"
import { MessagesService } from "./messages.service"
import { MessageEntity } from "./persistence/entities"

/** Hands a literal to an expectation as a plain object, so it is not mistaken for a hand-built entity row. */
const plain = (value: object): object => value

const build = async () => {
    const activity = mock<ChatActivityService>()
    const moduleRef = await Test.createTestingModule({
        providers: [MessagesService, { provide: ChatActivityService, useValue: activity }],
    }).compile()
    return { messages: moduleRef.get(MessagesService), activity }
}

describe("MessagesService", () => {
    describe("postSystem", () => {
        it("writes the line inside the transaction of the caller", async () => {
            const tx = fakeTransaction(mockEntityManager({ insert: [MessageEntity, {}] }))
            const { messages, activity } = await build()

            await tx.em.transaction((manager) =>
                messages.postSystem({ workspaceId: "ws-1", leadId: "lead-1", body: "Anh Minh moved to won.", manager }),
            )

            expect(activity.message).toHaveBeenCalledWith("ws-1", "room:office", null, expect.anything())

            expect(tx.committedWrites).toEqual([
                {
                    method: "insert",
                    args: [
                        MessageEntity,
                        plain({
                            workspaceId: "ws-1",
                            leadId: "lead-1",
                            authorKind: "system",
                            authorName: "NIVO",
                            body: "Anh Minh moved to won.",
                        }),
                    ],
                },
            ])
        })

        it("writes a line about no lead", async () => {
            const tx = fakeTransaction(mockEntityManager({ insert: [MessageEntity, {}] }))
            const { messages } = await build()

            await tx.em.transaction((manager) =>
                messages.postSystem({ workspaceId: "ws-1", leadId: null, body: "Hello", manager }),
            )

            expect(tx.committedWrites).toEqual([
                {
                    method: "insert",
                    args: [
                        MessageEntity,
                        plain({
                            workspaceId: "ws-1",
                            leadId: null,
                            authorKind: "system",
                            authorName: "NIVO",
                            body: "Hello",
                        }),
                    ],
                },
            ])
        })
    })
})

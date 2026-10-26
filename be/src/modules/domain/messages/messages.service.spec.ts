import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { ChatActivityService } from "@modules/domain/chat-activity"
import { MessagesService } from "./messages.service"
import { INSERT_SYSTEM_MESSAGE } from "./persistence/messages.sql"

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
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_SYSTEM_MESSAGE, []] }))
            const { messages, activity } = await build()

            await tx.em.transaction((manager) =>
                messages.postSystem({ workspaceId: "ws-1", leadId: "lead-1", body: "Anh Minh moved to won.", manager }),
            )

            expect(activity.message).toHaveBeenCalledWith("ws-1", "room:office", null, expect.anything())

            expect(tx.committedWrites).toEqual([
                { method: "query", args: [INSERT_SYSTEM_MESSAGE, ["ws-1", "lead-1", "Anh Minh moved to won."]] },
            ])
        })

        it("writes a line about no lead", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_SYSTEM_MESSAGE, []] }))
            const { messages } = await build()

            await tx.em.transaction((manager) =>
                messages.postSystem({ workspaceId: "ws-1", leadId: null, body: "Hello", manager }),
            )

            expect(tx.committedWrites).toEqual([
                { method: "query", args: [INSERT_SYSTEM_MESSAGE, ["ws-1", null, "Hello"]] },
            ])
        })
    })
})

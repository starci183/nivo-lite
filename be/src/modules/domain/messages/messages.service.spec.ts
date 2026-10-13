import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { MessagesService } from "./messages.service"
import { INSERT_SYSTEM_MESSAGE } from "./persistence/messages.sql"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [MessagesService] }).compile()
    return moduleRef.get(MessagesService)
}

describe("MessagesService", () => {
    describe("postSystem", () => {
        it("writes the line inside the transaction of the caller", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_SYSTEM_MESSAGE, []] }))
            const messages = await build()

            await tx.em.transaction((manager) =>
                messages.postSystem({ workspaceId: "ws-1", leadId: "lead-1", body: "Anh Minh moved to won.", manager }),
            )

            expect(tx.committedWrites).toEqual([
                { method: "query", args: [INSERT_SYSTEM_MESSAGE, ["ws-1", "lead-1", "Anh Minh moved to won."]] },
            ])
        })

        it("writes a line about no lead", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_SYSTEM_MESSAGE, []] }))
            const messages = await build()

            await tx.em.transaction((manager) =>
                messages.postSystem({ workspaceId: "ws-1", leadId: null, body: "Hello", manager }),
            )

            expect(tx.committedWrites).toEqual([
                { method: "query", args: [INSERT_SYSTEM_MESSAGE, ["ws-1", null, "Hello"]] },
            ])
        })
    })
})

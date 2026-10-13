import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { MessagesService } from "./messages.service"
import { INSERT_SYSTEM_MESSAGE } from "./persistence/messages.sql"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [MessagesService] }).compile()
    return moduleRef.get(MessagesService)
}

describe("MessagesService", () => {
    describe("postSystem", () => {
        it("posts the line in the transaction of the caller", async () => {
            const manager = mockEntityManager({ query: [INSERT_SYSTEM_MESSAGE, []] })
            const messages = await build()

            await expect(
                messages.postSystem({
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    body: "Anh Minh moved to won.",
                    manager,
                }),
            ).resolves.toBeUndefined()

            expect(manager.query).toHaveBeenCalledWith(INSERT_SYSTEM_MESSAGE, [
                "ws-1",
                "lead-1",
                "Anh Minh moved to won.",
            ])
        })

        it("posts a line about no lead", async () => {
            const manager = mockEntityManager({ query: [INSERT_SYSTEM_MESSAGE, []] })
            const messages = await build()

            await expect(
                messages.postSystem({ workspaceId: "ws-1", leadId: null, body: "Hello", manager }),
            ).resolves.toBeUndefined()

            expect(manager.query).toHaveBeenCalledWith(INSERT_SYSTEM_MESSAGE, ["ws-1", null, "Hello"])
        })
    })
})

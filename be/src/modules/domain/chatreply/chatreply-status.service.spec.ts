import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ChatReplyStatusService } from "./chatreply-status.service"

const build = async () => {
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatReplyStatusService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(ChatReplyStatusService), entityManager, members }
}

describe("ChatReplyStatusService", () => {
    describe("replyStatus", () => {
        it("replyStatus has its first case written", async () => {
            const { service } = await build()
            expect(service.replyStatus).toBeInstanceOf(Function)
        })
    })

    describe("answerStatus", () => {
        it("answerStatus has its first case written", async () => {
            const { service } = await build()
            expect(service.answerStatus).toBeInstanceOf(Function)
        })
    })
})

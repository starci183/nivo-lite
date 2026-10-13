import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { PostedMessage } from "./messages.contracts"
import { INSERT_HUMAN_MESSAGE } from "./persistence/team-chat.sql"
import { TeamChatService } from "./team-chat.service"

const member = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: "staff-1",
    displayName: "Minh",
    status: "active",
})

const posted = builder<PostedMessage>({
    id: "m-1",
    author_kind: "human",
    author_name: "Minh",
    agent_id: null,
    staff_id: "staff-1",
    body: "Hello team",
    lead_id: null,
    work_item_id: null,
    created_at: "2026-10-13T10:00:00.000Z",
})

const build = async (line: PostedMessage = posted()) => {
    const entityManager = mockEntityManager({ query: [INSERT_HUMAN_MESSAGE, [line]] })
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(member())
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(TeamChatService), entityManager, members }
}

describe("TeamChatService", () => {
    describe("postHuman", () => {
        it("posts the trimmed line as the member, including a staff row", async () => {
            const line = posted()
            const { service, entityManager, members } = await build(line)

            await expect(service.postHuman("user-1", "ws-1", "  Hello team  ")).resolves.toEqual(line)

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1"]])
            expect(entityManager.query.mock.calls).toEqual([
                [INSERT_HUMAN_MESSAGE, ["ws-1", "Minh", "staff-1", "Hello team"]],
            ])
        })

        it("posts as the owner when the member has no staff row", async () => {
            const line = posted({ author_name: "Lan", staff_id: null, body: "Noted" })
            const { service, entityManager, members } = await build(line)
            members.require.mockResolvedValue(member({ role: "owner", staffId: null, displayName: "Lan" }))

            await expect(service.postHuman("user-1", "ws-1", "Noted")).resolves.toEqual(line)

            expect(entityManager.query.mock.calls).toEqual([[INSERT_HUMAN_MESSAGE, ["ws-1", "Lan", null, "Noted"]]])
        })

        it("does not write a line when membership is refused", async () => {
            const { service, entityManager, members } = await build()
            const cause = new Error("not a member")
            members.require.mockRejectedValue(cause)

            await expect(service.postHuman("user-1", "ws-1", "Hello")).rejects.toBe(cause)

            expect(entityManager.query).not.toHaveBeenCalled()
        })
    })
})

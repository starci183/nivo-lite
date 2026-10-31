import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ChatActivityService } from "@modules/domain/chat-activity"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MessagesErrorCode } from "./errors/messages.error"
import type { PostedMessage } from "./messages.contracts"
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
    author_user_id: "u-1",
    agent_id: null,
    staff_id: "staff-1",
    body: "Hello team",
    lead_id: null,
    work_item_id: null,
    room: null,
    created_at: "2026-10-13T10:00:00.000Z",
})

const humanLine = (
    authorName: string,
    staffId: string | null,
    body: string,
    room: string | null,
    authorUserId: string,
) => ({ workspaceId: "ws-1", authorKind: "human", authorName, staffId, body, room, authorUserId })

const build = async (line: PostedMessage = posted(), raw: ReadonlyArray<unknown> = [line]) => {
    const entityManager = mockEntityManager({})
    const [insert] = queueQueryBuilders(entityManager, [{ execute: { raw } }])
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(member())
    const activity = mock<ChatActivityService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ChatActivityService, useValue: activity },
        ],
    }).compile()
    return { service: moduleRef.get(TeamChatService), entityManager, insert, members, activity }
}

describe("TeamChatService", () => {
    describe("postHuman", () => {
        it("posts the trimmed line as the member, including a staff row", async () => {
            const line = posted()
            const { service, insert, members, activity, entityManager } = await build(line)

            await expect(service.postHuman("user-1", "ws-1", "  Hello team  ")).resolves.toEqual(line)

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1"]])
            expect(insert?.callsOf("values")).toEqual([[humanLine("Minh", "staff-1", "Hello team", null, "user-1")]])
            expect(insert?.callsOf("insert")).toEqual([[]])
            expect(activity.message.mock.calls).toEqual([["ws-1", "room:office", "user-1", entityManager]])
        })

        it("posts as the owner when the member has no staff row", async () => {
            const line = posted({ author_name: "Lan", staff_id: null, body: "Noted" })
            const { service, insert, members } = await build(line)
            members.require.mockResolvedValue(
                member({ userId: "owner-account", role: "owner", staffId: null, displayName: "Lan" }),
            )

            await expect(service.postHuman("user-1", "ws-1", "Noted")).resolves.toEqual(line)

            expect(insert?.callsOf("values")).toEqual([[humanLine("Lan", null, "Noted", null, "owner-account")]])
        })

        it("posts in a Hub room", async () => {
            const line = posted({ room: "marketing" })
            const { service, insert, activity, entityManager } = await build(line)

            await expect(service.postHuman("user-1", "ws-1", "Hello team", "marketing")).resolves.toEqual(line)

            expect(activity.message.mock.calls).toEqual([["ws-1", "room:marketing", "user-1", entityManager]])

            expect(insert?.callsOf("values")).toEqual([
                [humanLine("Minh", "staff-1", "Hello team", "marketing", "user-1")],
            ])
        })

        it("refuses when the database answers no stored line", async () => {
            const { service } = await build(posted(), [])

            await expect(service.postHuman("user-1", "ws-1", "Hello")).rejects.toMatchObject({
                code: MessagesErrorCode.LineNotStored,
            })
        })

        it("refuses a room that is not a Hub room", async () => {
            const { service, entityManager, activity } = await build()

            await expect(service.postHuman("user-1", "ws-1", "Hello", "lobby")).rejects.toMatchObject({
                code: MessagesErrorCode.RoomInvalid,
                params: { room: "lobby" },
            })
            expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
            expect(activity.message).not.toHaveBeenCalled()
        })

        it("does not write a line when membership is refused", async () => {
            const { service, entityManager, members } = await build()
            const cause = new Error("not a member")
            members.require.mockRejectedValue(cause)

            await expect(service.postHuman("user-1", "ws-1", "Hello")).rejects.toBe(cause)

            expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
})

describe("TeamChatService > in a transaction", () => {
        it("writes the line and its activity in the caller's transaction when it hands one", async () => {
            const line = posted()
            const { service, insert, activity, entityManager } = await build(line)
            const tx = mockEntityManager({})
            const [txInsert] = queueQueryBuilders(tx, [{ execute: { raw: [line] } }])

            await expect(service.postHuman("user-1", "ws-1", "Hello team", null, tx)).resolves.toEqual(line)

            expect(txInsert?.callsOf("values")).toEqual([[humanLine("Minh", "staff-1", "Hello team", null, "user-1")]])
            expect(insert?.callsOf("values")).toEqual([])
            expect(activity.message.mock.calls).toEqual([["ws-1", "room:office", "user-1", tx]])
            expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
        })
})

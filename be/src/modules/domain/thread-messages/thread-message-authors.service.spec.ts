import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { ThreadMessageAuthorsService } from "./thread-message-authors.service"
import type { ThreadMessageRead } from "./thread-messages.contracts"

const readOf = (overrides: Partial<ThreadMessageRead> = {}): ThreadMessageRead => ({
    id: "msg-1",
    thread_id: "thread-1",
    workspace_id: "ws-1",
    author_kind: "member",
    author_id: "m-van",
    body: "Hello",
    quoted: [],
    mentions: [],
    approval: null,
    created_at: new Date("2026-10-22T09:41:00+07:00"),
    ...overrides,
})

const build = async () => {
    const agents = mock<AgentDirectoryService>()
    agents.cardsOf.mockResolvedValue([{ id: "a-sales", name: "AI Sales", module: "sales", canTagAgentIds: [] }])
    const members = mock<WorkspaceMemberDirectoryService>()
    members.byIds.mockResolvedValue([{ id: "m-van", displayName: "Van", role: "staff" }])
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadMessageAuthorsService,
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspaceMemberDirectoryService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadMessageAuthorsService), agents, members }
}

describe("ThreadMessageAuthorsService", () => {
    describe("withAuthors", () => {
        it("names a member by display name and role, an agent by name and module, and a gone author as empty", async () => {
            const { service, agents, members } = await build()
            const em = mockEntityManager()

            const named = await service.withAuthors(em, "ws-1", [
                readOf(),
                readOf({ id: "msg-2", author_kind: "agent", author_id: "a-sales" }),
                readOf({ id: "msg-3", author_id: "m-gone" }),
                readOf({ id: "msg-4", author_kind: "agent", author_id: "a-gone" }),
                readOf({ id: "msg-5", author_id: "m-van" }),
            ])

            expect(named.map((row) => [row.id, row.author_name, row.author_role])).toEqual([
                ["msg-1", "Van", "staff"],
                ["msg-2", "AI Sales", "sales"],
                ["msg-3", "", ""],
                ["msg-4", "", ""],
                ["msg-5", "Van", "staff"],
            ])
            expect(agents.cardsOf).toHaveBeenCalledWith("ws-1", ["a-sales", "a-gone"])
            expect(members.byIds).toHaveBeenCalledWith("ws-1", ["m-van", "m-gone"], em)
        })
    })

    describe("withAuthor", () => {
        it("names the author of one message", async () => {
            const { service } = await build()

            await expect(service.withAuthor(mockEntityManager(), "ws-1", readOf())).resolves.toMatchObject({
                id: "msg-1",
                author_name: "Van",
                author_role: "staff",
            })
        })
    })
})

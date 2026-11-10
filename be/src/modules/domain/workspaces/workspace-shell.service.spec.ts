import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { MemberLobbyService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceShellService } from "./workspace-shell.service"

const SHELL_DATA = 'SELECT * FROM "public"."shell_data"($1, $2, $3)'

const WINDOW = { from: "2026-09-28T17:00:00.000Z", to: "2026-10-31T16:59:59.000Z" }

const EMPTY = {
    agents: [],
    hasChatbot: false,
    isFoundingMember: false,
}

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Linh",
        status: "active",
    })
    const seats = mock<MemberLobbyService>()
    seats.markOpened.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceShellService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MemberLobbyService, useValue: seats },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceShellService), members, seats }
}

describe("WorkspaceShellService", () => {
    describe("read", () => {
        it("reads the console frame for an active member", async () => {
            const em = mockEntityManager({
                query: [
                    SHELL_DATA,
                    [
                        {
                            shell_data: {
                                agents: [{ id: "a-1", name: "Mai", module: "sales", status: "paused" }],
                                has_chatbot: true,
                                is_founding_member: false,
                            },
                        },
                    ],
                ],
            })
            const { service, members, seats } = await build(em)

            await expect(service.read("user-1", "ws-1", WINDOW)).resolves.toEqual({
                agents: [{ id: "a-1", name: "Mai", module: "sales", status: "paused" }],
                hasChatbot: true,
                isFoundingMember: false,
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(seats.markOpened).toHaveBeenCalledWith("ws-1", "user-1")
            expect(em.query).toHaveBeenCalledWith(SHELL_DATA, ["ws-1", WINDOW.from, WINDOW.to])
        })

        it("reads a missing answer as an empty frame", async () => {
            const em = mockEntityManager({ query: [SHELL_DATA, []] })
            const { service } = await build(em)

            await expect(service.read("user-1", "ws-1", WINDOW)).resolves.toEqual(EMPTY)
        })

        it("reads a row with no data as an empty frame", async () => {
            const em = mockEntityManager({ query: [SHELL_DATA, [{ shell_data: null }]] })
            const { service } = await build(em)

            await expect(service.read("user-1", "ws-1", WINDOW)).resolves.toEqual(EMPTY)
        })

        it("reads nothing when the caller is not a member", async () => {
            const denied = new Error("not a member")
            const em = mockEntityManager()
            const { service, members, seats } = await build(em)
            members.require.mockRejectedValue(denied)

            await expect(service.read("user-9", "ws-9", WINDOW)).rejects.toBe(denied)
            expect(seats.markOpened).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })
    })
})

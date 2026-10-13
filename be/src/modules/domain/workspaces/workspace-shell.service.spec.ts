import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { READ_SHELL } from "./persistence/workspace-shell.sql"
import { WorkspaceShellService } from "./workspace-shell.service"

const WINDOW = { from: "2026-09-28T17:00:00.000Z", to: "2026-10-31T16:59:59.000Z" }

const EMPTY = {
    leadCount: 0,
    openResponsibilityCount: 0,
    agents: [],
    hasChatbot: false,
    isFoundingMember: false,
    approvals: [],
    exceptions: [],
    pendingDecisions: 0,
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
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceShellService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceShellService), members }
}

describe("WorkspaceShellService", () => {
    describe("read", () => {
        it("reads the console frame for an active member", async () => {
            const em = mockEntityManager({
                query: [
                    READ_SHELL,
                    [
                        {
                            data: {
                                lead_count: 3,
                                open_responsibility_count: 1,
                                agents: [{ id: "a-1", name: "Mai", module: "sales", status: "paused" }],
                                has_chatbot: true,
                                is_founding_member: false,
                                pending: [
                                    {
                                        id: "x-1",
                                        draft: "Hello",
                                        next_action: null,
                                        lead_id: null,
                                        contact_name: null,
                                    },
                                ],
                                exceptions: [],
                                pending_decisions: 2,
                            },
                        },
                    ],
                ],
            })
            const { service, members } = await build(em)

            await expect(service.read("user-1", "ws-1", WINDOW)).resolves.toEqual({
                leadCount: 3,
                openResponsibilityCount: 1,
                agents: [{ id: "a-1", name: "Mai", module: "sales", status: "paused" }],
                hasChatbot: true,
                isFoundingMember: false,
                approvals: [{ id: "x-1", draft: "Hello", nextAction: null, leadId: null, contactName: null }],
                exceptions: [],
                pendingDecisions: 2,
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(em.query).toHaveBeenCalledWith(READ_SHELL, ["ws-1", WINDOW.from, WINDOW.to])
        })

        it("reads a missing answer as an empty frame", async () => {
            const em = mockEntityManager({ query: [READ_SHELL, []] })
            const { service } = await build(em)

            await expect(service.read("user-1", "ws-1", WINDOW)).resolves.toEqual(EMPTY)
        })

        it("reads a row with no data as an empty frame", async () => {
            const em = mockEntityManager({ query: [READ_SHELL, [{ data: null }]] })
            const { service } = await build(em)

            await expect(service.read("user-1", "ws-1", WINDOW)).resolves.toEqual(EMPTY)
        })

        it("reads nothing when the caller is not a member", async () => {
            const denied = new Error("not a member")
            const em = mockEntityManager()
            const { service, members } = await build(em)
            members.require.mockRejectedValue(denied)

            await expect(service.read("user-9", "ws-9", WINDOW)).rejects.toBe(denied)
            expect(em.query).not.toHaveBeenCalled()
        })
    })
})

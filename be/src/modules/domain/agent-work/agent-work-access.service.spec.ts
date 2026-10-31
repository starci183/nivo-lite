import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkErrorCode } from "./errors/agent-work.error"

const HAS_AGENT = 'SELECT * FROM "public"."agent_work_has_agent"($1, $2)'

const build = async (rows: ReadonlyArray<unknown>) => {
    const members = mock<WorkspaceMembersService>({
        require: jest.fn().mockResolvedValue({}),
        idOf: jest.fn().mockResolvedValue("member-1"),
    })
    const em = mockEntityManager({ query: [HAS_AGENT, rows] })
    const container = await Test.createTestingModule({
        providers: [
            AgentWorkAccessService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
        ],
    }).compile()
    return { service: container.get(AgentWorkAccessService), members, em }
}

describe("AgentWorkAccessService.manager", () => {
    it("admits an owner or manager and answers their seat", async () => {
        const { service, members } = await build([])

        await expect(service.manager("user-1", "ws-1")).resolves.toBe("member-1")
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(members.idOf).toHaveBeenCalledWith("user-1", "ws-1")
    })

    it("refuses a caller the membership refuses, before any seat is read", async () => {
        const { service, members } = await build([])
        members.require.mockRejectedValueOnce(new Error("forbidden"))

        await expect(service.manager("user-1", "ws-1")).rejects.toThrow("forbidden")
        expect(members.idOf).not.toHaveBeenCalled()
    })
})

describe("AgentWorkAccessService.owner", () => {
    it("admits only an owner and answers their seat", async () => {
        const { service, members } = await build([])

        await expect(service.owner("user-1", "ws-1")).resolves.toBe("member-1")
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner"])
    })
})

describe("AgentWorkAccessService.agent", () => {
    it("accepts an agent that belongs to the workspace", async () => {
        const { service, em } = await build([{ agent_work_has_agent: true }])

        await expect(service.agent("ws-1", "agent-1")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(HAS_AGENT, ["ws-1", "agent-1"])
    })

    it.each([[[{ agent_work_has_agent: false }]], [[]]])(
        "refuses an agent the database does not vouch for (%j)",
        async (rows) => {
            const { service } = await build(rows)

            await expect(service.agent("ws-1", "agent-1")).rejects.toMatchObject({
                code: AgentWorkErrorCode.AgentNotFound,
            })
        },
    )
})

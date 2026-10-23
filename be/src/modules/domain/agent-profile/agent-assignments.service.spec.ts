import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentOwnershipService } from "@modules/domain/agents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { AgentAssignmentsService } from "./agent-assignments.service"
import type { AssignmentTask } from "./agent-profile.contracts"
import { AGENT_PROFILE_THREADS, AGENT_PROFILE_WORK } from "./agent-profile.decorators"
import type { AssignmentThreads, AssignmentWork } from "./agent-profile.port"
import { AgentProfileErrorCode } from "./errors/agent-profile.error"

const LAN: WorkspaceMember = {
    userId: "u1",
    workspaceId: "w1",
    role: "staff",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const TASK: AssignmentTask = { action: "give_discount", amount: 8, amountVnd: 7_000_000, leadId: "lead-thao" }

const buildBound = async (allowed = true) => {
    const agents = mock<AgentOwnershipService>({
        memberIdOf: jest.fn(() => Promise.resolve("m-lan")),
        canAssign: jest.fn(() => Promise.resolve(allowed)),
    })
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(LAN)) })
    const threads = mock<AssignmentThreads>({ open: jest.fn(() => Promise.resolve({ threadId: "t1" })) })
    const work = mock<AssignmentWork>({ start: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentAssignmentsService,
            { provide: AgentOwnershipService, useValue: agents },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AGENT_PROFILE_THREADS, useValue: threads },
            { provide: AGENT_PROFILE_WORK, useValue: work },
        ],
    }).compile()
    return { service: moduleRef.get(AgentAssignmentsService), agents, threads, work }
}

describe("AgentAssignmentsService", () => {
    it("opens a thread whose only mention is the agent, built from the id and not from the text", async () => {
        const { service, agents, threads, work } = await buildBound()

        await expect(
            service.assign("u1", "w1", { agentId: "a1", text: "  close the group @Van @Minh \n details" }),
        ).resolves.toEqual({ threadId: "t1" })

        expect(agents.memberIdOf).toHaveBeenCalledWith("u1", "w1")
        expect(agents.canAssign).toHaveBeenCalledWith("m-lan", "a1")
        expect(threads.open).toHaveBeenCalledWith({
            workspaceId: "w1",
            authorMemberId: "m-lan",
            title: "close the group @Van @Minh",
            text: "close the group @Van @Minh \n details",
            mentions: [{ kind: "agent", id: "a1" }],
            leadId: null,
        })
        expect(work.start).not.toHaveBeenCalled()
    })

    it("opens the thread about the customer and starts the named work there as the member who handed it over", async () => {
        const { service, threads, work } = await buildBound()

        await service.assign("u1", "w1", { agentId: "a1", text: "close Deluxe, 8% off", ...TASK })

        expect(threads.open).toHaveBeenCalledWith(expect.objectContaining({ leadId: "lead-thao" }))
        expect(work.start).toHaveBeenCalledWith({
            workspaceId: "w1",
            threadId: "t1",
            agentId: "a1",
            actorName: "Lan",
            summary: "close Deluxe, 8% off",
            task: TASK,
        })
    })

    it("refuses a member the agent is not open to, and writes nothing", async () => {
        const { service, threads, work } = await buildBound(false)

        await expect(service.assign("u1", "w1", { agentId: "a1", text: "do it", ...TASK })).rejects.toMatchObject({
            code: AgentProfileErrorCode.AssignForbidden,
        })
        expect(threads.open).not.toHaveBeenCalled()
        expect(work.start).not.toHaveBeenCalled()
    })

    it.each([
        { name: "an empty request", text: "   " },
        { name: "a request over the limit", text: "x".repeat(2001) },
    ])("refuses $name before asking who the member is", async ({ text }) => {
        const { service, agents, threads } = await buildBound()

        await expect(service.assign("u1", "w1", { agentId: "a1", text })).rejects.toMatchObject({
            code: AgentProfileErrorCode.RequestInvalid,
            params: { max: 2000 },
        })
        expect(agents.memberIdOf).not.toHaveBeenCalled()
        expect(threads.open).not.toHaveBeenCalled()
    })
})

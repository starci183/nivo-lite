import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentOwnershipService } from "@modules/domain/agents"
import { AgentAssignmentsService } from "./agent-assignments.service"
import { AGENT_PROFILE_THREADS } from "./agent-profile.decorators"
import type { AssignmentThreads } from "./agent-profile.port"
import { AgentProfileErrorCode } from "./errors/agent-profile.error"

const buildBound = async (allowed = true) => {
    const agents = mock<AgentOwnershipService>({
        memberIdOf: jest.fn(() => Promise.resolve("m-lan")),
        canAssign: jest.fn(() => Promise.resolve(allowed)),
    })
    const threads = mock<AssignmentThreads>({ open: jest.fn(() => Promise.resolve({ threadId: "t1" })) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentAssignmentsService,
            { provide: AgentOwnershipService, useValue: agents },
            { provide: AGENT_PROFILE_THREADS, useValue: threads },
        ],
    }).compile()
    return { service: moduleRef.get(AgentAssignmentsService), agents, threads }
}

describe("AgentAssignmentsService", () => {
    it("opens a thread whose only mention is the agent, built from the id and not from the text", async () => {
        const { service, agents, threads } = await buildBound()

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
        })
    })

    it("refuses a member the agent is not open to, and writes nothing", async () => {
        const { service, threads } = await buildBound(false)

        await expect(service.assign("u1", "w1", { agentId: "a1", text: "do it" })).rejects.toMatchObject({
            code: AgentProfileErrorCode.AssignForbidden,
        })
        expect(threads.open).not.toHaveBeenCalled()
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

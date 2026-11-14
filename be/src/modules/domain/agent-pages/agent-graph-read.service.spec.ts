import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AiWorkUsageService } from "@modules/domain/ai-usage-events"
import { CLOCK } from "@modules/platform/clock"
import { AgentGraphAdminService, type AgentGraphWire } from "@modules/domain/agent-graphs"
import { AgentGraphReadService } from "./agent-graph-read.service"

const NOW = new Date("2026-11-12T00:00:00.000Z")

const build = async () => {
    const admin = mock<AgentGraphAdminService>()
    admin.open.mockResolvedValue(
        mock<AgentGraphWire>({
            agentId: "agent-1",
            draftJson: JSON.stringify({ nodes: [{ key: "match", step: "sales.payment-short" }] }),
        }),
    )
    const usage = mock<AiWorkUsageService>()
    usage.agentSteps.mockResolvedValue([])
    const container = await Test.createTestingModule({
        providers: [
            AgentGraphReadService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AgentGraphAdminService, useValue: admin },
            { provide: AiWorkUsageService, useValue: usage },
        ],
    }).compile()
    return { service: container.get(AgentGraphReadService), admin, usage }
}

describe("AgentGraphReadService.open", () => {
    it("opens the graph (the owner or manager check), then reads the last 7 days of the agent's calls ONCE for every node", async () => {
        const { service, admin, usage } = await build()

        const graph = await service.open("user-1", "ws-1", "agent-1", "vi")

        expect(admin.open).toHaveBeenCalledWith({ workspaceId: "ws-1", principalId: "user-1" }, "agent-1", "vi")
        expect(usage.agentSteps).toHaveBeenCalledTimes(1)
        expect(usage.agentSteps).toHaveBeenCalledWith("ws-1", "agent-1", new Date("2026-11-05T00:00:00.000Z"))
        expect(graph.aiWindowDays).toBe(7)
        expect(graph.aiNodes.map((node) => [node.nodeKey, node.runs, node.credits])).toEqual([["match", 0, 0]])
    })

    it("reads no usage for a caller the admin service refuses (staff)", async () => {
        const { service, admin, usage } = await build()
        admin.open.mockRejectedValue(new Error("not an owner or manager"))

        await expect(service.open("user-1", "ws-1", "agent-1", "vi")).rejects.toThrow("not an owner or manager")
        expect(usage.agentSteps).not.toHaveBeenCalled()
    })
})

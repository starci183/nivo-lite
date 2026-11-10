import { FakeClock, mock } from "@starci/jest-preset"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import type { AgentGraphWire } from "@modules/domain/agent-graphs"
import { AiWorkUsageService } from "@modules/domain/ai-usage-events"
import type { Logger } from "@modules/platform/logging"
import { GetAgentGraphHandler } from "./get-agent-graph.handler"
import { GetAgentGraphQuery } from "./get-agent-graph.query"

const NOW = new Date("2026-11-12T00:00:00.000Z")

const build = () => {
    const admin = mock<AgentGraphAdminService>()
    admin.open.mockResolvedValue({
        agentId: "agent-1",
        draftJson: JSON.stringify({ nodes: [{ key: "match", step: "accounting.match-payment" }] }),
    } as AgentGraphWire)
    const usage = mock<AiWorkUsageService>()
    usage.agentSteps.mockResolvedValue([])
    const handler = new GetAgentGraphHandler(mock<Logger>(), new FakeClock(NOW), admin, usage)
    return { handler, admin, usage }
}

const query = () =>
    new GetAgentGraphQuery({
        request: { workspaceId: "ws-1", agentId: "agent-1", locale: "vi" },
        principal: { id: "user-1" } as never,
    })

describe("GetAgentGraphHandler", () => {
    it("opens the graph (the owner or manager check), then reads the last 7 days of the agent's calls ONCE for every node", async () => {
        const { handler, admin, usage } = build()

        const graph = await handler.execute(query())

        expect(admin.open).toHaveBeenCalledWith({ workspaceId: "ws-1", principalId: "user-1" }, "agent-1", "vi")
        expect(usage.agentSteps).toHaveBeenCalledTimes(1)
        expect(usage.agentSteps).toHaveBeenCalledWith("ws-1", "agent-1", new Date("2026-11-05T00:00:00.000Z"))
        expect(graph.aiWindowDays).toBe(7)
        expect(graph.aiNodes.map((node) => [node.nodeKey, node.runs, node.credits])).toEqual([["match", 0, 0]])
    })

    it("reads no usage for a caller the admin service refuses (staff)", async () => {
        const { handler, admin, usage } = build()
        admin.open.mockRejectedValue(new Error("not an owner or manager"))

        await expect(handler.execute(query())).rejects.toThrow("not an owner or manager")
        expect(usage.agentSteps).not.toHaveBeenCalled()
    })
})

import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentGraphOutputNodesService } from "./agent-graph-output-nodes.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphNode } from "./agent-graphs.contracts"
import type { GraphState } from "./agent-graphs.service"
import { NO_OUTPUT_NODES } from "./policies/output-nodes.policy"

const build = async (state: Pick<GraphState, "active"> | null) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentGraphOutputNodesService, { provide: AgentGraphsService, useValue: graphs }],
    }).compile()
    return moduleRef.get(AgentGraphOutputNodesService)
}

describe("AgentGraphOutputNodesService", () => {
    it("answers no nodes for an agent with no graph or no published version", async () => {
        await expect((await build(null)).nodesOf("ws", "a1")).resolves.toEqual(NO_OUTPUT_NODES)
        await expect((await build({ active: null })).nodesOf("ws", "a1")).resolves.toEqual(NO_OUTPUT_NODES)
    })

    it("reads the nodes of the active version", async () => {
        const nodes: ReadonlyArray<Partial<GraphNode>> = [
            { key: "act:gateway_call", step: "write", action: "gateway_call", next: [] },
            { key: "ask:gateway_call", step: "approval", next: ["act:gateway_call"] },
            { key: "act:reply_customer", step: "write", action: "reply_customer", next: [] },
        ]
        const active = mock<NonNullable<GraphState["active"]>>()
        Object.assign(active, { nodes })
        const service = await build({ active })
        await expect(service.nodesOf("ws", "a1")).resolves.toEqual({
            output: "act:gateway_call",
            approval: "ask:gateway_call",
            reply: "act:reply_customer",
        })
    })
})

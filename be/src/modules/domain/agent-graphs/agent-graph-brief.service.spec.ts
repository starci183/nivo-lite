import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { nodeOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphBriefService } from "./agent-graph-brief.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"

const build = async (state: GraphState | null) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentGraphBriefService, { provide: AgentGraphsService, useValue: graphs }],
    }).compile()
    return { service: moduleRef.get(AgentGraphBriefService), graphs }
}

describe("AgentGraphBriefService.intentsOf", () => {
    it("lists the actions of the act nodes of the active version under the titles the owner gave them", async () => {
        const { service, graphs } = await build(stateOf({ mode: "enforced" }))

        await expect(service.intentsOf("ws-1", "agent-1")).resolves.toEqual([
            { action: "pay_supplier", label: "Record the payment" },
        ])
        expect(graphs.stateOfAgent).toHaveBeenCalledWith("ws-1", "agent-1")
    })

    it("lists an action once and skips an act node that carries no action", async () => {
        const active = {
            nodes: [
                nodeOf({ key: "a", action: "pay_supplier" }),
                nodeOf({ key: "b", action: "pay_supplier", title: "Again" }),
                nodeOf({ key: "c", pipeline: "reminder" }),
                nodeOf({ key: "d", kind: "output", step: "stop", action: "ignored" }),
            ],
            rights: [],
        }
        const { service } = await build(stateOf({ mode: "enforced", active }))

        await expect(service.intentsOf("ws-1", "agent-1")).resolves.toEqual([
            { action: "pay_supplier", label: "Record the payment" },
        ])
    })

    it("tells a turn nothing while the graph is only in shadow, has no version or does not exist", async () => {
        const shadow = await build(stateOf())
        const noVersion = await build(stateOf({ mode: "enforced", active: null }))
        const none = await build(null)

        await expect(shadow.service.intentsOf("ws-1", "agent-1")).resolves.toEqual([])
        await expect(noVersion.service.intentsOf("ws-1", "agent-1")).resolves.toEqual([])
        await expect(none.service.intentsOf("ws-1", "agent-1")).resolves.toEqual([])
    })
})

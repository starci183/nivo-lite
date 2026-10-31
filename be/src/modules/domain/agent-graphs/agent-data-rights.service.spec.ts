import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { graphOf, OWNER_EXAMPLE, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentDataRightsService } from "./agent-data-rights.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"

const build = async (state: GraphState | null) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentDataRightsService, { provide: AgentGraphsService, useValue: graphs }],
    }).compile()
    return moduleRef.get(AgentDataRightsService)
}

const RIGHTS = [{ kind: "customers", scope: "conversation", hide: ["cost"], mask: ["phone"] }] as const

describe("AgentDataRightsService.rightsOf", () => {
    it("answers the rights of the active version of an agent whose graph is enforced", async () => {
        const service = await build(stateOf({ mode: "enforced", active: { ...graphOf(OWNER_EXAMPLE), rights: RIGHTS } }))

        await expect(service.rightsOf("ws-1", "agent-1")).resolves.toEqual(RIGHTS)
    })

    it("answers an empty list, which reads nothing, for an enforced graph that grants nothing", async () => {
        const service = await build(stateOf({ mode: "enforced" }))

        await expect(service.rightsOf("ws-1", "agent-1")).resolves.toEqual([])
    })

    it("does not govern an agent whose graph is in shadow, has no version or does not exist", async () => {
        const shadow = await build(stateOf({ active: { ...graphOf(OWNER_EXAMPLE), rights: RIGHTS } }))
        const noVersion = await build(stateOf({ mode: "enforced", active: null }))
        const none = await build(null)

        await expect(shadow.rightsOf("ws-1", "agent-1")).resolves.toBeNull()
        await expect(noVersion.rightsOf("ws-1", "agent-1")).resolves.toBeNull()
        await expect(none.rightsOf("ws-1", "agent-1")).resolves.toBeNull()
    })
})

import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { graphOf, OWNER_EXAMPLE, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { seededGraphOf } from "@tests/fixtures/builders/flow-f-world.builder"
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
        const service = await build(
            stateOf({ mode: "enforced", active: { ...graphOf(OWNER_EXAMPLE), rights: RIGHTS } }),
        )

        await expect(service.rightsOf("ws-1", "agent-1")).resolves.toEqual(RIGHTS)
    })

    it("answers an empty list, which reads nothing, for an enforced graph that grants nothing", async () => {
        const service = await build(stateOf({ mode: "enforced" }))

        await expect(service.rightsOf("ws-1", "agent-1")).resolves.toEqual([])
    })

    it("governs an agent on its seed by the grant the seed carries, so a seed with no grant reads nothing", async () => {
        const granted = await build(
            stateOf({ mode: "enforced", activeKind: "seed", active: { ...graphOf(OWNER_EXAMPLE), rights: RIGHTS } }),
        )
        const bare = await build(
            stateOf({ mode: "enforced", activeKind: "seed", active: { ...graphOf(OWNER_EXAMPLE), rights: [] } }),
        )

        await expect(granted.rightsOf("ws-1", "agent-1")).resolves.toEqual(RIGHTS)
        await expect(bare.rightsOf("ws-1", "agent-1")).resolves.toEqual([])
    })

    it("denies by default an agent imported from a template, even in shadow, until its buyer grants a right", async () => {
        const template = await build(
            stateOf({ mode: "shadow", activeKind: "template", active: { ...graphOf(OWNER_EXAMPLE), rights: [] } }),
        )

        await expect(template.rightsOf("ws-1", "agent-1")).resolves.toEqual([])
    })

    it("governs an agent from the first version a person published, even an empty one", async () => {
        const chat = await build(stateOf({ mode: "enforced", activeKind: "chat" }))

        await expect(chat.rightsOf("ws-1", "agent-1")).resolves.toEqual([])
    })

    it("governs a graph in shadow by its rights, and does not govern an agent with no version or no graph", async () => {
        const shadow = await build(stateOf({ active: { ...graphOf(OWNER_EXAMPLE), rights: RIGHTS } }))
        const noVersion = await build(stateOf({ mode: "enforced", active: null }))
        const none = await build(null)

        await expect(shadow.rightsOf("ws-1", "agent-1")).resolves.toEqual(RIGHTS)
        await expect(noVersion.rightsOf("ws-1", "agent-1")).resolves.toBeNull()
        await expect(none.rightsOf("ws-1", "agent-1")).resolves.toBeNull()
    })
})

describe("AgentDataRightsService.rightsOf of a flow agent", () => {
    const sales = seededGraphOf("sales")
    const PAYMENTS = { kind: "payments", scope: "conversation", hide: [], mask: [] } as const

    it("gives the payments read to an agent whose flow grants the payment-account read, so its payment.instruction is not refused", async () => {
        const service = await build(
            stateOf({ mode: "enforced", active: { ...graphOf(OWNER_EXAMPLE), rights: [], flow: sales } }),
        )

        await expect(service.rightsOf("ws-1", "agent-1")).resolves.toEqual([PAYMENTS])
    })

    it("does not repeat a kind the graph holds, and gives nothing for a flow with no such right", async () => {
        const bare = { ...sales, grant: { rights: [], tools: [], effects: [] } }
        const held = await build(
            stateOf({ mode: "enforced", active: { ...graphOf(OWNER_EXAMPLE), rights: [PAYMENTS], flow: sales } }),
        )
        const none = await build(
            stateOf({ mode: "enforced", active: { ...graphOf(OWNER_EXAMPLE), rights: [], flow: bare } }),
        )

        await expect(held.rightsOf("ws-1", "agent-1")).resolves.toEqual([PAYMENTS])
        await expect(none.rightsOf("ws-1", "agent-1")).resolves.toEqual([])
    })
})

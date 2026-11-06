import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { graphOf, OWNER_EXAMPLE, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentDataRightsService } from "./agent-data-rights.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"

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

    it("gives the payments read to an agent whose flow grants the payment-account read, so its payment.instruction is not refused", async () => {
        const flow = {
            grant: {
                rights: [
                    { kind: "order", access: "read", scope: "turn", fields: ["id"] },
                    { kind: "payment-account", access: "read", scope: "workspace", fields: ["accountNumber"] },
                ],
                tools: ["payment.instruction"],
                effects: [],
            },
        } as unknown as GraphSpec
        const service = await build(
            stateOf({ mode: "enforced", active: { ...graphOf(OWNER_EXAMPLE), rights: [], flow } }),
        )

        await expect(service.rightsOf("ws-1", "agent-1")).resolves.toEqual([
            { kind: "payments", scope: "conversation", hide: [], mask: [] },
        ])
    })

    it("does not repeat a kind the graph holds, and gives nothing for a flow with no such right", async () => {
        const payments = { kind: "payments", scope: "conversation", hide: [], mask: [] } as const
        const granted = {
            grant: {
                rights: [{ kind: "payment-account", access: "read", scope: "workspace", fields: [] }],
                tools: [],
                effects: [],
            },
        } as unknown as GraphSpec
        const bare = {
            grant: { rights: [{ kind: "order", access: "read", scope: "turn", fields: [] }], tools: [], effects: [] },
        } as unknown as GraphSpec
        const held = await build(
            stateOf({ mode: "enforced", active: { ...graphOf(OWNER_EXAMPLE), rights: [payments], flow: granted } }),
        )
        const none = await build(
            stateOf({ mode: "enforced", active: { ...graphOf(OWNER_EXAMPLE), rights: [], flow: bare } }),
        )

        await expect(held.rightsOf("ws-1", "agent-1")).resolves.toEqual([payments])
        await expect(none.rightsOf("ws-1", "agent-1")).resolves.toEqual([])
    })
})

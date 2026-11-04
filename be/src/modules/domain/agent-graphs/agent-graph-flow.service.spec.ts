import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { OWNER_EXAMPLE, graphOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphFlowService } from "./agent-graph-flow.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphDocument } from "./agent-graphs.contracts"
import { AgentGraphsErrorCode } from "./errors/agent-graphs.error"

const INSTALLED = nodeIndexOf({ nodes: [], effects: [], tools: [], dataKinds: [] })
const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
}
const INPUT = { workspaceId: "ws-1", agentId: "agent-1", installationId: "inst-1", flow: FLOW, installed: INSTALLED }
const VERSION = {
    id: "version-2",
    version: 2,
    changeKind: "seed",
    note: "",
    publishedAt: "2026-11-01T01:00:00.000Z",
    publishedBy: null,
} as const

const build = async (held: ReturnType<typeof stateOf> | null) => {
    const graphs = mock<AgentGraphsService>()
    graphs.stateOfAgent.mockResolvedValue(held)
    graphs.ensure.mockResolvedValue(stateOf())
    graphs.publish.mockResolvedValue(VERSION)
    const moduleRef = await Test.createTestingModule({
        providers: [AgentGraphFlowService, { provide: AgentGraphsService, useValue: graphs }],
    }).compile()
    return { service: moduleRef.get(AgentGraphFlowService), graphs }
}

describe("AgentGraphFlowService > publish", () => {
    it("gives an agent with no graph an empty one, then the flow as a spec version that decides", async () => {
        const { service, graphs } = await build(null)
        graphs.ensure.mockResolvedValue(stateOf({ active: null }))

        await expect(service.publish(INPUT)).resolves.toBe("created")

        expect(graphs.ensure).toHaveBeenCalledWith("ws-1", "agent-1", "inst-1", { nodes: [], rights: [] })
        expect(graphs.publish).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "spec", document: { nodes: [], rights: [], flow: FLOW } }),
        )
    })

    it("changes nothing when the live graph already holds the flow as a spec version, across any number of runs", async () => {
        const held: GraphDocument = { ...graphOf(OWNER_EXAMPLE), flow: FLOW }
        const { service, graphs } = await build(stateOf({ active: held, activeKind: "spec" }))

        await expect(service.publish(INPUT)).resolves.toBe("unchanged")
        await expect(service.publish(INPUT)).resolves.toBe("unchanged")

        expect(graphs.ensure).not.toHaveBeenCalled()
        expect(graphs.publish).not.toHaveBeenCalled()
    })

    it("restores the flow as a spec version when the live version lost it, or holds it on a version of another kind", async () => {
        const live = graphOf(OWNER_EXAMPLE)
        const lost = await build(stateOf({ active: live, activeKind: "seed" }))
        await expect(lost.service.publish(INPUT)).resolves.toBe("replaced")
        expect(lost.graphs.publish).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "spec", document: { ...live, flow: FLOW } }),
        )

        const withFlow: GraphDocument = { ...live, flow: FLOW }
        const seeded = await build(stateOf({ active: withFlow, activeKind: "seed" }))
        await expect(seeded.service.publish(INPUT)).resolves.toBe("replaced")
        expect(seeded.graphs.publish).toHaveBeenCalledWith(expect.objectContaining({ kind: "spec" }))
    })

    it("publishes the flow as the next version and keeps the nodes and rights of the live graph", async () => {
        const live = graphOf(OWNER_EXAMPLE)
        const { service, graphs } = await build(stateOf({ active: live }))

        await expect(service.publish(INPUT)).resolves.toBe("replaced")

        expect(graphs.publish).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            document: { ...live, flow: FLOW },
            kind: "spec",
            note: "",
            memberId: null,
            contextVersionId: null,
        })
    })

    it("starts from an empty graph when the agent has a graph but no version yet", async () => {
        const { service, graphs } = await build(stateOf({ active: null }))

        await expect(service.publish(INPUT)).resolves.toBe("replaced")

        expect(graphs.publish).toHaveBeenCalledWith(
            expect.objectContaining({ document: { nodes: [], rights: [], flow: FLOW } }),
        )
    })

    it("refuses a flow with a node that is not installed, naming it, and writes nothing", async () => {
        const { service, graphs } = await build(null)
        const unknown: GraphSpec = { ...FLOW, nodes: [{ key: "end", kind: "output", step: "not.installed" }] }

        await expect(service.publish({ ...INPUT, flow: unknown })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.PublishRefused,
            params: { problems: "NODE_UNKNOWN end" },
        })

        expect(graphs.stateOfAgent).not.toHaveBeenCalled()
        expect(graphs.ensure).not.toHaveBeenCalled()
        expect(graphs.publish).not.toHaveBeenCalled()
    })
})

describe("AgentGraphFlowService > holds", () => {
    it("is true only when the live version is a spec holding the flow, by one read and no write", async () => {
        const held: GraphDocument = { ...graphOf(OWNER_EXAMPLE), flow: FLOW }
        const same = await build(stateOf({ active: held, activeKind: "spec" }))
        const seeded = await build(stateOf({ active: held, activeKind: "seed" }))
        const other = await build(stateOf())
        const none = await build(null)
        const unversioned = await build(stateOf({ active: null }))

        await expect(same.service.holds("ws-1", "agent-1", FLOW)).resolves.toBe(true)
        await expect(seeded.service.holds("ws-1", "agent-1", FLOW)).resolves.toBe(false)
        await expect(other.service.holds("ws-1", "agent-1", FLOW)).resolves.toBe(false)
        await expect(none.service.holds("ws-1", "agent-1", FLOW)).resolves.toBe(false)
        await expect(unversioned.service.holds("ws-1", "agent-1", FLOW)).resolves.toBe(false)
        expect(same.graphs.stateOfAgent).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(same.graphs.ensure).not.toHaveBeenCalled()
        expect(same.graphs.publish).not.toHaveBeenCalled()
    })
})

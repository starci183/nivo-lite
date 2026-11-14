import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OWNER_EXAMPLE, graphOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"

const MODULE = {
    key: "accounting",
    name: { vi: "Accounting", en: "Accounting" },
    connectionProviders: [],
}

const VERSION = {
    id: "version-2",
    version: 2,
    changeKind: "seed",
    note: "",
    publishedAt: "2026-11-01T01:00:00.000Z",
    publishedBy: null,
} as const

const build = async (
    options: {
        agentId?: string | null
        installed?: boolean
        existing?: boolean
        hosts?: "nodes"
    } = {},
) => {
    const existing = options.existing === true ? stateOf() : null
    const graphs = mock<AgentGraphsService>({
        stateOfAgent: jest.fn().mockResolvedValue(existing),
        ensure: jest.fn().mockResolvedValue(stateOf()),
        publish: jest.fn().mockResolvedValue(VERSION),
    })
    const installations = mock<InstallationRecordsService>({
        findById: jest.fn().mockResolvedValue(
            options.installed === false
                ? null
                : {
                      id: "inst-1",
                      workspaceId: "ws-1",
                      moduleKey: "accounting",
                      agentId: options.agentId === undefined ? "agent-1" : options.agentId,
                  },
        ),
    })
    const modules = mock<ModulesService>({ find: jest.fn().mockResolvedValue(MODULE) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const logger = mock<Logger>()
    const nodes = mock<GraphNodeRegistryService>({
        installed: jest.fn().mockReturnValue(nodeIndexOf({ nodes: [], effects: [], tools: [], dataKinds: [] })),
    })
    const moduleRef =
        options.hosts === undefined
            ? await Test.createTestingModule({
                  providers: [
                      AgentGraphSeedService,
                      { provide: AgentGraphsService, useValue: graphs },
                      { provide: InstallationRecordsService, useValue: installations },
                      { provide: ModulesService, useValue: modules },
                      { provide: MESSAGE_CATALOG, useValue: catalog },
                      { provide: LOGGER, useValue: logger },
                  ],
              }).compile()
            : await Test.createTestingModule({
                  providers: [
                      AgentGraphSeedService,
                      { provide: AgentGraphsService, useValue: graphs },
                      { provide: InstallationRecordsService, useValue: installations },
                      { provide: ModulesService, useValue: modules },
                      { provide: MESSAGE_CATALOG, useValue: catalog },
                      { provide: LOGGER, useValue: logger },
                      { provide: GraphNodeRegistryService, useValue: nodes },
                  ],
              }).compile()
    return { service: moduleRef.get(AgentGraphSeedService), graphs, modules, logger }
}

describe("AgentGraphSeedService.ensureFor", () => {
    it("seeds the graph row of the agent from its module's base graph and no decide point", async () => {
        const { service, graphs, modules } = await build()

        await service.ensureFor("inst-1", "en")

        const [workspaceId, agentId, installationId, seed] = graphs.ensure.mock.calls[0] ?? []
        expect([workspaceId, agentId, installationId]).toEqual(["ws-1", "agent-1", "inst-1"])
        expect(seed?.nodes.map((node) => node.key)).toEqual(["start", "tag", "understand", "end"])
        expect(modules.find).toHaveBeenCalledWith("accounting")
    })

    it("writes the words in the language asked", async () => {
        const { service, graphs } = await build()

        await service.ensureFor("inst-1", "vi")

        const seed = graphs.ensure.mock.calls[0]?.[3]
        expect(seed?.nodes.find((node) => node.key === "understand")?.title).toContain("[agentGraphs.base.")
    })

    it("leaves a graph that exists as it is", async () => {
        const { service, graphs } = await build({ existing: true })

        await expect(service.ensureFor("inst-1", "en")).resolves.toMatchObject({ agentId: "agent-1" })
        expect(graphs.ensure).not.toHaveBeenCalled()
    })

    it("seeds nothing for an installation that is gone or has no agent yet", async () => {
        const gone = await build({ installed: false })
        const bare = await build({ agentId: null })

        await expect(gone.service.ensureFor("inst-1", "en")).resolves.toBeNull()
        await expect(bare.service.ensureFor("inst-1", "en")).resolves.toBeNull()
        expect(gone.graphs.ensure).not.toHaveBeenCalled()
        expect(bare.graphs.ensure).not.toHaveBeenCalled()
    })
})

describe("AgentGraphSeedService.refresh", () => {
    /** The state of an agent whose graph is the seed its module's base graph derives. */
    const seedState = async (): Promise<GraphState> => {
        const { service, graphs } = await build()
        await service.ensureFor("inst-1", "en")
        const document = graphs.ensure.mock.calls[0]?.[3] ?? graphOf(OWNER_EXAMPLE)
        return stateOf({ activeKind: "seed", draft: document, active: document })
    }

    it("publishes a new seed, by nobody, when the base graph now does something else than an older seed", async () => {
        const older = graphOf(OWNER_EXAMPLE)
        const state = stateOf({ activeKind: "seed", draft: older, active: older })
        const { service, graphs } = await build()

        await expect(service.refresh(state, "accounting", "en")).resolves.toBe(true)

        const input = graphs.publish.mock.calls[0]?.[0]
        expect(input).toMatchObject({
            workspaceId: "ws-1",
            agentId: "agent-1",
            kind: "seed",
            note: "",
            memberId: null,
            contextVersionId: null,
        })
        expect(input?.document.nodes.map((node) => node.key)).toEqual(["start", "tag", "understand", "end"])
    })

    it("leaves a seed alone when the base graph still derives what it does", async () => {
        const state = await seedState()
        const { service, graphs } = await build()

        await expect(service.refresh(state, "accounting", "vi")).resolves.toBe(false)
        expect(graphs.publish).not.toHaveBeenCalled()
    })

    it("leaves alone a version a person published, a graph with no version and a graph with unpublished edits", async () => {
        const seeded = await seedState()
        const { service, graphs, modules } = await build()
        const edited = { ...seeded.draft, nodes: seeded.draft.nodes.slice(1) }

        await expect(service.refresh({ ...seeded, activeKind: "edit" }, "accounting", "en")).resolves.toBe(false)
        await expect(service.refresh({ ...seeded, active: null }, "accounting", "en")).resolves.toBe(false)
        await expect(service.refresh({ ...seeded, draft: edited }, "accounting", "en")).resolves.toBe(false)
        expect(modules.find).not.toHaveBeenCalled()
        expect(graphs.publish).not.toHaveBeenCalled()
    })
})

describe("AgentGraphSeedService.refresh of a node graph", () => {
    const FLOW: GraphSpec = {
        schema: "nivo/agent-graph@1",
        moduleKey: "accounting",
        trigger: { kind: "tag", sources: ["system-event"] },
        grant: { tools: [], effects: [] },
        nodes: [{ key: "end", kind: "output", step: "stop" }],
    }
    const flowState = (activeKind: "seed" | "spec", flow: GraphSpec = FLOW): GraphState => {
        const document = { ...graphOf(OWNER_EXAMPLE), flow }
        return stateOf({ activeKind, draft: document, active: document })
    }
    it("never replaces a version that holds a flow, whatever its kind", async () => {
        const { service, graphs, modules, logger } = await build({ hosts: "nodes" })

        await expect(service.refresh(flowState("seed"), "accounting", "en")).resolves.toBe(false)
        await expect(service.refresh(flowState("spec"), "accounting", "en")).resolves.toBe(false)

        expect(graphs.publish).not.toHaveBeenCalled()
        expect(modules.find).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("names each problem of a flow the installed nodes no longer take, and still leaves it live", async () => {
        const { service, graphs, logger } = await build({ hosts: "nodes" })
        const broken = { ...FLOW, nodes: [{ key: "gone", kind: "output" as const, step: "order.gone" }] }

        await expect(service.refresh(flowState("spec", broken), "accounting", "en")).resolves.toBe(false)

        expect(graphs.publish).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith("agent_graphs.flow_unsound", {
            workspaceId: "ws-1",
            agentId: "agent-1",
            code: "NODE_UNKNOWN",
            at: "gone",
        })
    })

    it("only keeps a flow in an app that hosts no nodes", async () => {
        const { service, graphs, logger } = await build()

        await expect(service.refresh(flowState("seed"), "accounting", "en")).resolves.toBe(false)

        expect(graphs.publish).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
    })
})

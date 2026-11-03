import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { ApprovalSetup } from "@modules/domain/authority-rules"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
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

const SETUP: ApprovalSetup = {
    department: "accounting",
    action: "pay_supplier",
    mode: "auto",
    unit: "vnd",
    auto_max: 5_000_000,
    ask_max: 20_000_000,
    group: { roles: ["manager"], rooms: [], members: ["dinh"] },
    policy: "any",
    timeout_minutes: 240,
    agents: [],
}

const MODULE = {
    key: "accounting",
    name: { vi: "Accounting", en: "Accounting" },
    connectionProviders: [],
    authorityActions: [
        {
            action: "pay_supplier",
            label: { vi: "Pay", en: "Pay a supplier" },
            mode: "ask",
            amountLimit: true,
            maxMode: null,
        },
    ],
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
        setup?: ApprovalSetup | null
        rule?: "none"
        action?: string
        nodes?: GraphNodeRegistryService
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
    const modules = mock<ModulesService>({
        find: jest.fn().mockResolvedValue({
            ...MODULE,
            authorityActions: [{ ...MODULE.authorityActions[0], action: options.action ?? "pay_supplier" }],
        }),
    })
    const templates = mock<AutomationTemplatesService>({
        listTemplates: jest.fn().mockResolvedValue([
            {
                key: "other",
                moduleKey: "sales",
                version: 1,
                executor: "implemented",
                name: { vi: "", en: "Other" },
                trigger: { kind: "schedule", line: { vi: "", en: "x" } },
                authority: { action: null },
            },
        ]),
    })
    const rules = mock<AuthorityRulesService>({
        approvalSetup: jest.fn().mockResolvedValue(options.setup === undefined ? SETUP : options.setup),
        ruleFor: jest.fn().mockResolvedValue(options.rule === "none" ? null : { limit_vnd: 5_000_000 }),
    })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphSeedService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModulesService, useValue: modules },
            { provide: AutomationTemplatesService, useValue: templates },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            ...(options.nodes === undefined ? [] : [{ provide: GraphNodeRegistryService, useValue: options.nodes }]),
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphSeedService), graphs, rules, templates, logger }
}

describe("AgentGraphSeedService.ensureFor", () => {
    it("seeds the graph of the agent from its module, its templates and the rule the owner set", async () => {
        const { service, graphs, rules } = await build()

        await service.ensureFor("inst-1", "en")

        const [workspaceId, agentId, installationId, seed] = graphs.ensure.mock.calls[0] ?? []
        expect([workspaceId, agentId, installationId]).toEqual(["ws-1", "agent-1", "inst-1"])
        expect(seed?.nodes.map((node) => node.key)).toContain("decide:pay_supplier")
        const decide = seed?.nodes.find((node) => node.key === "decide:pay_supplier")?.decide
        expect(decide?.branches.map((branch) => [branch.key, branch.then])).toEqual([
            ["auto", "auto"],
            ["ask", "ask"],
            ["else", "stop"],
        ])
        expect(rules.approvalSetup).toHaveBeenCalledWith("ws-1", "pay_supplier")
        expect(rules.ruleFor).toHaveBeenCalledWith({ workspaceId: "ws-1" }, "pay_supplier", "inst-1", "agent-1")
    })

    it("seeds only the templates of its own module and writes the words in the language asked", async () => {
        const { service, graphs } = await build()

        await service.ensureFor("inst-1", "vi")

        const seed = graphs.ensure.mock.calls[0]?.[3]
        expect(seed?.nodes.some((node) => node.key.startsWith("start:other"))).toBe(false)
        expect(seed?.nodes.find((node) => node.key === "understand")?.title).toContain("[agentGraphs.base.")
    })

    it("closes an action the owner granted no rule for", async () => {
        const { service, graphs } = await build({ setup: null })

        await service.ensureFor("inst-1", "en")

        const seed = graphs.ensure.mock.calls[0]?.[3]
        expect(seed?.nodes.map((node) => node.key)).toContain("stop:pay_supplier")
    })

    it("seeds a rule that runs alone on any amount read when the owner set no effective rule", async () => {
        const { service, graphs } = await build({ rule: "none", setup: { ...SETUP, auto_max: null, ask_max: null } })

        await service.ensureFor("inst-1", "en")

        const seed = graphs.ensure.mock.calls[0]?.[3]
        const decide = seed?.nodes.find((node) => node.key === "decide:pay_supplier")?.decide
        expect(decide?.branches.map((branch) => [branch.key, branch.when])).toEqual([
            ["auto", { fact: "pay_supplier.amount_vnd", op: "known" }],
            ["else", "else"],
        ])
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
    /** The state of an agent whose graph is the seed the default rules derive. */
    const seedState = async (): Promise<GraphState> => {
        const { service, graphs } = await build()
        await service.ensureFor("inst-1", "en")
        const document = graphs.ensure.mock.calls[0]?.[3] ?? graphOf(OWNER_EXAMPLE)
        return stateOf({ activeKind: "seed", draft: document, active: document })
    }

    it("publishes a new seed, by nobody, when the rules now derive a graph that does something else", async () => {
        const state = await seedState()
        const { service, graphs } = await build({ setup: null })

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
        expect(input?.document.nodes.map((node) => node.key)).toContain("stop:pay_supplier")
    })

    it("leaves a seed alone when the rules still derive what it does", async () => {
        const state = await seedState()
        const { service, graphs } = await build()

        await expect(service.refresh(state, "accounting", "vi")).resolves.toBe(false)
        expect(graphs.publish).not.toHaveBeenCalled()
    })

    it("publishes a new seed, by nobody, for a seed that still carries no grant, so the default deny gets its kind of agent's grant", async () => {
        const state = await seedState()
        const { service, graphs } = await build()

        await expect(
            service.refresh(
                { ...state, active: state.active === null ? null : { ...state.active, rights: [] } },
                "accounting",
                "en",
            ),
        ).resolves.toBe(true)
        expect(graphs.publish.mock.calls[0]?.[0].document.rights.map((right) => right.kind)).toContain("brain")
    })

    it("leaves alone a version a person published, a graph with no version and a graph with unpublished edits", async () => {
        const seeded = await seedState()
        const { service, graphs, rules } = await build({ setup: null })
        const edited = { ...seeded.draft, nodes: seeded.draft.nodes.slice(1) }

        await expect(service.refresh({ ...seeded, activeKind: "edit" }, "accounting", "en")).resolves.toBe(false)
        await expect(service.refresh({ ...seeded, active: null }, "accounting", "en")).resolves.toBe(false)
        await expect(service.refresh({ ...seeded, draft: edited }, "accounting", "en")).resolves.toBe(false)
        expect(rules.approvalSetup).not.toHaveBeenCalled()
        expect(graphs.publish).not.toHaveBeenCalled()
    })

    it("leaves a seed alone when the graph the rules derive cannot be read", async () => {
        const state = await seedState()
        const { service, graphs } = await build({ action: "x".repeat(70) })

        await expect(service.refresh(state, "accounting", "en")).resolves.toBe(false)
        expect(graphs.publish).not.toHaveBeenCalled()
    })
})

describe("AgentGraphSeedService.refresh of a node graph", () => {
    const FLOW: GraphSpec = {
        schema: "nivo/agent-graph@1",
        moduleKey: "accounting",
        trigger: { kind: "tag", sources: ["system-event"] },
        grant: { rights: [], tools: [], effects: [] },
        nodes: [{ key: "end", kind: "output", step: "stop" }],
    }
    const flowState = (activeKind: "seed" | "spec", flow: GraphSpec = FLOW): GraphState => {
        const document = { ...graphOf(OWNER_EXAMPLE), flow }
        return stateOf({ activeKind, draft: document, active: document })
    }
    const raise = { effect: "work-item.raise", execute: jest.fn().mockResolvedValue({ kind: "work-item", id: "w-1" }) }
    const installed = (executor: typeof raise | null = raise): GraphNodeRegistryService =>
        mock<GraphNodeRegistryService>({
            installed: jest.fn().mockReturnValue(nodeIndexOf({ nodes: [], effects: [], tools: [], dataKinds: [] })),
            optionalExecutorOf: jest.fn().mockReturnValue(executor ?? undefined),
        })

    beforeEach(() => raise.execute.mockClear())

    it("never replaces a version that holds a flow, whatever its kind, even when the rules changed", async () => {
        const { service, graphs, rules, logger } = await build({ setup: null, nodes: installed() })

        await expect(service.refresh(flowState("seed"), "accounting", "en")).resolves.toBe(false)
        await expect(service.refresh(flowState("spec"), "accounting", "en")).resolves.toBe(false)

        expect(graphs.publish).not.toHaveBeenCalled()
        expect(rules.approvalSetup).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("names each problem of a flow the installed nodes no longer take, and still leaves it live", async () => {
        const { service, graphs, logger } = await build({ nodes: installed() })
        const broken = { ...FLOW, nodes: [{ key: "gone", kind: "output" as const, step: "order.gone" }] }

        await expect(service.refresh(flowState("spec", broken), "accounting", "en")).resolves.toBe(false)

        expect(graphs.publish).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith("agent_graphs.flow_unsound", {
            workspaceId: "ws-1",
            agentId: "agent-1",
            code: "NODE_UNKNOWN",
            at: "gone",
        })
        const [turn, payload, call] = raise.execute.mock.calls[0] ?? []
        expect(turn).toMatchObject({ workspaceId: "ws-1", agentId: "agent-1", conversationId: null, locale: "en" })
        expect(payload).toEqual({
            action: "review_agent_flow",
            title: "[agentGraphs.flowUnsound.title]",
            payload: { agentId: "agent-1", problems: "NODE_UNKNOWN gone" },
        })
        expect(call.dedupeKey).toMatch(/^flow-unsound:agent-1:[0-9a-f]{16}$/)
    })

    it("raises the same review once per agent and set of problems, and only logs where no module raises work", async () => {
        const { service } = await build({ nodes: installed() })
        const broken = { ...FLOW, nodes: [{ key: "gone", kind: "output" as const, step: "order.gone" }] }
        await service.refresh(flowState("spec", broken), "accounting", "en")
        await service.refresh(flowState("spec", broken), "accounting", "en")
        const keys = raise.execute.mock.calls.map((call) => call[2].dedupeKey)
        expect(new Set(keys).size).toBe(1)

        const bare = await build({ nodes: installed(null) })
        await expect(bare.service.refresh(flowState("spec", broken), "accounting", "en")).resolves.toBe(false)
        expect(bare.logger.warn).toHaveBeenCalled()
    })

    it("only keeps a flow in an app that hosts no nodes", async () => {
        const { service, graphs, logger } = await build({ setup: null })

        await expect(service.refresh(flowState("seed"), "accounting", "en")).resolves.toBe(false)

        expect(graphs.publish).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
    })
})

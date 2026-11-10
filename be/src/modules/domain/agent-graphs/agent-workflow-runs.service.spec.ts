import type { Provider } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import {
    ownerEdited,
    shopAccountingGraph,
    SHOP_GROUP,
    storeDoubles,
    templateGraph,
    workflowDoubles,
} from "@tests/fixtures/builders/agent-workflows.builder"
import { TOOL } from "@nivo-lite/blocks-core"
import type { WorkflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { FakeClock, mock } from "@starci/jest-preset"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import { GraphNodeHostService, GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphNodeStepService } from "./agent-graph-node-step.service"
import { AgentGraphRunNoticesService } from "./agent-graph-run-notices.service"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { agentToolsOf } from "./policies/flow.policy"
import { workflowRunGrantOf } from "./policies/workflow-grant.policy"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import { runWorkflowPinOf } from "./agent-workflows.mapper"
import type { RunWorkflowPin } from "./agent-workflows.contracts"
import { mockEntityManager } from "@starci/jest-preset"
import type { WorkflowRoute, WorkflowView } from "./agent-workflows.contracts"
import { workflowNotFound } from "./policies/workflow-view.policy"

/** The workflow services on the doubles, and what the memory engine holds. */
interface World extends WorkflowDoubles {
    readonly workflows: AgentWorkflowsService
    readonly adoption: AgentWorkflowAdoptionService
    readonly runs: AgentWorkflowRunsService
    readonly store: AgentWorkflowStoreService
}

const buildWorld = async (): Promise<World> => {
    const doubles = workflowDoubles([
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowRunsService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
    ])
    const moduleRef = await Test.createTestingModule({ providers: [...doubles.providers] }).compile()
    return {
        ...doubles,
        workflows: moduleRef.get(AgentWorkflowsService),
        adoption: moduleRef.get(AgentWorkflowAdoptionService),
        runs: moduleRef.get(AgentWorkflowRunsService),
        store: moduleRef.get(AgentWorkflowStoreService),
    }
}

const pinsOf = (world: World): ReadonlyArray<RunWorkflowPin> =>
    world.memory.rows("agent.run-workflow").map(runWorkflowPinOf)

const OWNER = { kind: "owner" as const, memberId: "member-1" }

const activeReports = async (world: World): Promise<WorkflowView> => {
    await world.adoption.adoptAgentGraph("ws-1", "agent-1")
    const pick = { templateId: "accounting.reports", version: null }
    const reports = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
    await world.workflows.setStatus("ws-1", reports.id, "active")
    return reports
}

const routeOf = async (world: World, source: string): Promise<WorkflowRoute> => {
    const route = await world.runs.route("ws-1", "agent-1", { source, scope: {}, pin: null })
    if (route === null) throw workflowNotFound()
    return route
}

describe("AgentWorkflowRunsService: routing a wake", () => {
    it("sends a wake its trigger takes (a bank credit) to the primary workflow, read by its agent graph version, and a wake no active workflow takes to none", async () => {
        const world = await buildWorld()
        const pick = { templateId: "accounting.reports", version: null }
        await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")

        const route = await routeOf(world, "system-event")

        expect(route).toMatchObject({ agentId: "agent-1", versionId: "graph-v1", workflowVersion: 1 })
        expect(route.flow.nodes.length).toBeGreaterThan(3)
        // The reports workflow is still a draft, and the reconcile graph does not wake on a schedule.
        await expect(
            world.runs.route("ws-1", "agent-1", { source: "schedule", scope: {}, pin: null }),
        ).resolves.toBeNull()
    })

    it("sends a schedule wake to an active narrower workflow, read by its own version", async () => {
        const world = await buildWorld()
        const reports = await activeReports(world)

        const schedule = await routeOf(world, "schedule")
        const credit = await routeOf(world, "system-event")

        expect(schedule).toMatchObject({ workflowId: reports.id, workflowVersion: 1 })
        expect(schedule.versionId).toBe(schedule.workflowVersionId)
        expect(credit.versionId).toBe("graph-v1")
    })

    it("answers null for an agent with no workflow that runs", async () => {
        const world = await buildWorld()
        world.graphs.stateOfAgent.mockResolvedValue(null)

        await expect(
            world.runs.route("ws-1", "agent-1", { source: "channel", scope: {}, pin: null }),
        ).resolves.toBeNull()
    })
})

/** Makes a workflow of the template for agent-1 and turns it on; the workflow's view. */
const activeFrom = async (world: World, templateId: string): Promise<WorkflowView> => {
    await world.adoption.adoptAgentGraph("ws-1", "agent-1")
    const made = await world.workflows.createFromTemplate("ws-1", "agent-1", { templateId, version: null }, OWNER, "vi")
    await world.workflows.setStatus("ws-1", made.id, "active")
    return made
}

const wakeRoute = (world: World, source: string, scope: Readonly<Record<string, unknown>>) =>
    world.runs.route("ws-1", "agent-1", { source, scope, pin: null })

describe("AgentWorkflowRunsService: routing by the triggers", () => {
    it("routes by condition: a timer wake goes to the workflow whose condition its care kind meets, else to the primary", async () => {
        const world = await buildWorld()
        const delivery = await activeFrom(world, "sales.delivery-check")
        const occasion = await activeFrom(world, "sales.occasion")

        await expect(wakeRoute(world, "system-event", { careKind: "occasion" })).resolves.toMatchObject({
            workflowId: occasion.id,
            workflowVersion: 1,
        })
        await expect(wakeRoute(world, "system-event", { careKind: "delivery-check" })).resolves.toMatchObject({
            workflowId: delivery.id,
        })
        await expect(wakeRoute(world, "system-event", { careKind: "unheard-of" })).resolves.toMatchObject({
            versionId: "graph-v1",
        })
    })

    it("routes by presence: the website order goes to its workflow only when the request is there", async () => {
        const world = await buildWorld()
        const order = await activeFrom(world, "sales.web-order")

        await expect(wakeRoute(world, "system-event", { request: "10 chau lan" })).resolves.toMatchObject({
            workflowId: order.id,
        })
        await expect(wakeRoute(world, "system-event", { request: "" })).resolves.toMatchObject({
            versionId: "graph-v1",
        })
    })

    it("routes by channel: a Zalo or Telegram wake goes to the front desk, any other channel to no workflow", async () => {
        const world = await buildWorld()
        const desk = await activeFrom(world, "chatbot.front-desk")

        await expect(wakeRoute(world, "channel", { channel: "telegram" })).resolves.toMatchObject({
            workflowId: desk.id,
        })
        await expect(wakeRoute(world, "channel", { channelEventId: "zalo:42" })).resolves.toMatchObject({
            workflowId: desk.id,
        })
        await expect(wakeRoute(world, "channel", { channel: "facebook" })).resolves.toBeNull()
    })

    it("never routes to a workflow that is not active", async () => {
        const world = await buildWorld()
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")
        const pick = { templateId: "sales.occasion", version: null }
        await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")

        await expect(wakeRoute(world, "system-event", { careKind: "occasion" })).resolves.toMatchObject({
            versionId: "graph-v1",
        })
    })
})

describe("AgentWorkflowRunsService: routing by a hand-off pin", () => {
    /** The consult workflow turned on with a second version, so that latest and number 1 differ. */
    const consultWithTwoVersions = async (world: World): Promise<WorkflowView> => {
        const consult = await activeFrom(world, "sales.consult")
        await world.workflows.publish(
            "ws-1",
            consult.id,
            ownerEdited(templateGraph("sales.consult")),
            OWNER,
            1,
            "second",
        )
        return consult
    }

    it("sends a latest hand-off to the version the workflow runs now", async () => {
        const world = await buildWorld()
        const consult = await consultWithTwoVersions(world)

        const route = await world.runs.route("ws-1", "agent-1", {
            source: "agent",
            scope: {},
            pin: { workflow: "consult", version: "latest" },
        })

        expect(route).toMatchObject({ workflowId: consult.id, workflowKey: "consult", workflowVersion: 2 })
    })

    it("sends a pinned hand-off to exactly that version, and nowhere when the workflow has no such version", async () => {
        const world = await buildWorld()
        const consult = await consultWithTwoVersions(world)

        const first = await world.runs.route("ws-1", "agent-1", {
            source: "agent",
            scope: {},
            pin: { workflow: "consult", version: 1 },
        })
        const missing = await world.runs.route("ws-1", "agent-1", {
            source: "agent",
            scope: {},
            pin: { workflow: "consult", version: 9 },
        })

        expect(first).toMatchObject({ workflowId: consult.id, workflowVersion: 1 })
        expect(first?.workflowVersionId).not.toBe((await routeOf(world, "agent")).workflowVersionId)
        expect(missing).toBeNull()
    })

    it("goes to the workflow the hand-off names whatever the wake's source and conditions, and to none that is unknown or off", async () => {
        const world = await buildWorld()
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")
        const pick = { templateId: "sales.occasion", version: null }
        await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
        const pin = (workflow: string) => ({
            source: "channel",
            scope: {},
            pin: { workflow, version: "latest" as const },
        })

        await expect(world.runs.route("ws-1", "agent-1", pin("occasion"))).resolves.toBeNull()
        await expect(world.runs.route("ws-1", "agent-1", pin("nobody"))).resolves.toBeNull()
        await expect(world.runs.route("ws-1", "agent-1", pin("reconcile"))).resolves.toMatchObject({
            versionId: "graph-v1",
            workflowKey: "reconcile",
        })
    })
})

describe("AgentWorkflowRunsService.workflowKeyOfRun", () => {
    it("names the workflow a run is pinned to, and nothing for a run of no workflow", async () => {
        const world = await buildWorld()
        const reports = await activeReports(world)
        const route = await routeOf(world, "schedule")
        await world.runs.pinRun(mockEntityManager(), "ws-1", "run-1", route)

        await expect(world.runs.workflowKeyOfRun("ws-1", "run-1")).resolves.toBe("reports")
        await expect(world.runs.workflowKeyOfRun("ws-1", "run-2")).resolves.toBeNull()
        expect(reports.key).toBe("reports")
    })
})

describe("AgentWorkflowRunsService: pins", () => {
    it("pins a run once and reads the pins of the runs that have one, with the workflow's name", async () => {
        const world = await buildWorld()
        const reports = await activeReports(world)
        const route = await routeOf(world, "schedule")

        await world.runs.pinRun(mockEntityManager(), "ws-1", "run-1", route)
        await world.runs.pinRun(mockEntityManager(), "ws-1", "run-1", route)
        const pins = await world.runs.pinsOf("ws-1", ["run-1", "run-2"])

        expect(pinsOf(world)).toHaveLength(1)
        expect(pins).toEqual([{ runId: "run-1", workflowId: reports.id, workflowName: reports.name, version: 1 }])
    })
})

/** The workflow services over the REAL agent graph store, all on one transactional memory engine. */
interface EngineWorld {
    readonly workflows: AgentWorkflowsService
    readonly runs: AgentWorkflowRunsService
    readonly graphs: AgentGraphsService
}

const buildEngineModule = async (extra: ReadonlyArray<Provider> = []): Promise<TestingModule> => {
    const doubles = storeDoubles([
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowRunsService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
        AgentGraphsService,
        AgentGraphRecordsService,
    ])
    const moduleRef = await Test.createTestingModule({ providers: [...doubles.providers, ...extra] }).compile()
    const graphs = moduleRef.get(AgentGraphsService)
    await graphs.ensure("ws-1", "agent-1", "inst-1", { nodes: [], rights: [], flow: shopAccountingGraph() })
    return moduleRef
}

const engineWorldOf = (moduleRef: TestingModule): EngineWorld => ({
    workflows: moduleRef.get(AgentWorkflowsService),
    runs: moduleRef.get(AgentWorkflowRunsService),
    graphs: moduleRef.get(AgentGraphsService),
})

const buildEngineWorld = async (): Promise<EngineWorld> => engineWorldOf(await buildEngineModule())

const engineRouteOf = async (world: EngineWorld, source: string): Promise<WorkflowRoute> => {
    const route = await world.runs.route("ws-1", "agent-1", { source, scope: {}, pin: null })
    if (route === null) throw workflowNotFound()
    return route
}

/** The graph the steps of a run read by its version id: what `AgentGraphNodeStepService` runs each node of. */
const stepGraphOf = async (world: EngineWorld, versionId: string): Promise<GraphSpec | undefined> =>
    (await world.graphs.documentOf("ws-1", "agent-1", versionId)).flow

/** The group of a graph's last step: the shop's own change puts it in `SHOP_GROUP`, the shipped template leaves it in none. */
const lastGroupOf = (graph: GraphSpec | undefined): unknown => graph?.nodes.at(-1)?.group ?? null

/** The after-sale workflow the reconcile graph hands off to, which must be there for a publish of that graph to be sound. */
const withAfterSale = async (world: EngineWorld): Promise<void> => {
    const pick = { templateId: "sales.after-sale", version: null }
    await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
}

describe("AgentWorkflowRunsService: a run started before a new version of its workflow", () => {
    it("keeps the version it was pinned to, end to end, while new wakes run the newly published version", async () => {
        const world = await buildEngineWorld()
        await withAfterSale(world)
        const started = await engineRouteOf(world, "system-event")
        await world.runs.pinRun(mockEntityManager(), "ws-1", "run-1", started)

        await world.workflows.publish("ws-1", started.workflowId, templateGraph("accounting.reconcile"), OWNER, 1, "")
        const after = await engineRouteOf(world, "system-event")

        expect(await stepGraphOf(world, started.versionId)).toEqual(started.flow)
        expect(lastGroupOf(await stepGraphOf(world, started.versionId))).toBe(SHOP_GROUP)
        expect(await world.runs.pinsOf("ws-1", ["run-1"])).toEqual([expect.objectContaining({ version: 1 })])
        expect(after).toMatchObject({ workflowId: started.workflowId, workflowVersion: 2 })
        expect(after.versionId).not.toBe(started.versionId)
        expect(lastGroupOf(await stepGraphOf(world, after.versionId))).toBeNull()
    })

    it("keeps a run of a workflow other than the main one on its own version and its own grant after a new version", async () => {
        const world = await buildEngineWorld()
        await world.runs.route("ws-1", "agent-1", { source: "system-event", scope: {}, pin: null })
        const pick = { templateId: "accounting.reports", version: null }
        const made = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
        const before = await world.workflows.detail("ws-1", made.id, "vi")
        const pinned = before.versions[0]?.id ?? ""
        const narrower: GraphSpec = {
            ...templateGraph("accounting.reports"),
            grant: { rights: [], tools: [], effects: [] },
        }

        await world.workflows.publish("ws-1", made.id, narrower, OWNER, 1, "")

        expect(await stepGraphOf(world, pinned)).toEqual(templateGraph("accounting.reports"))
        await expect(world.graphs.runGrantOf("ws-1", "agent-1", pinned)).resolves.toEqual(
            workflowRunGrantOf(templateGraph("accounting.reports").grant, agentToolsOf("accounting")),
        )
    })
})

describe("AgentGraphsService.runGrantOf: what a step of each workflow may reach", () => {
    it("runs the main workflow under its own grant, and any other under what it declares within the agent's declared tool set", async () => {
        const world = await buildEngineWorld()
        const main = await engineRouteOf(world, "system-event")
        const pick = { templateId: "accounting.reports", version: null }
        const reports = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
        const reportsVersion = (await world.workflows.detail("ws-1", reports.id, "vi")).versions[0]?.id ?? ""
        const shop = shopAccountingGraph().grant

        await expect(world.graphs.runGrantOf("ws-1", "agent-1", main.versionId)).resolves.toEqual({
            rights: shop.rights,
            tools: shop.tools,
            effects: null,
        })
        await expect(world.graphs.runGrantOf("ws-1", "agent-1", reportsVersion)).resolves.toEqual(
            workflowRunGrantOf(templateGraph("accounting.reports").grant, agentToolsOf("accounting")),
        )
    })

    it("does not bound another workflow by what the main workflow uses: a tool the main workflow drops stays with the others", async () => {
        const world = await buildEngineWorld()
        const main = await engineRouteOf(world, "system-event")
        await withAfterSale(world)
        const pick = { templateId: "accounting.reconcile", version: null }
        const made = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
        const pinned = (await world.workflows.detail("ws-1", made.id, "vi")).versions[0]?.id ?? ""
        const held = await world.graphs.runGrantOf("ws-1", "agent-1", pinned)
        const narrower: GraphSpec = { ...main.flow, grant: { ...main.flow.grant, tools: [] } }

        await world.workflows.publish("ws-1", main.workflowId, narrower, OWNER, 1, "")

        expect(held.tools.length).toBeGreaterThan(0)
        await expect(world.graphs.runGrantOf("ws-1", "agent-1", pinned)).resolves.toEqual(held)
    })

    it("refuses a version that is not the agent's", async () => {
        const world = await buildEngineWorld()

        await expect(world.graphs.runGrantOf("ws-1", "agent-1", "none")).rejects.toMatchObject({
            code: AgentGraphsErrorCode.VersionNotFound,
        })
    })
})

/** The node step on the engine world's graph store, with `payment.settle` installed to run the effects `effects` holds. */
const nodeStepWorldOf = async (effects: Array<`${string}.${string}`>) => {
    const host = mock<GraphNodeHostService>()
    host.run.mockResolvedValue({ output: { done: true }, effects: [] })
    const settle = mock<NodeDefinition>({ id: "payment.settle", effects })
    const installed = mock<ReturnType<GraphNodeRegistryService["installed"]>>({
        nodes: new Map([["payment.settle", settle]]),
    })
    const registry = mock<GraphNodeRegistryService>({ installed: () => installed })
    const world = await buildEngineWorld()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphNodeStepService,
            { provide: AgentGraphsService, useFactory: () => world.graphs },
            { provide: GraphNodeHostService, useValue: host },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: AgentRunHandlersService, useValue: mock<AgentRunHandlersService>() },
            { provide: AgentGraphFlowRunsService, useValue: mock<AgentGraphFlowRunsService>() },
            { provide: AgentGraphRunNoticesService, useValue: mock<AgentGraphRunNoticesService>() },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
            { provide: CLOCK, useValue: new FakeClock("2026-11-09T02:00:00.000Z") },
        ],
    }).compile()
    return { world, steps: moduleRef.get(AgentGraphNodeStepService), host }
}

/** A one-step workflow of the agent whose graph declares these effects: its version id. */
const settleWorkflowOf = async (world: EngineWorld, effects: ReadonlyArray<string>): Promise<string> => {
    await world.runs.route("ws-1", "agent-1", { source: "system-event", scope: {}, pin: null })
    const blank = { name: `Settle ${effects.join(" ")}`, moduleKey: "accounting" }
    const made = await world.workflows.createBlank("ws-1", "agent-1", blank, OWNER, "vi")
    const graph: GraphSpec = {
        ...templateGraph("accounting.reconcile"),
        grant: { rights: [], tools: [], effects: [...effects] },
        nodes: [{ key: "settle", kind: "output", step: "payment.settle" }],
    }
    return (await world.workflows.publish("ws-1", made.id, graph, OWNER, 1, "")).id
}

const settleStep = (versionId: string) =>
    stepViewOf({
        stepKey: "settle",
        nodeKey: "settle",
        kind: "graph_node",
        input: { versionId, nodeKey: "settle", trigger: {} },
    })

describe("AgentGraphNodeStepService over the graph store: a step needing more than its workflow declares", () => {
    it("parks the step as a missing right when its workflow does not declare the effect, though the agent holds it", async () => {
        const { world, steps, host } = await nodeStepWorldOf([TOOL.paymentMarkPaid])

        await expect(steps.run(settleStep(await settleWorkflowOf(world, [])))).resolves.toEqual({
            kind: "failed",
            code: "RIGHTS_DENIED",
        })
        expect(host.run).not.toHaveBeenCalled()
    })

    it("parks it when the workflow declares an effect the agent does not hold", async () => {
        const { world, steps, host } = await nodeStepWorldOf(["payment.refund"])

        await expect(steps.run(settleStep(await settleWorkflowOf(world, ["payment.refund"])))).resolves.toEqual({
            kind: "failed",
            code: "RIGHTS_DENIED",
        })
        expect(host.run).not.toHaveBeenCalled()
    })

    it("runs it when both the workflow and the agent hold the effect, under the workflow's own grant", async () => {
        const { world, steps, host } = await nodeStepWorldOf([TOOL.paymentMarkPaid])

        await expect(
            steps.run(settleStep(await settleWorkflowOf(world, [TOOL.paymentMarkPaid]))),
        ).resolves.toMatchObject({
            kind: "done",
        })
        expect(host.run).toHaveBeenCalledWith(
            expect.objectContaining({ nodeId: "payment.settle", grant: { rights: [], tools: [] } }),
        )
    })
})

import type { Provider } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import {
    ownerEdited,
    shopCreditGraph,
    SHOP_GROUP,
    storeDoubles,
    templateGraph,
    workflowDoubles,
} from "@tests/fixtures/builders/agent-workflows.builder"
import type { WorkflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { agentToolsOf } from "./policies/flow.policy"
import { ownRunGrantOf, workflowRunGrantOf } from "./policies/workflow-grant.policy"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import { AGENT_RUNS, RUN_DEFAULTS } from "@tests/fixtures/builders/engine-core-tables.builder"
import type { RunWorkflowPin } from "./agent-workflows.contracts"
import { mockEntityManager } from "@starci/jest-preset"
import type { WorkflowRoute, WorkflowView } from "./agent-workflows.contracts"
import { workflowNotFound } from "./policies/workflow-view.policy"
import type { FlowWake } from "./policies/graph-flow.policy"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { TRIGGER_WAKE_SOURCE } from "@modules/domain/provider-triggers/trigger-delivery.policy"

/** The workflow services on the doubles, and what the memory engine holds. */
interface World extends WorkflowDoubles {
    readonly workflows: AgentWorkflowsService
    readonly adoption: AgentWorkflowAdoptionService
    readonly runs: AgentWorkflowRunsService
    readonly store: AgentWorkflowStoreService
}

const buildWorld = async (): Promise<World> => {
    // Ledger (TOOLS-LEAD 2026-11-13): this spec routes wakes to the primary workflow, a bank credit (system event) among them: the primary here is
    // the payment graph of `sales` (the stand-in of the dropped accounting agent's reconcile graph).
    const doubles = workflowDoubles(
        [
            AgentWorkflowsService,
            AgentWorkflowAdoptionService,
            AgentWorkflowRunsService,
            AgentWorkflowStoreService,
            AgentWorkflowRecordsService,
        ],
        shopCreditGraph(),
    )
    const moduleRef = await Test.createTestingModule({ providers: [...doubles.providers] }).compile()
    return {
        ...doubles,
        workflows: moduleRef.get(AgentWorkflowsService),
        adoption: moduleRef.get(AgentWorkflowAdoptionService),
        runs: moduleRef.get(AgentWorkflowRunsService),
        store: moduleRef.get(AgentWorkflowStoreService),
    }
}

/** The pins the runs of the world hold: the workflow columns of the runs table. */
const pinsOf = (world: World): ReadonlyArray<RunWorkflowPin> =>
    world.memory.rows(AGENT_RUNS).flatMap((row) =>
        row.data.workflowId === null
            ? []
            : [
                  {
                      runId: row.id,
                      workflowId: String(row.data.workflowId),
                      workflowVersionId: String(row.data.workflowVersionId),
                      workflowVersion: Number(row.data.workflowVersion),
                  },
              ],
    )

/** The run a wake opened, as the run open writes it before it pins the run (in one transaction). */
const opened = (world: { readonly memory: World["memory"] }, runId: string): void => {
    world.memory.put(AGENT_RUNS, runId, {
        ...RUN_DEFAULTS,
        agentId: "agent-1",
        wakeId: `wake-${runId}`,
        trigger: "graph_flow",
        graphVersionId: null,
        context: {},
        startedAt: "2026-11-09T02:00:00.000Z",
    })
}

const OWNER = { kind: "owner" as const, memberId: "member-1" }

const activeReports = async (world: World): Promise<WorkflowView> => {
    await world.adoption.adoptAgentGraph("ws-1", "agent-1")
    const pick = { templateId: "webbooks.debt-round", version: null }
    const reports = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
    await world.workflows.setStatus("ws-1", reports.id, "active")
    return reports
}

/**
 * The scope a wake of each road carries as its producer writes it. Ledger (TOOLS-LEAD W2): a system event was an empty scope, which only
 * the road-only match let the retired core SePay road take; it is a SePay credit as the emit point hands it (the provider trigger's tag).
 * An agent's call names the agent that wrote it (the tag door's `authorAgentId`), which is what makes it a call.
 */
const scopeOfRoad = (source: string): Readonly<Record<string, unknown>> => {
    if (source === "agent") return { authorAgentId: "agent-2" }
    return source === "system-event"
        ? {
              source: "provider_trigger",
              providerTrigger: "sepay:transaction.received",
              connectionId: "s1",
              // Ledger (ROAD Opus-1f, R44): the movement is the event's `data`, read by path by the credit narrowing.
              data: { direction: "in", transactionId: "tx-1" },
          }
        : {}
}

const routeOf = async (world: World, source: string): Promise<WorkflowRoute> => {
    const route = await world.runs.route("ws-1", "agent-1", { source, scope: scopeOfRoad(source), pin: null })
    if (route === null) throw workflowNotFound()
    return route
}

describe("AgentWorkflowRunsService: routing a wake", () => {
    it("sends a wake its trigger takes (a bank credit) to the primary workflow, read by its agent graph version, and a wake no active workflow takes to none", async () => {
        const world = await buildWorld()
        const pick = { templateId: "webbooks.debt-round", version: null }
        await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")

        const route = await routeOf(world, "system-event")

        expect(route).toMatchObject({ agentId: "agent-1", versionId: "graph-v1", workflowVersion: 1 })
        expect(route.flow.nodes.length).toBeGreaterThan(3)
        // The reports workflow is still a draft, and the payment graph does not wake on a schedule.
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

/** A due timer's event data as its pure translate gives it (`TIMER_DUE_TRIGGER`): the task, the arm's ref, its data and the instant. */
const dueTimerData = (kind: string, ref: string) => ({
    taskId: `task-${ref}`,
    ref,
    data: { kind, record: ref },
    dueAt: "2026-11-12T02:00:00.000Z",
})

const wakeRoute = (world: World, source: string, scope: Readonly<Record<string, unknown>>) =>
    world.runs.route("ws-1", "agent-1", { source, scope, pin: null })

// Ledger (TOOLS-LEAD F2, 2026-11-13): a care timer's graphs key on `data.kind` (`careTimerWhereOf`, the sales recomposition: the generic
// `nivo.tool.timer.arm` carries the kind in its open `data`), so the wakes below carry `data: { kind, record }` as the arm writes it; they
// carried the old `careKind` member, which no graph's condition reads.
// Ledger (TOOLS-LEAD W2): each wake below is written as its producer writes it (the care timer's tag source `care-timer`, the website
// form's `website_lead`, the channel intake's `channel`); they were bare scopes of no verb, and the one no workflow's condition met went
// "to the primary" only because the road-only match let the primary's retired core SePay road take it: it now goes to none.
describe("AgentWorkflowRunsService: routing by the triggers", () => {
    it("routes by condition: a timer wake goes to the workflow whose condition its care kind meets, else to none", async () => {
        const world = await buildWorld()
        const delivery = await activeFrom(world, "sales.delivery-check")
        const occasion = await activeFrom(world, "sales.occasion")
        const timer = (careKind: string) => ({ verb: TRIGGER.timerDue, data: dueTimerData(careKind, "r-1") })

        await expect(wakeRoute(world, TRIGGER_WAKE_SOURCE, timer("occasion"))).resolves.toMatchObject({
            workflowId: occasion.id,
            workflowVersion: 1,
        })
        await expect(wakeRoute(world, TRIGGER_WAKE_SOURCE, timer("delivery-check"))).resolves.toMatchObject({
            workflowId: delivery.id,
        })
        await expect(wakeRoute(world, TRIGGER_WAKE_SOURCE, timer("unheard-of"))).resolves.toBeNull()
    })

    it("routes by presence: the website order goes to its workflow only when the request is there", async () => {
        const world = await buildWorld()
        const order = await activeFrom(world, "sales.web-order")

        const form = (request: string) => ({ verb: TRIGGER.websiteMessageReceived, data: { request } })
        await expect(wakeRoute(world, TRIGGER_WAKE_SOURCE, form("10 chau lan"))).resolves.toMatchObject({
            workflowId: order.id,
        })
        await expect(wakeRoute(world, TRIGGER_WAKE_SOURCE, form(""))).resolves.toBeNull()
    })

    it("routes by channel: a Zalo or Telegram wake goes to the front desk, any other channel to no workflow", async () => {
        const world = await buildWorld()
        const desk = await activeFrom(world, "chatbot.front-desk")

        await expect(wakeRoute(world, "channel", { channel: "telegram" })).resolves.toMatchObject({
            workflowId: desk.id,
        })
        await expect(wakeRoute(world, "channel", { channel: "zalo", channelEventId: "zalo:42" })).resolves.toMatchObject({
            workflowId: desk.id,
        })
        await expect(wakeRoute(world, "channel", { channel: "website" })).resolves.toBeNull()
    })

    it("never routes to a workflow that is not active", async () => {
        const world = await buildWorld()
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")
        const pick = { templateId: "sales.occasion", version: null }
        await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")

        await expect(
            wakeRoute(world, TRIGGER_WAKE_SOURCE, { verb: TRIGGER.timerDue, data: dueTimerData("occasion", "r-1") }),
        ).resolves.toBeNull()
    })
})

describe("AgentWorkflowRunsService.takersOf (which workflow a scheduled timer will wake, read only)", () => {
    // Ledger (ROAD Opus-1d, 2026-11-14): a due timer is the `timer.due` event of the one pipeline (`ClockTickDeliveryService.deliverTimer`);
    // the sample was the retired care tag (`timerTagOf`, deleted, owner rule R28), which no registration reads any more.
    const careWake = (kind: string, ref: string): FlowWake => ({
        source: TRIGGER_WAKE_SOURCE,
        context: { verb: TRIGGER.timerDue, eventId: `task-${ref}`, dataJson: JSON.stringify(dueTimerData(kind, ref)) },
        actorMemberId: null,
    })

    it("names the workflow each care tag goes to, as the route takes it (by its condition on the care kind), with its name", async () => {
        const world = await buildWorld()
        const delivery = await activeFrom(world, "sales.delivery-check")
        const occasion = await activeFrom(world, "sales.occasion")

        const takers = await world.runs.takersOf("ws-1", "agent-1", [
            careWake("occasion", "lead-1"),
            careWake("delivery-check", "o-1"),
        ])

        expect(takers.map((taker) => taker?.workflowId)).toEqual([occasion.id, delivery.id])
        expect(takers[0]?.name).toBe(occasion.name)
        await expect(world.runs.takersOf("ws-1", "agent-1", [])).resolves.toEqual([])
    })

    it("names nothing for an agent with no active workflow that takes the wake", async () => {
        const world = await buildWorld()

        await expect(world.runs.takersOf("ws-1", "agent-1", [careWake("occasion", "lead-1")])).resolves.toEqual([null])
    })
})

describe("AgentWorkflowRunsService: routing by a hand-off pin", () => {
    /** The consult workflow turned on with a second version, so that latest and number 1 differ. */
    const consultWithTwoVersions = async (world: World): Promise<WorkflowView> => {
        // The consult graph hands a sale on to `after-sale`: a version is saved only when the workflows it calls exist (the call check).
        await activeFrom(world, "sales.after-sale")
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
        // Ledger (TOOLS-LEAD 2026-11-13): the world's primary workflow is keyed by the `webbooks` module's primary template (`invoice`);
        // it was `payment`, the dropped accounting agent's reconcile key.
        await expect(world.runs.route("ws-1", "agent-1", pin("invoice"))).resolves.toMatchObject({
            versionId: "graph-v1",
            workflowKey: "invoice",
        })
    })
})

describe("AgentWorkflowRunsService.workflowKeyOfRun", () => {
    it("names the workflow a run is pinned to, and nothing for a run of no workflow", async () => {
        const world = await buildWorld()
        const reports = await activeReports(world)
        const route = await routeOf(world, "schedule")
        opened(world, "run-1")
        await world.runs.pinRun(mockEntityManager(), "ws-1", "run-1", route)

        await expect(world.runs.workflowKeyOfRun("ws-1", "run-1")).resolves.toBe("debt-round")
        await expect(world.runs.workflowKeyOfRun("ws-1", "run-2")).resolves.toBeNull()
        expect(reports.key).toBe("debt-round")
    })
})

describe("AgentWorkflowRunsService: pins", () => {
    it("pins a run once and reads the pins of the runs that have one, with the workflow's name", async () => {
        const world = await buildWorld()
        const reports = await activeReports(world)
        const route = await routeOf(world, "schedule")

        opened(world, "run-1")
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
    readonly memory: World["memory"]
}

/** The engine module and the memory engine its stores are on. */
interface EngineModule {
    readonly moduleRef: TestingModule
    readonly memory: World["memory"]
}

const buildEngineModule = async (extra: ReadonlyArray<Provider> = []): Promise<EngineModule> => {
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
    await graphs.ensure("ws-1", "agent-1", "inst-1", { nodes: [], flow: shopCreditGraph() })
    return { moduleRef, memory: doubles.memory }
}

const engineWorldOf = ({ moduleRef, memory }: EngineModule): EngineWorld => ({
    workflows: moduleRef.get(AgentWorkflowsService),
    runs: moduleRef.get(AgentWorkflowRunsService),
    graphs: moduleRef.get(AgentGraphsService),
    memory,
})

const buildEngineWorld = async (): Promise<EngineWorld> => engineWorldOf(await buildEngineModule())

const engineRouteOf = async (world: EngineWorld, source: string): Promise<WorkflowRoute> => {
    const route = await world.runs.route("ws-1", "agent-1", { source, scope: scopeOfRoad(source), pin: null })
    if (route === null) throw workflowNotFound()
    return route
}

/** The graph the steps of a run read by its version id: what the thread of the run is compiled from (`ThreadGraphsService.pinned`). */
const stepGraphOf = async (world: EngineWorld, versionId: string): Promise<GraphSpec | undefined> =>
    (await world.graphs.documentOf("ws-1", "agent-1", versionId)).flow

/** The group of a graph's last step: the shop's own change puts it in `SHOP_GROUP`, the shipped template leaves it in none. */
const lastGroupOf = (graph: GraphSpec | undefined): unknown => graph?.nodes.at(-1)?.group ?? null

/** The workflow the payment graph hands off to, inside its own agent (`sales.after-sale`), which must be there for a publish of that graph to be sound. */
const withAfterSale = async (world: EngineWorld): Promise<void> => {
    for (const templateId of ["sales.after-sale"])
        await world.workflows.createFromTemplate("ws-1", "agent-1", { templateId, version: null }, OWNER, "vi")
}

describe("AgentWorkflowRunsService: a run started before a new version of its workflow", () => {
    it("keeps the version it was pinned to, end to end, while new wakes run the newly published version", async () => {
        const world = await buildEngineWorld()
        await withAfterSale(world)
        const started = await engineRouteOf(world, "system-event")
        opened(world, "run-1")
        await world.runs.pinRun(mockEntityManager(), "ws-1", "run-1", started)

        await world.workflows.publish("ws-1", started.workflowId, templateGraph("sales.payment"), OWNER, 1, "")
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
        const pick = { templateId: "webbooks.debt-round", version: null }
        const made = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
        const before = await world.workflows.detail("ws-1", made.id, "vi")
        const pinned = before.versions[0]?.id ?? ""
        const narrower: GraphSpec = {
            ...templateGraph("webbooks.debt-round"),
            grant: { tools: [], effects: [] },
        }

        await world.workflows.publish("ws-1", made.id, narrower, OWNER, 1, "")

        expect(await stepGraphOf(world, pinned)).toEqual(templateGraph("webbooks.debt-round"))
        await expect(world.graphs.runGrantOf("ws-1", "agent-1", pinned)).resolves.toEqual(
            workflowRunGrantOf(templateGraph("webbooks.debt-round").grant, agentToolsOf("webbooks")),
        )
    })
})

describe("AgentGraphsService.runGrantOf: what a step of each workflow may reach", () => {
    it("runs the main workflow under its own grant, and any other under what it declares within the agent's declared tool set", async () => {
        const world = await buildEngineWorld()
        const main = await engineRouteOf(world, "system-event")
        const pick = { templateId: "webbooks.debt-round", version: null }
        const reports = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
        const reportsVersion = (await world.workflows.detail("ws-1", reports.id, "vi")).versions[0]?.id ?? ""
        const shop = shopCreditGraph().grant

        // The own graph's grant as it stands, with the default context reads every run holds (W2/W3).
        await expect(world.graphs.runGrantOf("ws-1", "agent-1", main.versionId)).resolves.toEqual(ownRunGrantOf(shop))
        await expect(world.graphs.runGrantOf("ws-1", "agent-1", reportsVersion)).resolves.toEqual(
            workflowRunGrantOf(templateGraph("webbooks.debt-round").grant, agentToolsOf("webbooks")),
        )
    })

    it("does not bound another workflow by what the main workflow uses: a tool the main workflow drops stays with the others", async () => {
        const world = await buildEngineWorld()
        const main = await engineRouteOf(world, "system-event")
        await withAfterSale(world)
        const pick = { templateId: "sales.payment", version: null }
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

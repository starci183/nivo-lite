import { Test } from "@nestjs/testing"
import { AGENT_WORKFLOWS, AGENT_WORKFLOW_VERSIONS, workflowRecordOfRow, workflowVersionRecordOfRow } from "@tests/fixtures/builders/engine-core-tables.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { AccountAttachmentsService, NodeAccountConsentsService } from "@modules/domain/tool-grants"
import type { NodeAccountPolicyRecord, ProviderAttachmentView } from "@modules/domain/tool-grants"
import { shopAccountingGraph, storeDoubles, workflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import type { StoreDoubles, WorkflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentGraphRightsService } from "./agent-graph-rights.service"
import { AgentRightsRecordsService } from "./agent-rights-records.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import type { WorkflowRecord, WorkflowVersionRecord } from "./agent-workflows.contracts"
import { SCOPE } from "@tests/fixtures/builders/agent-graph-records.builder"
import { ownerEdited, templateGraph, templateNewest } from "@tests/fixtures/builders/agent-workflows.builder"
import { RIGHTS_FLOW, rightsIndexOf } from "@tests/fixtures/builders/agent-rights.builder"
import { AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { noRights } from "./policies/node-rights-gate.policy"
import { snapshotHashOf } from "./policies/workflow-view.policy"

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

const workflowsOf = (world: World): ReadonlyArray<WorkflowRecord> =>
    world.memory.rows(AGENT_WORKFLOWS).map(workflowRecordOfRow)

const versionsOf = (world: World): ReadonlyArray<WorkflowVersionRecord> =>
    world.memory.rows(AGENT_WORKFLOW_VERSIONS).map(workflowVersionRecordOfRow)

const OWNER = { kind: "owner" as const, memberId: "member-1" }

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof Error && "code" in cause ? cause.code : cause
    }
}

describe("AgentWorkflowStoreService", () => {
    it("refuses a version whose number someone else took first, and an unknown workflow", async () => {
        const world = await buildWorld()
        const pick = { templateId: "webbooks.debt-round", version: null }
        const made = await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")
        const held = workflowsOf(world).filter((workflow) => workflow.id === made.id)
        const stale = held.map((workflow) => ({ ...workflow, latestNumber: 0 }))
        const graph = templateGraph("webbooks.debt-round")
        const writes = stale.map((workflow) => ({
            workflow,
            graph,
            kind: "edit" as const,
            author: OWNER,
            note: "",
            template: null,
            fromNumber: null,
            graphVersionId: null,
            expected: null,
            rights: noRights(snapshotHashOf(graph), workflow.agentId, workflow.id),
        }))

        expect(writes).toHaveLength(1)
        await expect(codeOf(Promise.all(writes.map((write) => world.store.writeVersion(SCOPE, write))))).resolves.toBe(
            AgentGraphsErrorCode.WorkflowConflict,
        )
        await expect(codeOf(world.store.workflowRequired(SCOPE, "wf-none"))).resolves.toBe(
            AgentGraphsErrorCode.WorkflowNotFound,
        )
    })

    it("keeps a non-primary workflow's versions off the agent graph", async () => {
        const world = await buildWorld()
        const pick = { templateId: "webbooks.debt-round", version: null }

        await world.workflows.createFromTemplate("ws-1", "agent-1", pick, OWNER, "vi")

        expect(world.graphs.publish).not.toHaveBeenCalled()
        expect(versionsOf(world)[0]?.graphVersionId).toBeNull()
    })

    it("cuts no grant and judges nothing in an app that installed no nodes", async () => {
        const world = await buildWorld()
        const graph = templateGraph("webbooks.invoice")

        expect(world.store.trimmedGrantOf(graph)).toEqual(graph.grant)
        expect(() => world.store.requireSound(graph)).not.toThrow()
    })
})

/** The workflow services over the real agent graph store, both on one transactional memory engine. */
interface StoreWorld {
    readonly memory: StoreDoubles["memory"]
    readonly workflows: AgentWorkflowsService
    readonly graphs: AgentGraphsService
}

const buildStoreWorld = async (): Promise<StoreWorld> => {
    const doubles = storeDoubles([
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
        AgentGraphsService,
        AgentGraphRecordsService,
    ])
    const moduleRef = await Test.createTestingModule({ providers: [...doubles.providers] }).compile()
    const graphs = moduleRef.get(AgentGraphsService)
    await graphs.ensure("ws-1", "agent-1", "inst-1", { nodes: [], flow: shopAccountingGraph() })
    const workflows = moduleRef.get(AgentWorkflowsService)
    // The payment graph hands off to the renew and won workflows, which must be there for a publish of it to be sound.
    for (const templateId of ["webrenew.renew", "websales.won"])
        await workflows.createFromTemplate("ws-1", "agent-1", { templateId, version: null }, OWNER, "vi")
    return { memory: doubles.memory, workflows, graphs }
}

/** The primary workflow's id, the newest number of its history, and the agent graph version that decides. */
const standingOf = async (world: StoreWorld): Promise<readonly [number, string | null, number]> => {
    const primary = (await world.workflows.list("ws-1", "agent-1", "vi")).find((workflow) => workflow.primary)
    return [
        primary?.latestNumber ?? -1,
        await world.graphs.activeVersionIdOf("ws-1", "agent-1"),
        await world.graphs.latestVersionOf("ws-1", "agent-1"),
    ]
}

describe("AgentWorkflowStoreService: the primary workflow and the agent graph publish as one", () => {
    it("rolls the agent graph version back when the workflow version fails after it", async () => {
        const world = await buildStoreWorld()
        const primary = (await world.workflows.list("ws-1", "agent-1", "vi")).find((workflow) => workflow.primary)
        const before = await standingOf(world)
        world.memory.failWhen((mutation) => mutation.op === "insert" && mutation.entity === AGENT_WORKFLOW_VERSIONS)

        await expect(
            world.workflows.publish("ws-1", primary?.id ?? "", templateGraph("webbooks.invoice"), OWNER, 1, ""),
        ).rejects.toThrow("memory engine: insert failed")

        expect(await standingOf(world)).toEqual(before)
        expect(before).toEqual([1, "agent_graph_versions-2", 1])
    })

    it("moves both together when the write goes through: the workflow version names the agent graph version that decides", async () => {
        const world = await buildStoreWorld()
        const primary = (await world.workflows.list("ws-1", "agent-1", "vi")).find((workflow) => workflow.primary)

        await world.workflows.publish("ws-1", primary?.id ?? "", templateGraph("webbooks.invoice"), OWNER, 1, "")
        const [latest, activeId, graphLatest] = await standingOf(world)
        const newest = world.memory
            .rows(AGENT_WORKFLOW_VERSIONS)
            .map(workflowVersionRecordOfRow)
            .find((version) => version.number === 2)

        expect([latest, graphLatest]).toEqual([2, 2])
        expect(newest?.graphVersionId).toBe(activeId)
    })
})

const SEND = TOOL.customerMessageSend
const BOSS = { kind: "owner" as const, memberId: "member-1", role: "owner" as const }
const DINH = { kind: "owner" as const, memberId: "member-2", role: "manager" as const }

/** The agent attached to one messaging account, and to one books account unless `books` is false. */
const attachedOf = (books: boolean): ReadonlyArray<ProviderAttachmentView> => [
    { agentId: "agent-1", connectionId: "c-zalo", provider: "zalo_oa" },
    ...(books ? [{ agentId: "agent-1", connectionId: "c-books", provider: "google" }] : []),
]

/**
 * The rights flow (an `@1` flow of spec-own steps, which the owner may edit; a template graph is edited only in its package) with its
 * `tell` step asking the send in another mode.
 */
const tellAsks = (mode: "auto" | "ask"): GraphSpec => ({
    ...RIGHTS_FLOW,
    nodes: RIGHTS_FLOW.nodes.map((node) =>
        node.key === "tell"
            ? { ...node, accounts: [{ kind: "messaging", provider: null, connectionId: null, operations: { [SEND]: mode } }] }
            : node,
    ),
})

/** The node of `WIDER` that asks for more: a second customer line, the send on any messaging account. */
const TELL_AGAIN = "tell-again"

/** The rights flow with one more step that sends: a version that asks one entry more than the rights flow. */
const WIDER: GraphSpec = (() => {
    const [tell, book] = RIGHTS_FLOW.nodes
    if (tell === undefined || book === undefined) return RIGHTS_FLOW
    return { ...RIGHTS_FLOW, nodes: [{ ...tell, next: TELL_AGAIN }, { ...tell, key: TELL_AGAIN, next: book.key }, book] }
})()

const RECONCILE = "webbooks.invoice"
/** The reconcile template's version as the installation ships it today. */
const SHIPPED = templateNewest(RECONCILE)
/** The version before it, which the installation is made to ship too: the shipped graph from before node rights (no step states an account). */
const BEFORE = SHIPPED - 1

/** The reconcile template with its version from before node rights beside the shipped one; any other template as it is. */
const withVersionBefore = (template: WorkflowTemplate | null): WorkflowTemplate | null => {
    if (template?.id !== RECONCILE) return template
    const shipped = template.versions.find((version) => version.version === SHIPPED)
    if (shipped === undefined) return template
    const graph = { ...shipped.graph, nodes: shipped.graph.nodes.map(({ accounts: _accounts, ...node }) => node) }
    return { ...template, versions: [{ ...shipped, version: BEFORE, graph }, ...template.versions] }
}

/**
 * A template ACCEPT needs two versions of one template, and the installation ships each at its one current version: the installation
 * read here also ships the reconcile template's version from before node rights (`BEFORE`), so a workflow installed at it accepts the
 * shipped one (`SHIPPED`), whose steps state their accounts.
 */
const shipVersionBefore = (): void => {
    const templateOf = INSTALLED.templateOf.bind(INSTALLED)
    const templatesOf = INSTALLED.templatesOf.bind(INSTALLED)
    jest.spyOn(INSTALLED, "templateOf").mockImplementation((id) => withVersionBefore(templateOf(id)))
    jest.spyOn(INSTALLED, "templatesOf").mockImplementation((moduleKey) =>
        templatesOf(moduleKey).map((template) => withVersionBefore(template) ?? template),
    )
}

afterEach(() => jest.restoreAllMocks())

/** The workflow roads with the real rights gate, on a grant store kept in memory: an owner's row replaces, any other row is only added. */
interface GateWorld extends World {
    readonly grants: Array<NodeAccountPolicyRecord>
    readonly consents: ReturnType<typeof mock<NodeAccountConsentsService>>
    readonly manager: MockEntityManager
}

const rowKeyOf = (row: NodeAccountPolicyRecord): string =>
    JSON.stringify([row.workflowId, row.nodeKey, row.connectionId, row.operation])

/** The grant store double: reads the rows of a workflow, runs a transaction on one manager, and writes as the real store does. */
const consentsOf = (grants: Array<NodeAccountPolicyRecord>, manager: MockEntityManager) => {
    const consents = mock<NodeAccountConsentsService>()
    consents.listOfWorkflow.mockImplementation((_workspaceId, _agentId, workflowId) =>
        Promise.resolve(grants.filter((row) => row.workflowId === workflowId)),
    )
    consents.transaction.mockImplementation((work) => work(manager))
    consents.record.mockImplementation((_manager, records) => {
        for (const record of records) {
            const at = grants.findIndex((row) => rowKeyOf(row) === rowKeyOf(record))
            if (at === -1) grants.push(record)
            else if (record.origin === "owner") grants[at] = record
        }
        return Promise.resolve(records.length)
    })
    return consents
}

const buildGateWorld = async (books = true): Promise<GateWorld> => {
    const doubles = workflowDoubles([
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowRunsService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
        AgentGraphRightsService,
        AgentRightsRecordsService,
    ])
    const grants: Array<NodeAccountPolicyRecord> = []
    const manager = mockEntityManager()
    const consents = consentsOf(grants, manager)
    doubles.memory.engine.within.mockImplementation((_manager, workspaceId, work) =>
        doubles.memory.engine.scoped(workspaceId, work),
    )
    const access = mock<AccountAttachmentsService>({ listOfAgent: jest.fn().mockResolvedValue(attachedOf(books)) })
    // The installed nodes judge every version: the template graphs by the `@2` checks, the rights flow by its spec-own steps.
    const registry = mock<GraphNodeRegistryService>({ installed: jest.fn().mockReturnValue(rightsIndexOf()) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ...doubles.providers,
            { provide: AccountAttachmentsService, useValue: access },
            { provide: NodeAccountConsentsService, useValue: consents },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    const workflows = moduleRef.get(AgentWorkflowsService)
    // The payment graph hands off to the renew and won workflows, which must be there for a publish of it to be sound.
    for (const templateId of ["webrenew.renew", "websales.won"])
        await workflows.createFromTemplate("ws-1", "agent-1", { templateId, version: null }, { kind: "system", memberId: null }, "vi")
    grants.length = 0
    consents.transaction.mockClear()
    doubles.memory.engine.within.mockClear()
    return {
        ...doubles,
        workflows,
        adoption: moduleRef.get(AgentWorkflowAdoptionService),
        runs: moduleRef.get(AgentWorkflowRunsService),
        store: moduleRef.get(AgentWorkflowStoreService),
        grants,
        consents,
        manager,
    }
}

/** A workflow made from the reconcile template at a version (the newest when none is named), by no person. */
const reconcileOf = (world: GateWorld, version: number | null = null) =>
    world.workflows.createFromTemplate(
        "ws-1",
        "agent-1",
        { templateId: "webbooks.invoice", version },
        { kind: "system", memberId: null },
        "vi",
    )

/** A workflow that runs the OWNER's own flow: made blank (version 1), then the rights flow published by the owner (version 2). */
const ownFlowOf = async (world: GateWorld) => {
    const made = await world.workflows.createBlank("ws-1", "agent-1", { name: "Doi soat", moduleKey: "webbooks" }, BOSS, "vi")
    await world.workflows.publish("ws-1", made.id, RIGHTS_FLOW, BOSS, 1, "")
    return made
}

// nivo-frame `rights`: the publish / install rights GATE is REMOVED. A node's mode is declared in its version (editing it is publishing
// a version), the attachments say which accounts; no road asks the owner for rights or writes a grant row. Every road keeps its
// versions and its status.
describe("AgentWorkflowStoreService: no rights gate on the roads that make a version run", () => {
    it("create from template: version 1, with no grant row and no grant transaction", async () => {
        const world = await buildGateWorld()

        const made = await reconcileOf(world)

        expect(versionsOf(world).filter((version) => version.workflowId === made.id).map((version) => version.number)).toEqual([1])
        expect(world.grants).toEqual([])
        expect(world.consents.transaction).not.toHaveBeenCalled()
    })

    it("publish: a version that lists MORE (one more step that sends) passes for a manager, with no row", async () => {
        const world = await buildGateWorld()
        const made = await ownFlowOf(world)

        const version = await world.workflows.publish("ws-1", made.id, WIDER, DINH, 2, "")

        expect(version.number).toBe(3)
        expect(world.grants).toEqual([])
    })

    it("publish: a step moved from ask to auto, and back, passes for a manager", async () => {
        const world = await buildGateWorld()
        const made = await ownFlowOf(world)

        await world.workflows.publish("ws-1", made.id, tellAsks("ask"), DINH, 2, "")
        const back = await world.workflows.publish("ws-1", made.id, tellAsks("auto"), DINH, 3, "")

        expect(back.number).toBe(4)
        expect(world.grants).toEqual([])
    })

    it("rollback: going back to a version that lists more passes for a manager", async () => {
        const world = await buildGateWorld()
        const made = await ownFlowOf(world)
        await world.workflows.publish("ws-1", made.id, WIDER, BOSS, 2, "")
        await world.workflows.publish("ws-1", made.id, RIGHTS_FLOW, DINH, 3, "")

        const version = await world.workflows.rollback("ws-1", made.id, 3, DINH, 4, "")

        expect(version.number).toBe(5)
        expect(world.grants).toEqual([])
    })

    it("accept template: the shipped version, whose steps list providers, is accepted by a manager with no row", async () => {
        shipVersionBefore()
        const world = await buildGateWorld(false)
        const held = await reconcileOf(world, BEFORE)

        const version = await world.workflows.acceptTemplate("ws-1", held.id, SHIPPED, DINH, 1, "")

        expect(version.number).toBe(2)
        expect(world.grants).toEqual([])
    })

    it("turning on: a manager's rights check refuses nothing, and the workflow turns on", async () => {
        const world = await buildGateWorld(false)
        const made = await reconcileOf(world)

        await world.workflows.requireRights("ws-1", made.id, { memberId: "member-2", role: "manager", agreed: [] })
        await world.workflows.setStatus("ws-1", made.id, "active")

        expect(workflowsOf(world).find((workflow) => workflow.id === made.id)?.status).toBe("active")
        expect(world.grants).toEqual([])
    })
})

describe("AgentWorkflowStoreService: a write carries the settlement of its own graph", () => {
    it("refuses a write whose settlement the gate made for another graph", async () => {
        const world = await buildGateWorld()
        const made = await reconcileOf(world)
        const graph = templateGraph("webbooks.invoice")
        const writes = workflowsOf(world)
            .filter((workflow) => workflow.id === made.id)
            .map((workflow) => ({
                workflow,
                graph,
                kind: "edit" as const,
                author: BOSS,
                note: "",
                template: null,
                fromNumber: null,
                graphVersionId: null,
                expected: null,
                rights: noRights(snapshotHashOf(ownerEdited(graph)), "agent-1", made.id),
            }))

        expect(writes).toHaveLength(1)
        await expect(codeOf(Promise.all(writes.map((write) => world.store.writeVersion(SCOPE, write))))).resolves.toBe(
            AgentGraphsErrorCode.WorkflowConflict,
        )
    })
})

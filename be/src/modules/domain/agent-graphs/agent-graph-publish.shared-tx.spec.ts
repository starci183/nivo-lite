import { Test } from "@nestjs/testing"
import { AGENT_GRAPHS, AGENT_GRAPH_VERSIONS, AGENT_WORKFLOW_VERSIONS, workflowVersionRecordOfRow } from "@tests/fixtures/builders/engine-core-tables.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { AccountAttachmentsService, NodeAccountConsentsService } from "@modules/domain/tool-grants"
import type { NodeAccountPolicyRecord, ProviderAttachmentView } from "@modules/domain/tool-grants"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { contextOf } from "@tests/fixtures/builders/agent-graph.builder"
import {
    APPEND_ENTRY,
    RIGHTS_ATTACHED,
    RIGHTS_FLOW,
    RIGHTS_SEND,
    SEND_ENTRY,
    rightsIndexOf,
} from "@tests/fixtures/builders/agent-rights.builder"
import { ownerEdited, storeDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import type { StoreDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphPublishService, type Publisher } from "./agent-graph-publish.service"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentGraphRightsService } from "./agent-graph-rights.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphDocument, GraphVersionView } from "./agent-graphs.contracts"
import { AgentRightsRecordsService } from "./agent-rights-records.service"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import type { AgreedRight } from "./policies/node-rights-gate.policy"

const OWNER: Publisher = { memberId: "boss", role: "owner" }
const FULL_LIST: ReadonlyArray<AgreedRight> = [SEND_ENTRY, APPEND_ENTRY]

/**
 * The rights flow with the send asked in `mode` on every account its tell step states. (The ledger append moves money: it is only ever
 * asked on `ask`, so the mode an owner narrows and loosens is the send's.)
 */
const sendIn = (graph: GraphSpec, mode: "auto" | "ask"): GraphSpec => ({
    ...graph,
    nodes: graph.nodes.map((node) =>
        node.key !== SEND_ENTRY.nodeKey || node.accounts === undefined
            ? node
            : {
                  ...node,
                  accounts: node.accounts.map((account) => ({
                      ...account,
                      operations: { ...account.operations, [RIGHTS_SEND]: mode },
                  })),
              },
    ),
})

const documentOf = (flow: GraphSpec): GraphDocument => ({ nodes: [], flow })

/**
 * The owner's document: the rights flow (an `@1` flow of spec-own steps; a template graph is no owner's to edit) with the owner's one
 * change, which asks the ledger append the ticks do not grant.
 */
const EDITED = documentOf(ownerEdited(RIGHTS_FLOW))

/** The publish roads that write the owner's rows with the version, each asked to publish `document` with what the owner agreed. */
type Road = (
    service: AgentGraphPublishService,
    document: GraphDocument,
    agreed: ReadonlyArray<AgreedRight>,
) => Promise<GraphVersionView>

const learned: Road = (service, document, agreed) => service.publishLearned("ws-1", "agent-1", document, OWNER, agreed)
const template: Road = (service, document, agreed) =>
    service.publishTemplate("ws-1", "agent-1", document, OWNER, agreed)

const rowKeyOf = (row: NodeAccountPolicyRecord): string =>
    JSON.stringify([row.workflowId, row.nodeKey, row.connectionId, row.operation])

/**
 * The grant store double, as the real store on the primary database: each transaction runs on a fresh manager, and a throw in it
 * puts its rows back AND rolls back what the engine wrote on that manager. An owner's row replaces mode and agreement but a row that
 * names no version never erases a stored one; any other row is only added; `stamp` names a version only where none is named.
 */
const consentsOf = (grants: Array<NodeAccountPolicyRecord>, memory: StoreDoubles["memory"]) => {
    const consents = mock<NodeAccountConsentsService>()
    consents.listOfWorkflow.mockImplementation((_workspaceId, agentId, workflowId) =>
        Promise.resolve(grants.filter((row) => row.agentId === agentId && row.workflowId === workflowId)),
    )
    consents.listOfWorkspace.mockImplementation(() => Promise.resolve([...grants]))
    consents.transaction.mockImplementation(async (work) => {
        const manager = mockEntityManager()
        const saved = grants.map((row) => ({ ...row }))
        try {
            const done = await work(manager)
            memory.commit(manager)
            return done
        } catch (cause) {
            grants.splice(0, grants.length, ...saved)
            memory.rollBack(manager)
            throw cause
        }
    })
    consents.record.mockImplementation((_manager, records) => {
        for (const record of records) {
            const at = grants.findIndex((row) => rowKeyOf(row) === rowKeyOf(record))
            const held = grants[at]
            if (held === undefined) grants.push({ ...record })
            else if (record.origin === "owner")
                grants[at] = { ...record, fromVersionId: record.fromVersionId ?? held.fromVersionId }
        }
        return Promise.resolve(records.length)
    })
    consents.stamp.mockImplementation((_manager, keys, versionId) => {
        let named = 0
        grants.forEach((row, at) => {
            if (row.fromVersionId !== null || !keys.some((key) => rowKeyOf(key as NodeAccountPolicyRecord) === rowKeyOf(row)))
                return
            grants[at] = { ...row, fromVersionId: versionId }
            named += 1
        })
        return Promise.resolve(named)
    })
    return consents
}

/**
 * The real publish road over the real graph and workflow stores on one transactional, manager-joining memory engine; the agent is
 * attached as `attached` says (by default its messaging account's send is ticked and its books account holds no tick).
 */
const buildWorld = async (attached: ReadonlyArray<ProviderAttachmentView> = RIGHTS_ATTACHED) => {
    const doubles = storeDoubles([
        AgentGraphPublishService,
        AgentGraphsService,
        AgentGraphRecordsService,
        AgentGraphRightsService,
        AgentRightsRecordsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
        AgentWorkflowsService,
    ])
    const memory = doubles.memory.managed()
    const grants: Array<NodeAccountPolicyRecord> = []
    const consents = consentsOf(grants, memory)
    const installed = rightsIndexOf()
    const installations = mock<InstallationRecordsService>({
        find: jest.fn().mockResolvedValue({ id: "inst-1", agentId: "agent-1", moduleKey: "accounting" }),
        findById: jest.fn().mockResolvedValue({ id: "inst-1", agentId: "agent-1", moduleKey: "accounting" }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ...doubles.providers,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: NodeAccountConsentsService, useValue: consents },
            {
                provide: AccountAttachmentsService,
                useValue: mock<AccountAttachmentsService>({
                    listOfAgent: jest.fn().mockResolvedValue(attached),
                    listOfWorkspace: jest.fn().mockResolvedValue(attached),
                }),
            },
            {
                provide: AgentGraphContextService,
                useValue: mock<AgentGraphContextService>({ contextOf: jest.fn().mockResolvedValue(contextOf()) }),
            },
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({ installed: jest.fn().mockReturnValue(installed) }),
            },
        ],
    }).compile()
    const graphs = moduleRef.get(AgentGraphsService)
    await graphs.ensure("ws-1", "agent-1", "inst-1", documentOf(RIGHTS_FLOW))
    const workflows = moduleRef.get(AgentWorkflowsService)
    const adoption = moduleRef.get(AgentWorkflowAdoptionService)
    const primaryId = await adoption.adoptAgentGraph("ws-1", "agent-1")
    consents.transaction.mockClear()
    consents.record.mockClear()
    consents.stamp.mockClear()
    doubles.logger.error.mockClear()
    return {
        ...doubles,
        memory,
        grants,
        consents,
        graphs,
        primaryId,
        workflows,
        adoption,
        records: moduleRef.get(AgentRightsRecordsService),
        service: moduleRef.get(AgentGraphPublishService),
    }
}

type World = Awaited<ReturnType<typeof buildWorld>>

/** The count of agent graph versions, the version that decides, and the count of workflow versions. */
const standingOf = async (world: World): Promise<readonly [number, string | null, number]> => [
    world.memory.rows(AGENT_GRAPH_VERSIONS).length,
    await world.graphs.activeVersionIdOf("ws-1", "agent-1"),
    world.memory.rows(AGENT_WORKFLOW_VERSIONS).length,
]

/** The workflow version that mirrors a graph version, or undefined while none does. */
const mirrorOf = (world: World, graphVersionId: string) =>
    world.memory
        .rows(AGENT_WORKFLOW_VERSIONS)
        .map(workflowVersionRecordOfRow)
        .find((entry) => entry.graphVersionId === graphVersionId)

// nivo-frame `rights`: the publish / install rights GATE is REMOVED: a publish settles nothing to agree and writes no grant row, so
// it is the graph store's one write; the primary workflow mirrors the version when it is next adopted (the agent's Workflows page,
// a route). The versions, their provenance and the roll-back of a failed write stay.
describe("AgentGraphPublishService: a publish on the real stores writes the version and no rights row", () => {
    it("the world: the agent has a primary workflow, one graph version and its mirror, and no row", async () => {
        const world = await buildWorld()

        expect(world.primaryId).not.toBeNull()
        expect(world.grants).toEqual([])
        expect(await standingOf(world)).toEqual([1, world.memory.rows(AGENT_GRAPH_VERSIONS)[0]?.id, 1])
    })

    it.each([
        ["publishLearned", learned],
        ["publishTemplate", template],
    ] as const)("%s: one more version that decides, mirrored on the primary workflow at its next adoption, with no row", async (_name, road) => {
        const world = await buildWorld()
        const [graphsBefore, , workflowsBefore] = await standingOf(world)

        const version = await road(world.service, EDITED, FULL_LIST)

        const [graphsAfter, activeId] = await standingOf(world)
        expect(graphsAfter).toBe(graphsBefore + 1)
        expect(activeId).toBe(version.id)
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")
        expect(mirrorOf(world, version.id)?.workflowId).toBe(world.primaryId)
        expect(world.memory.rows(AGENT_WORKFLOW_VERSIONS)).toHaveLength(workflowsBefore + 1)
        expect(world.grants).toEqual([])
        expect(world.consents.transaction).not.toHaveBeenCalled()
        expect(world.consents.record).not.toHaveBeenCalled()
        expect(world.consents.stamp).not.toHaveBeenCalled()
    })

    it("a publish that fails after the version was inserted rejects and leaves no version and no workflow version", async () => {
        const world = await buildWorld()
        const before = await standingOf(world)
        let armed = true
        world.memory.failWhen((mutation) => {
            const fails = armed && mutation.op === "update" && mutation.entity === AGENT_GRAPHS
            if (fails) armed = false
            return fails
        })

        await expect(learned(world.service, EDITED, FULL_LIST)).rejects.toThrow("memory engine: update failed")

        expect(armed).toBe(false)
        expect(await standingOf(world)).toEqual(before)
        expect(world.grants).toEqual([])
    })

    it("each later publish (a step narrowed to ask, then back to auto) is one more version, none of them refused", async () => {
        const world = await buildWorld()
        const first = await learned(world.service, EDITED, [])
        const narrowed = await learned(world.service, documentOf(sendIn(ownerEdited(RIGHTS_FLOW), "ask")), [])
        const back = await learned(world.service, documentOf(sendIn(ownerEdited(RIGHTS_FLOW), "auto")), [])

        expect([narrowed.version, back.version]).toEqual([first.version + 1, first.version + 2])
        expect(await world.graphs.activeVersionIdOf("ws-1", "agent-1")).toBe(back.id)
        expect(world.grants).toEqual([])
    })
})

describe("AgentGraphPublishService: the agent's Workflows page", () => {
    it("the page's list records the published version on the primary workflow", async () => {
        const world = await buildWorld()

        const version = await learned(world.service, EDITED, FULL_LIST)
        expect(await world.graphs.activeVersionIdOf("ws-1", "agent-1")).toBe(version.id)

        // What the workflows tab calls (the agentWorkflows query, AgentWorkflowsAdminService, then this list).
        await world.workflows.list("ws-1", "agent-1", "vi")

        expect(mirrorOf(world, version.id)?.workflowId).toBe(world.primaryId)
        expect(world.grants).toEqual([])
    })
})

import type { Provider } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager, type MockOf } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { defineNode, nodeIndexOf, type NodeDefinition, type NodeIndex } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { PROBE_NOTHING } from "@modules/domain/graph-nodes"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { EntityEngineService, type ScopedTx } from "@modules/domain/entity-engine"
import {
    AccountAttachmentsService,
    NodeAccountConsentsService,
    type NodeAccountPolicyRecord,
    type ProviderAttachmentView,
} from "@modules/domain/tool-grants"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { AgentGraphRightsService, AgentGraphsError, AgentRightsStandingService } from "@modules/domain/agent-graphs"
import { AgentRightsNoticesService } from "../../../modules/domain/agent-graphs/agent-rights-notices.service"
import { AgentRightsRecordsService } from "../../../modules/domain/agent-graphs/agent-rights-records.service"
import { AgentWorkflowRecordsService } from "../../../modules/domain/agent-graphs/agent-workflow-records.service"
import type { WorkflowRecord } from "../../../modules/domain/agent-graphs/agent-workflows.contracts"
import { templateGraph } from "./agent-workflows.builder"

/** The send to a customer and the ledger append: the two operations the rights flow asks for. */
export const RIGHTS_SEND: typeof TOOL.customerMessageSend = TOOL.customerMessageSend
export const RIGHTS_APPEND: typeof TOOL.ledgerEntryAppend = TOOL.ledgerEntryAppend

/**
 * A flow from before node rights: none of its nodes states an account. Every installed template graph now carries its nodes' accounts
 * (the adapter's `accountsOfStep`), so the sales team-chat flow is taken with them off: a version stored before node rights, as the store keeps it.
 */
export const FLOW_BEFORE_NODE_RIGHTS: ReturnType<typeof templateGraph> = ((graph) => ({
    ...graph,
    nodes: graph.nodes.map(({ accounts: _accounts, ...node }) => node),
}))(templateGraph("sales.team-chat"))

/** The step of the rights flow that tells the customer: it calls the send. */
export const RIGHTS_TELL_STEP: NodeDefinition = defineNode({
    id: "rights.tell",
    role: "execute",
    title: { key: "rights.tell" },
    params: PROBE_NOTHING,
    input: PROBE_NOTHING,
    output: PROBE_NOTHING,
    effects: [],
    tools: [RIGHTS_SEND],
    run: () => Promise.resolve({}),
    examples: [{ name: "tells", params: {}, input: {}, output: {}, effects: [], tools: [{}] }],
})

/** The step of the rights flow that books the payment: it calls the ledger append. */
export const RIGHTS_BOOK_STEP: NodeDefinition = defineNode({
    id: "rights.book",
    role: "execute",
    title: { key: "rights.book" },
    params: PROBE_NOTHING,
    input: PROBE_NOTHING,
    output: PROBE_NOTHING,
    effects: [],
    tools: [RIGHTS_APPEND],
    run: () => Promise.resolve({}),
    examples: [{ name: "books", params: {}, input: {}, output: {}, effects: [], tools: [{}] }],
})

/** The two spec-own steps of the rights flow. */
export const RIGHTS_STEPS: ReadonlyArray<NodeDefinition> = [RIGHTS_TELL_STEP, RIGHTS_BOOK_STEP]

/** The installed nodes a host of the rights flow holds: the core control nodes, effects and tools, and the two rights steps. */
export const rightsIndexOf = (): NodeIndex =>
    nodeIndexOf({
        ...INSTALLED.nodeInstall(),
        nodes: [...INSTALLED.nodeInstall().nodes, ...RIGHTS_STEPS],
    })

/**
 * A flow the OWNER may edit (an `@1` flow of spec-own `defineNode` steps; a template graph is edited only in its package, so the gate's
 * own rule, "a version that asks more needs the owner's yes", is proved on this one): its `tell` step asks for the send on any messaging
 * account, its `book` step for the ledger append on any books account. The append moves money, so it is asked on `ask` (the money
 * ruling: an ask-only operation is never asked on `auto`).
 */
export const RIGHTS_FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [RIGHTS_SEND, RIGHTS_APPEND], effects: [] },
    nodes: [
        {
            key: "tell",
            kind: "execute",
            step: RIGHTS_TELL_STEP.id,
            params: {},
            next: "book",
            accounts: [{ kind: "messaging", provider: null, connectionId: null, operations: { [RIGHTS_SEND]: "auto" } }],
        },
        {
            key: "book",
            kind: "execute",
            step: RIGHTS_BOOK_STEP.id,
            params: {},
            accounts: [{ kind: "books", provider: null, connectionId: null, operations: { [RIGHTS_APPEND]: "ask" } }],
        },
    ],
}

/** The agent attached to a messaging account whose send is ticked and a books account with no tick. */
export const RIGHTS_ATTACHED: ReadonlyArray<ProviderAttachmentView> = [
    { agentId: "agent-1", connectionId: "c-zalo", provider: "zalo_oa" },
    { agentId: "agent-1", connectionId: "c-books", provider: "google" },
]

/** The primary workflow of agent-1, running version wfv-1. */
export const rightsWorkflowOf: (changes?: Partial<WorkflowRecord>) => WorkflowRecord = builder<WorkflowRecord>({
    id: "wf-p",
    workspaceId: "ws-1",
    fence: "1",
    agentId: "agent-1",
    key: "reconcile",
    name: "Reconcile",
    status: "active",
    primary: true,
    position: 0,
    latestNumber: 1,
    activeVersionId: "wfv-1",
    template: null,
    createdBy: null,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
})

/** One entry the rights flow asks for: a node may call an operation on a connected account, in a mode. */
export interface RightsEntry {
    readonly nodeKey: string
    readonly connectionId: string
    readonly operation: string
    readonly mode: "auto" | "ask"
}

/** The two entries `RIGHTS_FLOW` asks for on the accounts of `RIGHTS_ATTACHED`: the send automatically, the append on ask. */
export const SEND_ENTRY: RightsEntry = { nodeKey: "tell", connectionId: "c-zalo", operation: RIGHTS_SEND, mode: "auto" }
export const APPEND_ENTRY: RightsEntry = { nodeKey: "book", connectionId: "c-books", operation: RIGHTS_APPEND, mode: "ask" }

/** The doubles of the rights gate and the providers that wire them in. */
export interface RightsDoubles {
    readonly providers: Array<Provider>
    readonly tx: MockOf<ScopedTx>
    readonly engine: MockOf<EntityEngineService>
    readonly workflows: MockOf<AgentWorkflowRecordsService>
    readonly access: MockOf<AccountAttachmentsService>
    readonly consents: MockOf<NodeAccountConsentsService>
    readonly manager: ReturnType<typeof mockEntityManager>
    readonly written: Array<NodeAccountPolicyRecord>
    readonly bindings: MockOf<ConnectionBindingsReadService>
    readonly logger: MockOf<Logger>
    readonly notices: MockOf<AgentRightsNoticesService>
}

/** `RightsDoubles` compiled: the three services beside their doubles. */
export interface RightsWorld extends RightsDoubles {
    readonly rights: AgentGraphRightsService
    readonly records: AgentRightsRecordsService
    readonly standing: AgentRightsStandingService
}

/**
 * The rights gate, the recorder of its rows and the standing read, on doubles of the engine, the workflow records, the
 * attachments and the grant store (what it was handed is kept in `written`).
 */
export const rightsDoubles = (attached: ReadonlyArray<ProviderAttachmentView> = RIGHTS_ATTACHED): RightsDoubles => {
    const tx = mock<ScopedTx>({ workspaceId: "ws-1" })
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_workspaceId, work) => work(tx))
    engine.within.mockImplementation((_manager, _workspaceId, work) => work(tx))
    const workflows = mock<AgentWorkflowRecordsService>()
    workflows.workflowsOf.mockResolvedValue([rightsWorkflowOf()])
    // The store's contract: an unknown workflow or version is null, never undefined.
    workflows.workflow.mockResolvedValue(null)
    workflows.version.mockResolvedValue(null)
    workflows.versionsOf.mockResolvedValue([])
    const access = mock<AccountAttachmentsService>()
    access.listOfAgent.mockResolvedValue(attached)
    access.listOfWorkspace.mockResolvedValue(attached)
    const manager = mockEntityManager()
    const written: Array<NodeAccountPolicyRecord> = []
    const consents = mock<NodeAccountConsentsService>()
    consents.listOfWorkflow.mockResolvedValue([])
    consents.listOfWorkspace.mockResolvedValue([])
    consents.transaction.mockImplementation((work) => work(manager))
    consents.record.mockImplementation((_manager, records) => {
        written.push(...records)
        return Promise.resolve(records.length)
    })
    // Set once, as the store's statement is: a written row whose key matches and that names no version takes the version.
    consents.stamp.mockImplementation((_manager, rows, versionId) => {
        const changed = written.flatMap((record, at) => {
            const named = rows.some(
                (row) =>
                    row.workspaceId === record.workspaceId &&
                    row.agentId === record.agentId &&
                    row.workflowId === record.workflowId &&
                    row.nodeKey === record.nodeKey &&
                    row.connectionId === record.connectionId &&
                    row.operation === record.operation,
            )
            return named && record.fromVersionId === null ? [at] : []
        })
        changed.forEach((at) => {
            const record = written[at]
            if (record !== undefined) written[at] = { ...record, fromVersionId: versionId }
        })
        return Promise.resolve(changed.length)
    })
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.recordOf.mockResolvedValue(null)
    const logger = mock<Logger>()
    const notices = mock<AgentRightsNoticesService>()
    const providers = [
        AgentGraphRightsService,
        AgentRightsRecordsService,
        AgentRightsStandingService,
        { provide: EntityEngineService, useValue: engine },
        { provide: AgentWorkflowRecordsService, useValue: workflows },
        { provide: AccountAttachmentsService, useValue: access },
        { provide: NodeAccountConsentsService, useValue: consents },
        { provide: ConnectionBindingsReadService, useValue: bindings },
        { provide: LOGGER, useValue: logger },
        { provide: AgentRightsNoticesService, useValue: notices },
    ]
    return { providers, tx, engine, workflows, access, consents, manager, written, bindings, logger, notices }
}

/** `rightsDoubles` compiled: the three services beside their doubles. */
export const rightsWorldOf = async (attached?: ReadonlyArray<ProviderAttachmentView>): Promise<RightsWorld> => {
    const doubles = rightsDoubles(attached)
    const moduleRef = await Test.createTestingModule({ providers: doubles.providers }).compile()
    return {
        ...doubles,
        rights: moduleRef.get(AgentGraphRightsService),
        records: moduleRef.get(AgentRightsRecordsService),
        standing: moduleRef.get(AgentRightsStandingService),
    }
}

/** The code of the refusal a work ended with; null when it passed; the failure itself when it is no refusal of the graphs. */
export const rightsCodeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof AgentGraphsError ? cause.code : cause
    }
}

/** The params of the refusal a work ended with; null when it passed; the failure itself when it is no refusal of the graphs. */
export const rightsParamsOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof AgentGraphsError ? cause.params : cause
    }
}

import { mock } from "@starci/jest-preset"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"

/** The scope every spec of the graph store runs in. */
export const SCOPE: ScopedTx = mock<ScopedTx>({ workspaceId: "ws-1" })

/** Makes the scoped and nested scopes of an engine double run the work in `SCOPE`. */
export const wireScope = (engine: ReturnType<typeof mock<EntityEngineService>>): void => {
    engine.scoped.mockImplementation((_workspaceId, work) => work(SCOPE))
    engine.within.mockImplementation((_manager, _workspaceId, work) => work(SCOPE))
}

const STAMP = "2026-11-01T01:00:00.000Z"

const rowOf = (id: string, data: RecordRow["data"]): RecordRow => ({
    id,
    workspaceId: "ws-1",
    version: "4",
    createdAt: STAMP,
    updatedAt: STAMP,
    data,
})

/** The engine's row of a graph. */
export const graphEngineRow = (data: RecordRow["data"] = {}): RecordRow =>
    rowOf("graph-1", {
        agentId: "agent-1",
        installationId: "inst-1",
        draft: { nodes: [] },
        draftRev: 3,
        activeVersionId: "version-1",
        mode: "enforced",
        modeSetBy: null,
        modeSetAt: null,
        ...data,
    })

/** The engine's row of a version. */
export const versionEngineRow = (data: RecordRow["data"] = {}): RecordRow =>
    rowOf("version-1", {
        agentId: "agent-1",
        number: 2,
        document: { nodes: [] },
        documentHash: "hash",
        contextVersionId: null,
        changeKind: "edit",
        note: "",
        publishedBy: "member-1",
        publishedAt: STAMP,
        ...data,
    })

/** The engine's row of a source. */
export const sourceEngineRow = (data: RecordRow["data"] = {}): RecordRow =>
    rowOf("source-1", {
        versionId: "version-1",
        agentId: "agent-1",
        nodeKey: "decide",
        branchKey: "",
        kind: "brain",
        ref: "fact-1",
        valueHash: "hash",
        ...data,
    })

/** The engine's row of a proposal. */
export const proposalEngineRow = (data: RecordRow["data"] = {}): RecordRow =>
    rowOf("p1", {
        agentId: "agent-1",
        kind: "learned",
        status: "open",
        baseVersionId: null,
        nodeKey: "decide",
        branchKey: "middle",
        patch: { signal: "trust", amounts: [1] },
        widens: false,
        evidence: { ids: ["d0"] },
        ...data,
    })

/** The engine's row of a decision. */
export const decisionEngineRow = (data: RecordRow["data"] = {}): RecordRow =>
    rowOf("decision-1", {
        agentId: "agent-1",
        workItemId: "item-9",
        road: "work",
        mode: "enforced",
        gateVerdict: "ask",
        unread: { keys: [] },
        unjudged: null,
        subjectType: null,
        subjectId: null,
        versionId: "version-1",
        wakeId: null,
        action: "pay_supplier",
        path: { keys: ["decide", "middle"] },
        facts: { "supplier_payment.amount_vnd": 7_200_000 },
        branchKey: "middle",
        outcome: "ask",
        approvalRequestId: "request-1",
        closedAs: null,
        shadowDiff: false,
        ...data,
    })

/** A page of the engine's list answer. */
export const pageOf = (rows: ReadonlyArray<RecordRow>, next: string | null = null): ListPage => ({
    rows: rows.map((row) => ({ row, joined: {}, position: [], included: {} })),
    next,
})

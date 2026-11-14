import { mock } from "@starci/jest-preset"
import { EntityEngineService, type ScopedTx } from "@modules/domain/entity-engine"
import type { ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"

/** The scope every spec of the graph store runs in. */
export const SCOPE: ScopedTx = mock<ScopedTx>({ workspaceId: "ws-1" })

/** Makes the scoped and nested scopes of an engine double run the work in `SCOPE`. */
export const wireScope = (engine: ReturnType<typeof mock<EntityEngineService>>): void => {
    engine.scoped.mockImplementation((_workspaceId, work) => work(SCOPE))
    engine.within.mockImplementation((_manager, _workspaceId, work) => work(SCOPE))
}

const STAMP = "2026-11-01T01:00:00.000Z"

/** A stored row of one of the graph tables: its members at the top, as a TypeORM entity holds them; `over` may set any value. */
const rowOf = (id: string, members: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => ({
    id,
    workspaceId: "ws-1",
    version: 4,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...members,
})

/** The stored row of a graph (public.agent_graphs). */
export const graphRow = (over: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> =>
    rowOf("graph-1", {
        agentId: "agent-1",
        installationId: "inst-1",
        draft: { nodes: [] },
        draftRev: 3,
        activeVersionId: "version-1",
        mode: "enforced",
        modeSetBy: null,
        modeSetAt: null,
        ...over,
    })

/** The stored row of a version (public.agent_graph_versions). */
export const versionRow = (over: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> =>
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
        ...over,
    })

/** The stored row of a source (public.agent_graph_sources). */
export const sourceRow = (over: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> =>
    rowOf("source-1", {
        versionId: "version-1",
        agentId: "agent-1",
        nodeKey: "decide",
        branchKey: "",
        kind: "brain",
        ref: "fact-1",
        valueHash: "hash",
        ...over,
    })

/** The stored row of a proposal (public.agent_graph_proposals). */
export const proposalRow = (over: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> =>
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
        ...over,
    })

/** A page of the engine's list answer. */
export const pageOf = (rows: ReadonlyArray<RecordRow>, next: string | null = null): ListPage => ({
    rows: rows.map((row) => ({ row, joined: {}, position: [], included: {} })),
    next,
})

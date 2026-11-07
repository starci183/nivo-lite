import { Injectable } from "@nestjs/common"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { EngineResult, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { FilterExpr, OrderBy, Query } from "@nivo-lite/agent-sdk/query"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import {
    decisionRecordOf,
    graphRecordOf,
    proposalRecordOf,
    sourceRecordOf,
    versionRecordOf,
} from "./agent-graphs.mapper"
import type {
    GraphDecisionRecord,
    EnsuredGraph,
    GraphRecord,
    ProposalRecord,
    GraphSourceRecord,
    VersionRecord,
} from "./agent-graphs-records.contracts"

const GRAPH = "agent.graph"
const VERSION = "agent.graph-version"
const SOURCE = "agent.graph-source"
const PROPOSAL = "agent.graph-proposal"
const DECISION = "agent.graph-decision"

/** Binds the cursor of every list of this capability. */
const LIST_SCOPE = "agent-graphs"

/** The most rows one engine page holds. */
const PAGE_SIZE = 100

const GRAPH_SELECT: ReadonlyArray<string> = [
    "agentId",
    "installationId",
    "draft",
    "draftRev",
    "activeVersionId",
    "mode",
    "modeSetBy",
    "modeSetAt",
]

const VERSION_SELECT: ReadonlyArray<string> = [
    "agentId",
    "number",
    "document",
    "documentHash",
    "contextVersionId",
    "changeKind",
    "note",
    "publishedBy",
    "publishedAt",
]

const SOURCE_SELECT: ReadonlyArray<string> = [
    "versionId",
    "agentId",
    "nodeKey",
    "branchKey",
    "kind",
    "ref",
    "valueHash",
]

const PROPOSAL_SELECT: ReadonlyArray<string> = [
    "agentId",
    "kind",
    "status",
    "baseVersionId",
    "nodeKey",
    "branchKey",
    "patch",
    "widens",
    "evidence",
]

const DECISION_SELECT: ReadonlyArray<string> = [
    "agentId",
    "workItemId",
    "road",
    "mode",
    "gateVerdict",
    "unread",
    "unjudged",
    "subjectType",
    "subjectId",
    "versionId",
    "wakeId",
    "action",
    "path",
    "facts",
    "branchKey",
    "outcome",
    "approvalRequestId",
    "closedAs",
    "shadowDiff",
]

/** What a write answers when its record exists: the record after, or null when its version had moved on. */
type Written<T> = T | null

/** What a list reads: the condition, the order and the most rows. */
interface Listing {
    readonly entity: string
    readonly select: ReadonlyArray<string>
    readonly where?: FilterExpr | undefined
    readonly order: OrderBy
    readonly size: number
}

/** The cursor member a page names after the first one. */
interface PageAfter {
    readonly after?: string
}

/** The rows read so far and the cursor of the page after them. */
interface Taken {
    readonly rows: ReadonlyArray<RecordRow>
    readonly after?: string | undefined
}

const pagedAfter = (after: string | undefined): PageAfter => (after === undefined ? {} : { after })

const eq = (field: string, value: string | boolean): FilterExpr => ({ op: "eq", field, value })

const allOf = (...of: ReadonlyArray<FilterExpr>): FilterExpr => ({ op: "and", of })

const unreadable = (): AgentGraphsError => new AgentGraphsError({ code: AgentGraphsErrorCode.RecordUnreadable })

@Injectable()
/**
 * The one place that names the graph entities: reads through indexed queries of the entity engine, writes as engine mutations, a patch
 * under the version (fence) the caller read. Every method runs in the scope of the `ScopedTx` it is given and never opens a transaction.
 */
export class AgentGraphRecordsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
    ) {}

    /** The graph of an agent, or null. */
    async graphOf(tx: ScopedTx, agentId: string): Promise<GraphRecord | null> {
        const rows = await this.rows(tx, GRAPH, GRAPH_SELECT, eq("agentId", agentId), [["id", "asc"]], 1)
        return rows.map(graphRecordOf).at(0) ?? null
    }

    /** The graph of an installation, or null. */
    async graphOfInstallation(tx: ScopedTx, installationId: string): Promise<GraphRecord | null> {
        const rows = await this.rows(tx, GRAPH, GRAPH_SELECT, eq("installationId", installationId), [["id", "asc"]], 1)
        return rows.map(graphRecordOf).at(0) ?? null
    }

    /** The ids among these agents that hold a graph. */
    async agentsWithGraph(tx: ScopedTx, agentIds: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const rows = await this.rows(
            tx,
            GRAPH,
            GRAPH_SELECT,
            { op: "in", field: "agentId", values: [...agentIds] },
            [
                ["agentId", "asc"],
                ["id", "asc"],
            ],
            agentIds.length,
        )
        return rows.map(graphRecordOf).map((graph) => graph.agentId)
    }

    /** The graphs of the workspace, in the order of their agents, at most `limit`. */
    async graphsOfWorkspace(tx: ScopedTx, limit: number): Promise<ReadonlyArray<GraphRecord>> {
        const rows = await this.rows(
            tx,
            GRAPH,
            GRAPH_SELECT,
            undefined,
            [
                ["agentId", "asc"],
                ["id", "asc"],
            ],
            limit,
        )
        return rows.map(graphRecordOf)
    }

    /** A graph, found or made under the match key of its agent. */
    async ensureGraph(tx: ScopedTx, values: MutationValues): Promise<EnsuredGraph> {
        const result = await this.mutations.mutate(tx, { op: "ensure", entity: GRAPH, match: "agent", values }, "job")
        if (!result.ok) throw unreadable()
        return { graph: graphRecordOf(result.row), created: result.created === true }
    }

    /** Writes the graph's fields under the version the caller read: the graph after, or null when its version had moved on. */
    async patchGraph(tx: ScopedTx, graph: GraphRecord, values: MutationValues): Promise<Written<GraphRecord>> {
        const result = await this.mutations.mutate(
            tx,
            { op: "update", entity: GRAPH, key: graph.id, expected: graph.fence, values },
            "job",
        )
        return this.writtenOf(result, graphRecordOf)
    }

    /** One version, or null. */
    async version(tx: ScopedTx, versionId: string): Promise<VersionRecord | null> {
        const row = await this.engine.get(tx, VERSION, versionId)
        return row === null ? null : versionRecordOf(row)
    }

    /** The newest version of the agent, or null. */
    async latestVersion(tx: ScopedTx, agentId: string): Promise<VersionRecord | null> {
        const versions = await this.versionsOf(tx, agentId, 1)
        return versions.at(0) ?? null
    }

    /** The versions of the agent, newest first, at most `limit`. */
    async versionsOf(tx: ScopedTx, agentId: string, limit: number): Promise<ReadonlyArray<VersionRecord>> {
        const rows = await this.rows(
            tx,
            VERSION,
            VERSION_SELECT,
            eq("agentId", agentId),
            [
                ["number", "desc"],
                ["id", "desc"],
            ],
            limit,
        )
        return rows.map(versionRecordOf)
    }

    /** Inserts a version; null when its number is already the agent's. */
    async insertVersion(tx: ScopedTx, values: MutationValues): Promise<VersionRecord | null> {
        const result = await this.mutations.mutate(tx, { op: "insert", entity: VERSION, values }, "job")
        return this.writtenOf(result, versionRecordOf)
    }

    /** Indexes one source of a version. */
    async insertSource(tx: ScopedTx, values: MutationValues): Promise<void> {
        const result = await this.mutations.mutate(tx, { op: "insert", entity: SOURCE, values }, "job")
        if (!result.ok) throw unreadable()
    }

    /** At most `limit` sources of one kind among these versions. */
    async sourcesOf(
        tx: ScopedTx,
        kind: string,
        versionIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<ReadonlyArray<GraphSourceRecord>> {
        const rows = await this.rows(
            tx,
            SOURCE,
            SOURCE_SELECT,
            allOf(eq("kind", kind), { op: "in", field: "versionId", values: [...versionIds] }),
            [
                ["versionId", "asc"],
                ["id", "asc"],
            ],
            limit,
        )
        return rows.map(sourceRecordOf)
    }

    /** One proposal, or null. */
    async proposal(tx: ScopedTx, proposalId: string): Promise<ProposalRecord | null> {
        const row = await this.engine.get(tx, PROPOSAL, proposalId)
        return row === null ? null : proposalRecordOf(row)
    }

    /** The open proposals of the agent, newest first, at most `limit`. */
    async openProposalsOf(tx: ScopedTx, agentId: string, limit: number): Promise<ReadonlyArray<ProposalRecord>> {
        const rows = await this.rows(
            tx,
            PROPOSAL,
            PROPOSAL_SELECT,
            allOf(eq("agentId", agentId), eq("status", "open")),
            [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
            limit,
        )
        return rows.map(proposalRecordOf)
    }

    /** The proposals of one kind that the agent raised and that are open, confirmed or declined, at most `limit`. */
    async spentProposalsOf(
        tx: ScopedTx,
        agentId: string,
        kind: string,
        limit: number,
    ): Promise<ReadonlyArray<ProposalRecord>> {
        const rows = await this.rows(
            tx,
            PROPOSAL,
            PROPOSAL_SELECT,
            allOf(eq("agentId", agentId), eq("kind", kind), {
                op: "in",
                field: "status",
                values: ["open", "confirmed", "declined"],
            }),
            [
                ["status", "asc"],
                ["id", "asc"],
            ],
            limit,
        )
        return rows.map(proposalRecordOf)
    }

    /** Raises a proposal once per cause: true when this call wrote it. */
    async raiseProposal(tx: ScopedTx, values: MutationValues): Promise<boolean> {
        const result = await this.mutations.mutate(
            tx,
            { op: "ensure", entity: PROPOSAL, match: "agent_dedupe", values },
            "job",
        )
        if (!result.ok) throw unreadable()
        return result.created === true
    }

    /** Writes the proposal's fields under the version the caller read: the proposal after, or null when its version had moved on. */
    async patchProposal(
        tx: ScopedTx,
        proposal: ProposalRecord,
        values: MutationValues,
    ): Promise<Written<ProposalRecord>> {
        const result = await this.mutations.mutate(
            tx,
            { op: "update", entity: PROPOSAL, key: proposal.id, expected: proposal.fence, values },
            "job",
        )
        return this.writtenOf(result, proposalRecordOf)
    }

    /** One decision, or null. */
    async decision(tx: ScopedTx, decisionId: string): Promise<GraphDecisionRecord | null> {
        const row = await this.engine.get(tx, DECISION, decisionId)
        return row === null ? null : decisionRecordOf(row)
    }

    /** The decision of a work item, or null. */
    async decisionOfItem(tx: ScopedTx, workItemId: string): Promise<GraphDecisionRecord | null> {
        const rows = await this.rows(tx, DECISION, DECISION_SELECT, eq("workItemId", workItemId), [["id", "asc"]], 1)
        return rows.map(decisionRecordOf).at(0) ?? null
    }

    /** The decision whose open request is this one, or null. */
    async decisionOfRequest(tx: ScopedTx, requestId: string): Promise<GraphDecisionRecord | null> {
        const rows = await this.rows(
            tx,
            DECISION,
            DECISION_SELECT,
            eq("approvalRequestId", requestId),
            [["id", "asc"]],
            1,
        )
        return rows.map(decisionRecordOf).at(0) ?? null
    }

    /** The latest decisions of an agent, newest first, at most `limit`. */
    async decisionsOf(tx: ScopedTx, agentId: string, limit: number): Promise<ReadonlyArray<GraphDecisionRecord>> {
        const rows = await this.rows(
            tx,
            DECISION,
            DECISION_SELECT,
            eq("agentId", agentId),
            [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
            limit,
        )
        return rows.map(decisionRecordOf)
    }

    /** At most `limit` decisions that ended after this moment, newest change first. */
    async decisionsClosedSince(tx: ScopedTx, since: Date, limit: number): Promise<ReadonlyArray<GraphDecisionRecord>> {
        const rows = await this.rows(
            tx,
            DECISION,
            DECISION_SELECT,
            allOf({ op: "notNull", field: "closedAs" }, { op: "gt", field: "updatedAt", value: since.toISOString() }),
            [
                ["updatedAt", "desc"],
                ["id", "desc"],
            ],
            limit,
        )
        return rows.map(decisionRecordOf)
    }

    /** Records a decision once under the match key it names (its work item or its dedupe key): the record that stands. */
    async recordDecision(
        tx: ScopedTx,
        match: "work_item" | "dedupe",
        values: MutationValues,
    ): Promise<GraphDecisionRecord> {
        const result = await this.mutations.mutate(tx, { op: "ensure", entity: DECISION, match, values }, "job")
        if (!result.ok) throw unreadable()
        return decisionRecordOf(result.row)
    }

    /** Writes the decision's fields under the version the caller read: the decision after, or null when its version had moved on. */
    async patchDecision(
        tx: ScopedTx,
        decision: GraphDecisionRecord,
        values: MutationValues,
    ): Promise<Written<GraphDecisionRecord>> {
        const result = await this.mutations.mutate(
            tx,
            { op: "update", entity: DECISION, key: decision.id, expected: decision.fence, values },
            "job",
        )
        return this.writtenOf(result, decisionRecordOf)
    }

    private rows(
        tx: ScopedTx,
        entity: string,
        select: ReadonlyArray<string>,
        where: FilterExpr | undefined,
        order: OrderBy,
        size: number,
    ): Promise<ReadonlyArray<RecordRow>> {
        return this.paged(tx, { entity, select, where, order, size }, { rows: [] })
    }

    private async paged(tx: ScopedTx, listing: Listing, taken: Taken): Promise<ReadonlyArray<RecordRow>> {
        const query: Query = {
            from: listing.entity,
            select: listing.select,
            order: listing.order,
            page: { size: Math.min(PAGE_SIZE, listing.size - taken.rows.length), ...pagedAfter(taken.after) },
            ...(listing.where === undefined ? {} : { where: listing.where }),
        }
        const page = await this.engine.list(tx, query, LIST_SCOPE)
        const rows = [...taken.rows, ...page.rows.map((row) => row.row)]
        return page.next === null || rows.length >= listing.size
            ? rows
            : this.paged(tx, listing, { rows, after: page.next })
    }

    private writtenOf<T>(result: EngineResult, read: (row: RecordRow) => T): T | null {
        if (result.ok) return read(result.row)
        if (result.reason === "stale" || result.reason === "taken") return null
        throw unreadable()
    }
}

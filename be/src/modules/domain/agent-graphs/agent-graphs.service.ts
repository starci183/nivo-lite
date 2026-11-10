import { createHash } from "node:crypto"
import { Injectable, Optional } from "@nestjs/common"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import type { WorkflowVersionDocument } from "./agent-workflows.contracts"
import { chunksOf, jsonOf } from "./agent-graphs.mapper"
import type { GraphRecord, VersionRecord } from "./agent-graphs-records.contracts"
import { graphDocumentSchema } from "./agent-graphs.schema"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type {
    BranchApprover,
    GraphChangeKind,
    GraphDocument,
    GraphMode,
    GraphVersionView,
} from "./agent-graphs.contracts"
import type { DecisionView } from "./agent-graph-decisions.service"
import { branchApproverOf } from "./policies/branch-approver.policy"
import { withoutStrayStops } from "./policies/stray-stops.policy"
import { sourcesIndexOf } from "./policies/sources-index.policy"
import { EMPTY_GRANT, ownRunGrantOf, workflowRunGrantOf } from "./policies/workflow-grant.policy"
import { agentToolsOf } from "./policies/flow.policy"
import type { RunGrant } from "./policies/workflow-grant.policy"

/** The most versions one listing answers. */
const VERSION_LIMIT = 100

/** The most agents one lookup of "which hold a graph" asks the engine about. */
const AGENT_CHUNK = 100

/** The most graphs of one workspace the Brain comparison reads. */
const GRAPH_LIMIT = 100

/** One graph with the version that decides, read and validated. */
export interface GraphState {
    /** The workspace id. */
    readonly workspaceId: string
    /** The agent id. */
    readonly agentId: string
    /** The installation id. */
    readonly installationId: string
    /** The mode. */
    readonly mode: GraphMode
    /** The draft. */
    readonly draft: GraphDocument
    /** The draft rev. */
    readonly draftRev: number
    /** The active version id. */
    readonly activeVersionId: string | null
    /** The graph that decides; null before the first version. */
    readonly active: GraphDocument | null
    /** How the version that decides came to be; null before the first. A `seed` is one no person published. */
    readonly activeKind: GraphChangeKind | null
}

/** A Brain rule behind the version that decides. */
export interface BrainSourceInForce {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The version that cites it. */
    readonly versionId: string
    /** The node that cites it. */
    readonly nodeKey: string
    /** The branch that cites it, or an empty text for the node itself. */
    readonly branchKey: string
    /** The Brain fact. */
    readonly factId: string
    /** The hash of its value when the owner confirmed it. */
    readonly valueHash: string
}

/** A version with its number. */
export interface VersionAt {
    /** The number of the version within the agent. */
    readonly version: number
    /** The graph it froze. */
    readonly document: GraphDocument
}

/** What publishing a version takes. */
export interface PublishInput {
    /** The workspace id. */
    readonly workspaceId: string
    /** The agent id. */
    readonly agentId: string
    /** The document. */
    readonly document: GraphDocument
    /** The kind. */
    readonly kind: GraphChangeKind
    /** The note. */
    readonly note: string
    /** The member id. */
    readonly memberId: string | null
    /** The context version id. */
    readonly contextVersionId: string | null
    /** The number the version takes (the setup gives it the number of its context version); the next one when absent. It must be above the newest. */
    readonly version?: number | undefined
}

/** A graph, or null when the agent has none or it cannot be read. */
export type OptionalGraphState = GraphState | null

/** The approver of a branch, or null when the version names none. */
export type OptionalBranchApprover = BranchApprover | null

/** The hash of a graph; the same graph always has the same hash. */
const hashOf = (document: GraphDocument): string => createHash("sha256").update(JSON.stringify(document)).digest("hex")

const viewOf = (row: VersionRecord): GraphVersionView => ({
    id: row.id,
    version: row.number,
    changeKind: row.changeKind,
    note: row.note,
    publishedAt: row.publishedAt.toISOString(),
    publishedBy: row.publishedBy,
})

/** The id of a published graph version, or null when there is none. */
type OptionalVersionId = string | null

const conflict = (): AgentGraphsError => new AgentGraphsError({ code: AgentGraphsErrorCode.DraftConflict })

@Injectable()
/**
 * The store of the action graph, on the entity engine: the draft of each agent under a revision check (and the record version as the
 * fence of every write), the immutable versions the owner publishes (written once, never updated), the index of their sources, and the
 * mode that says whether a graph decides or only records. Every graph read back is validated, and one that does not parse is no graph.
 * Each method names the workspace: the engine scopes a transaction to one.
 */
export class AgentGraphsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly records: AgentGraphRecordsService,
        @InjectClock() private readonly clock: Clock,
        @Optional() private readonly workflows?: AgentWorkflowRecordsService,
    ) {}

    /** The graph of the installation, or null when it has none or it cannot be read. */
    stateOfInstallation(workspaceId: string, installationId: string): Promise<OptionalGraphState> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const graph = await this.records.graphOfInstallation(tx, installationId)
            return graph === null ? null : this.stateOf(tx, graph)
        })
    }

    /** The id of the version that decides for the agent, or null when it has none; a light lookup that reads no document. */
    activeVersionIdOf(workspaceId: string, agentId: string): Promise<OptionalVersionId> {
        return this.engine.scoped(
            workspaceId,
            async (tx) => (await this.records.graphOf(tx, agentId))?.activeVersionId ?? null,
        )
    }

    /** Whether the live version of the agent's graph has a flow of nodes, so a tag or a message can start it. */
    async hasLiveFlow(workspaceId: string, agentId: string): Promise<boolean> {
        const state = await this.stateOfAgent(workspaceId, agentId)
        return state?.active?.flow !== undefined
    }

    /** The graph of the agent, or null when it has none or it cannot be read. */
    stateOfAgent(workspaceId: string, agentId: string): Promise<OptionalGraphState> {
        return this.engine.scoped(workspaceId, (tx) => this.stateOfAgentIn(tx, agentId))
    }

    /** The graph of the agent read in the caller's transaction, or null when it has none or it cannot be read. */
    async stateOfAgentIn(tx: ScopedTx, agentId: string): Promise<OptionalGraphState> {
        const graph = await this.records.graphOf(tx, agentId)
        return graph === null ? null : this.stateOf(tx, graph)
    }

    /**
     * Gives the agent its graph when it has none: the draft, and version 1 (change kind `seed`), enforced from the first day. A seed
     * answers what the rules answer, so enforcing it changes nothing until someone edits. A second call changes nothing.
     */
    async ensure(
        workspaceId: string,
        agentId: string,
        installationId: string,
        seed: GraphDocument,
    ): Promise<GraphState> {
        const existing = await this.stateOfAgent(workspaceId, agentId)
        if (existing !== null) return existing
        await this.engine.scoped(workspaceId, async (tx) => {
            const { graph } = await this.records.ensureGraph(tx, {
                agentId,
                installationId,
                draft: jsonOf(seed),
                draftRev: 1,
                mode: "enforced",
            })
            if ((await this.records.latestVersion(tx, agentId)) !== null) return
            const first = await this.insertVersion(tx, {
                workspaceId,
                agentId,
                document: seed,
                kind: "seed",
                note: "",
                memberId: null,
                contextVersionId: null,
            })
            await this.records.patchGraph(tx, graph, { activeVersionId: first.id })
        })
        return this.require(workspaceId, agentId)
    }

    /** Saves the draft when nobody saved after it was read; a stale revision is refused. */
    saveDraft(workspaceId: string, agentId: string, rev: number, draft: unknown): Promise<GraphState> {
        const parsed = graphDocumentSchema.safeParse(draft)
        if (!parsed.success) return Promise.reject(new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid }))
        return this.engine.scoped(workspaceId, async (tx) => {
            const graph = await this.records.graphOf(tx, agentId)
            if (graph?.draftRev !== rev) throw conflict()
            const saved = await this.records.patchGraph(tx, graph, { draft: jsonOf(parsed.data), draftRev: rev + 1 })
            if (saved === null) throw conflict()
            return this.stateRequired(tx, saved)
        })
    }

    /** Freezes a graph as the next version, makes it the one that decides and keeps it as the draft. Checks are the caller's. */
    publish(input: PublishInput): Promise<GraphVersionView> {
        if (!graphDocumentSchema.safeParse(input.document).success)
            return Promise.reject(new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid }))
        return this.engine.scoped(input.workspaceId, (tx) => this.publishIn(tx, input))
    }

    /**
     * `publish` in the caller's transaction, so a write that must move with the agent graph (a version of the primary workflow) commits
     * or rolls back together with it: the two can never diverge. Checks are the caller's.
     */
    async publishIn(tx: ScopedTx, input: PublishInput): Promise<GraphVersionView> {
        const parsed = graphDocumentSchema.safeParse(input.document)
        if (!parsed.success) throw new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid })
        const graph = await this.records.graphOf(tx, input.agentId)
        if (graph === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        const version = await this.insertVersion(tx, { ...input, document: parsed.data })
        const moved = await this.records.patchGraph(tx, graph, {
            activeVersionId: version.id,
            draft: jsonOf(parsed.data),
            draftRev: graph.draftRev + 1,
        })
        if (moved === null) throw conflict()
        return viewOf(version)
    }

    /** The number of the newest version of the agent; 0 before the first. */
    latestVersionOf(workspaceId: string, agentId: string): Promise<number> {
        return this.engine.scoped(
            workspaceId,
            async (tx) => (await this.records.latestVersion(tx, agentId))?.number ?? 0,
        )
    }

    /** The versions of the agent, newest first. */
    versionsOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<GraphVersionView>> {
        return this.engine.scoped(workspaceId, async (tx) =>
            (await this.records.versionsOf(tx, agentId, VERSION_LIMIT)).map(viewOf),
        )
    }

    /** One version as a graph, for "back to this version"; refused when it is not the agent's or cannot be read. */
    async documentOf(workspaceId: string, agentId: string, versionId: string): Promise<GraphDocument> {
        return (await this.versionAt(workspaceId, agentId, versionId)).document
    }

    /** The approver the branch of a decision named in the version that decided, or null when that version no longer names one. */
    async approverOf(decision: DecisionView): Promise<OptionalBranchApprover> {
        const document = await this.documentOf(decision.workspaceId, decision.agentId, decision.versionId)
        return branchApproverOf(document, decision.action, decision.branchKey, decision.path)
    }

    /** Of these agents of the workspace, the ones that have no graph yet. */
    async missingGraph(workspaceId: string, agentIds: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const held = new Set<string>()
        await eachInOrder(chunksOf(agentIds, AGENT_CHUNK), async (chunk) => {
            const found = await this.engine.scoped(workspaceId, (tx) => this.records.agentsWithGraph(tx, chunk))
            found.forEach((agentId) => held.add(agentId))
        })
        return agentIds.filter((id) => !held.has(id))
    }

    /** The Brain rules behind the versions that decide in a workspace, with the hash they held when the owner confirmed them; at most `limit`. */
    brainSourcesInForce(workspaceId: string, limit: number): Promise<ReadonlyArray<BrainSourceInForce>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const graphs = await this.records.graphsOfWorkspace(tx, GRAPH_LIMIT)
            const versionIds = graphs.flatMap((graph) =>
                graph.activeVersionId === null ? [] : [graph.activeVersionId],
            )
            if (versionIds.length === 0) return []
            const sources = await this.records.sourcesOf(tx, "brain", versionIds, limit)
            return sources.map((row) => ({
                workspaceId: row.workspaceId,
                agentId: row.agentId,
                versionId: row.versionId,
                nodeKey: row.nodeKey,
                branchKey: row.branchKey,
                factId: row.ref,
                valueHash: row.valueHash,
            }))
        })
    }

    /** One version with its number and its graph, for the trace of a run; refused when it is not the agent's or cannot be read. */
    versionAt(workspaceId: string, agentId: string, versionId: string): Promise<VersionAt> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const row = (await this.records.version(tx, versionId)) ?? (await this.workflowVersionAt(tx, versionId))
            if (row?.agentId !== agentId) throw new AgentGraphsError({ code: AgentGraphsErrorCode.VersionNotFound })
            const parsed = graphDocumentSchema.safeParse(row.document)
            if (!parsed.success) throw new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid })
            return { version: row.number, document: parsed.data }
        })
    }

    /**
     * What a step of a run read by this version may reach. A version of the agent's own graph (the primary workflow) runs under its
     * grant as it stands. A version of any other workflow runs under what its own graph declares, its tools and effects bounded by the
     * tool set the agent's module declares (`workflowRunGrantOf`): a workflow never reaches past the agent, and never depends on what
     * the primary workflow happens to use. Refused when the version is not the agent's or cannot be read.
     */
    runGrantOf(workspaceId: string, agentId: string, versionId: string): Promise<RunGrant> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const own = await this.records.version(tx, versionId)
            const row = own ?? (await this.workflowVersionAt(tx, versionId))
            if (row?.agentId !== agentId) throw new AgentGraphsError({ code: AgentGraphsErrorCode.VersionNotFound })
            const parsed = graphDocumentSchema.safeParse(row.document)
            if (!parsed.success) throw new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid })
            const declared = parsed.data.flow?.grant ?? EMPTY_GRANT
            if (own !== null) return ownRunGrantOf(declared)
            return workflowRunGrantOf(declared, agentToolsOf(parsed.data.flow?.moduleKey ?? ""))
        })
    }

    /**
     * A workflow version read as an agent graph version: a run of a workflow other than the primary one is pinned to the workflow
     * version itself, and its steps read their graph by that id. The snapshot is the flow; the document holds no rule-derived nodes.
     */
    private async workflowVersionAt(tx: ScopedTx, versionId: string): Promise<WorkflowVersionDocument | null> {
        const version = this.workflows === undefined ? null : await this.workflows.version(tx, versionId)
        return version === null
            ? null
            : {
                  agentId: version.agentId,
                  number: version.number,
                  document: { nodes: [], rights: [], flow: version.document },
              }
    }

    /** Sets whether the graph decides (`enforced`) or only records (`shadow`), and keeps who set it; a publish never touches this. */
    setMode(workspaceId: string, agentId: string, mode: GraphMode, memberId: string): Promise<GraphState> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const graph = await this.records.graphOf(tx, agentId)
            if (graph === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
            const changed = await this.records.patchGraph(tx, graph, {
                mode,
                modeSetBy: memberId,
                modeSetAt: this.clock.now().toISOString(),
            })
            if (changed === null) throw conflict()
            return this.stateRequired(tx, changed)
        })
    }

    private async require(workspaceId: string, agentId: string): Promise<GraphState> {
        const state = await this.stateOfAgent(workspaceId, agentId)
        if (state === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return state
    }

    private async stateRequired(tx: ScopedTx, graph: GraphRecord): Promise<GraphState> {
        const state = await this.stateOf(tx, graph)
        if (state === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return state
    }

    private async stateOf(tx: ScopedTx, graph: GraphRecord): Promise<OptionalGraphState> {
        const draft = graphDocumentSchema.safeParse(graph.draft)
        if (!draft.success) return null
        const version = graph.activeVersionId === null ? null : await this.records.version(tx, graph.activeVersionId)
        const active = version === null ? null : graphDocumentSchema.safeParse(version.document)
        return {
            workspaceId: graph.workspaceId,
            agentId: graph.agentId,
            installationId: graph.installationId,
            mode: graph.mode,
            draft: withoutStrayStops(draft.data),
            draftRev: graph.draftRev,
            activeVersionId: graph.activeVersionId,
            active: active?.success === true ? active.data : null,
            activeKind: version?.changeKind ?? null,
        }
    }

    /** Inserts the next version of the agent and indexes its sources. */
    private async insertVersion(tx: ScopedTx, input: PublishInput): Promise<VersionRecord> {
        const last = await this.records.latestVersion(tx, input.agentId)
        const next = input.version ?? (last?.number ?? 0) + 1
        if (next <= (last?.number ?? 0)) throw conflict()
        const version = await this.records.insertVersion(tx, {
            agentId: input.agentId,
            number: next,
            document: jsonOf(input.document),
            documentHash: hashOf(input.document),
            contextVersionId: input.contextVersionId,
            changeKind: input.kind,
            note: input.note,
            publishedBy: input.memberId,
        })
        if (version === null) throw conflict()
        await eachInOrder(sourcesIndexOf(input.document), (row) =>
            this.records.insertSource(tx, {
                versionId: version.id,
                agentId: input.agentId,
                nodeKey: row.nodeKey,
                branchKey: row.branchKey,
                kind: row.kind,
                ref: row.ref,
                valueHash: row.valueHash,
            }),
        )
        return version
    }
}

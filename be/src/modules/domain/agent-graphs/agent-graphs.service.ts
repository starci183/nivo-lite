import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { graphDocumentSchema } from "./agent-graphs.schema"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type { GraphChangeKind, GraphDocument, GraphMode, GraphVersionView } from "./agent-graphs.contracts"
import { sourcesIndexOf } from "./policies/sources-index.policy"
import { AgentGraphEntity, AgentGraphSourceEntity, AgentGraphVersionEntity } from "./persistence/entities"

/** The most versions one listing answers. */
const VERSION_LIMIT = 100

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
}

/** A graph, or null when the agent has none or it cannot be read. */
export type OptionalGraphState = GraphState | null

/** The hash of a graph; the same graph always has the same hash. */
const hashOf = (document: GraphDocument): string => createHash("sha256").update(JSON.stringify(document)).digest("hex")

const viewOf = (row: AgentGraphVersionEntity): GraphVersionView => ({
    id: row.id,
    version: row.version,
    changeKind: row.changeKind,
    note: row.note,
    publishedAt: row.publishedAt.toISOString(),
    publishedBy: row.publishedBy,
})

@Injectable()
/**
 * The store of the action graph: the draft of each agent under a revision check, the immutable versions the owner publishes (the
 * application role may only read and insert them, so the database refuses a change), the index of their sources, and the mode that
 * says whether a graph decides or only records. Every graph read back is validated, and one that does not parse is no graph.
 */
export class AgentGraphsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The graph of the installation, or null when it has none or it cannot be read. */
    async stateOfInstallation(installationId: string): Promise<OptionalGraphState> {
        const row = await this.entityManager.findOne(AgentGraphEntity, { where: { installationId } })
        return row === null ? null : this.stateOf(row)
    }

    /** The graph of the agent by its id alone, for a job that walks agents of every workspace; null when it has none or it cannot be read. */
    async statesOfAgent(agentId: string): Promise<OptionalGraphState> {
        const row = await this.entityManager.findOne(AgentGraphEntity, { where: { agentId } })
        return row === null ? null : this.stateOf(row)
    }

    /** The graph of the agent, or null when it has none or it cannot be read. */
    async stateOfAgent(workspaceId: string, agentId: string): Promise<OptionalGraphState> {
        const row = await this.entityManager.findOne(AgentGraphEntity, { where: { workspaceId, agentId } })
        return row === null ? null : this.stateOf(row)
    }

    /**
     * Gives the agent its graph when it has none: the draft, and version 1 (change kind `seed`) in shadow mode, so the trace and the
     * versions work from the first day and nothing is enforced. A second call changes nothing.
     */
    async ensure(
        workspaceId: string,
        agentId: string,
        installationId: string,
        seed: GraphDocument,
    ): Promise<GraphState> {
        const existing = await this.stateOfAgent(workspaceId, agentId)
        if (existing !== null) return existing
        await this.entityManager.transaction(async (manager) => {
            await manager
                .createQueryBuilder(AgentGraphEntity, "graph")
                .insert()
                .into(AgentGraphEntity)
                .values({ agentId, workspaceId, installationId, draft: seed, draftRev: 1, mode: "shadow" })
                .orIgnore()
                .execute()
            const made = await manager.countBy(AgentGraphVersionEntity, { agentId })
            if (made > 0) return
            const first = await this.insertVersion(manager, {
                workspaceId,
                agentId,
                document: seed,
                kind: "seed",
                note: "",
                memberId: null,
                contextVersionId: null,
            })
            await manager.update(AgentGraphEntity, { agentId }, { activeVersionId: first.id })
        })
        return this.require(workspaceId, agentId)
    }

    /** Saves the draft when nobody saved after it was read; a stale revision is refused. */
    async saveDraft(workspaceId: string, agentId: string, rev: number, draft: unknown): Promise<GraphState> {
        const parsed = graphDocumentSchema.safeParse(draft)
        if (!parsed.success) throw new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid })
        const saved = await this.entityManager.update(
            AgentGraphEntity,
            { agentId, workspaceId, draftRev: rev },
            { draft: parsed.data, draftRev: rev + 1 },
        )
        if (saved.affected !== 1) throw new AgentGraphsError({ code: AgentGraphsErrorCode.DraftConflict })
        return this.require(workspaceId, agentId)
    }

    /** Freezes a graph as the next version, makes it the one that decides and keeps it as the draft. Checks are the caller's. */
    publish(input: PublishInput): Promise<GraphVersionView> {
        const parsed = graphDocumentSchema.safeParse(input.document)
        if (!parsed.success) return Promise.reject(new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid }))
        return this.entityManager.transaction(async (manager) => {
            const graph = await manager.findOne(AgentGraphEntity, {
                where: { agentId: input.agentId, workspaceId: input.workspaceId },
                lock: { mode: "pessimistic_write" },
            })
            if (graph === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
            const version = await this.insertVersion(manager, { ...input, document: parsed.data })
            await manager.update(
                AgentGraphEntity,
                { agentId: input.agentId },
                { activeVersionId: version.id, draft: parsed.data, draftRev: graph.draftRev + 1 },
            )
            return viewOf(version)
        })
    }

    /** The versions of the agent, newest first. */
    async versionsOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<GraphVersionView>> {
        const rows = await this.entityManager.find(AgentGraphVersionEntity, {
            where: { workspaceId, agentId },
            order: { version: "DESC" },
            take: VERSION_LIMIT,
        })
        return rows.map(viewOf)
    }

    /** One version as a graph, for "back to this version"; refused when it is not the agent's or cannot be read. */
    async documentOf(workspaceId: string, agentId: string, versionId: string): Promise<GraphDocument> {
        const row = await this.entityManager.findOne(AgentGraphVersionEntity, {
            where: { id: versionId, workspaceId, agentId },
        })
        if (row === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.VersionNotFound })
        const parsed = graphDocumentSchema.safeParse(row.document)
        if (!parsed.success) throw new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid })
        return parsed.data
    }

    /** Of these agents, the ones that have no graph yet. */
    async missingGraph(agentIds: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        if (agentIds.length === 0) return []
        const have = await this.entityManager.find(AgentGraphEntity, {
            select: { agentId: true },
            where: { agentId: In([...agentIds]) },
            take: agentIds.length,
        })
        const held = new Set(have.map((row) => row.agentId))
        return agentIds.filter((id) => !held.has(id))
    }

    /** The Brain rules behind the versions that decide, with the hash they held when the owner confirmed them; at most `limit`. */
    async brainSourcesInForce(limit: number): Promise<ReadonlyArray<BrainSourceInForce>> {
        const rows = await this.entityManager
            .createQueryBuilder(AgentGraphSourceEntity, "source")
            .innerJoin(AgentGraphEntity, "graph", "graph.active_version_id = source.version_id")
            .where("source.kind = :kind", { kind: "brain" })
            .take(limit)
            .getMany()
        return rows.map((row) => ({
            workspaceId: row.workspaceId,
            agentId: row.agentId,
            versionId: row.versionId,
            nodeKey: row.nodeKey,
            branchKey: row.branchKey,
            factId: row.ref,
            valueHash: row.valueHash,
        }))
    }

    /** One version with its number and its graph, for the trace of a run; refused when it is not the agent's or cannot be read. */
    async versionAt(workspaceId: string, agentId: string, versionId: string): Promise<VersionAt> {
        const row = await this.entityManager.findOne(AgentGraphVersionEntity, {
            where: { id: versionId, workspaceId, agentId },
        })
        if (row === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.VersionNotFound })
        const parsed = graphDocumentSchema.safeParse(row.document)
        if (!parsed.success) throw new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid })
        return { version: row.version, document: parsed.data }
    }

    /** Sets whether the graph decides (`enforced`) or only records (`shadow`); setting `shadow` rolls back with nothing lost. */
    async setMode(workspaceId: string, agentId: string, mode: GraphMode): Promise<GraphState> {
        const changed = await this.entityManager.update(AgentGraphEntity, { agentId, workspaceId }, { mode })
        if (changed.affected !== 1) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return this.require(workspaceId, agentId)
    }

    private async require(workspaceId: string, agentId: string): Promise<GraphState> {
        const state = await this.stateOfAgent(workspaceId, agentId)
        if (state === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return state
    }

    private async stateOf(row: AgentGraphEntity): Promise<OptionalGraphState> {
        const draft = graphDocumentSchema.safeParse(row.draft)
        if (!draft.success) return null
        const version =
            row.activeVersionId === null
                ? null
                : await this.entityManager.findOne(AgentGraphVersionEntity, { where: { id: row.activeVersionId } })
        const active = version === null ? null : graphDocumentSchema.safeParse(version.document)
        return {
            workspaceId: row.workspaceId,
            agentId: row.agentId,
            installationId: row.installationId,
            mode: row.mode,
            draft: draft.data,
            draftRev: row.draftRev,
            activeVersionId: row.activeVersionId,
            active: active?.success === true ? active.data : null,
        }
    }

    /** Inserts the next version of the agent and indexes its sources. */
    private async insertVersion(manager: EntityManager, input: PublishInput): Promise<AgentGraphVersionEntity> {
        const last = await manager.findOne(AgentGraphVersionEntity, {
            select: { version: true },
            where: { agentId: input.agentId },
            order: { version: "DESC" },
        })
        const version = await manager.save(
            AgentGraphVersionEntity,
            manager.create(AgentGraphVersionEntity, {
                workspaceId: input.workspaceId,
                agentId: input.agentId,
                version: (last?.version ?? 0) + 1,
                document: input.document,
                documentHash: hashOf(input.document),
                contextVersionId: input.contextVersionId,
                changeKind: input.kind,
                note: input.note,
                publishedBy: input.memberId,
            }),
        )
        const sources = sourcesIndexOf(input.document).map((row) => ({
            versionId: version.id,
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            nodeKey: row.nodeKey,
            branchKey: row.branchKey,
            kind: row.kind,
            ref: row.ref,
            valueHash: row.valueHash,
        }))
        if (sources.length > 0) await manager.insert(AgentGraphSourceEntity, sources)
        return version
    }
}

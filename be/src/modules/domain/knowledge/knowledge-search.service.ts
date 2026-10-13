import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { toVector } from "@modules/domain/knowledge-chunks"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeError, KnowledgeErrorCode } from "./errors/knowledge.error"
import type { AskInput, Lens, Passage } from "./knowledge.contracts"
import { lensOf } from "./lens.policy"
import { toPassage } from "./passage.mapper"
import type { ModuleAudienceRow, PassageRow } from "./persistence/search.rows"
import { MATCH_KNOWLEDGE, SELECT_MODULE_AUDIENCE } from "./persistence/search.sql"

/** The longest question that is searched. */
const QUESTION_MAX_CHARS = 500

/** How many passages a question gets back. */
const ASK_LIMIT = 8

/** How long the embedding of a question may take before the search falls back to words. */
const QUERY_TIMEOUT_MS = 8000

@Injectable()
/** Finds what the agents of a business may read for a question: the business documents and the base knowledge, through the lens. */
export class KnowledgeSearchService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly embeddings: EmbeddingService,
    ) {}

    /** "Try asking": what an agent would retrieve for a question. Any member may try; the customer audience shows public passages only. */
    async ask(userId: string, workspaceId: string, input: AskInput): Promise<ReadonlyArray<Passage>> {
        await this.members.require(userId, workspaceId)
        const question = input.question.trim().slice(0, QUESTION_MAX_CHARS)
        const [row] = await this.entityManager.query<Array<ModuleAudienceRow>>(SELECT_MODULE_AUDIENCE, [input.module])
        if (row === undefined) throw new KnowledgeError({ code: KnowledgeErrorCode.ModuleUnknown })
        if (question === "") return []
        const lens = lensOf({
            workspaceId,
            module: input.module,
            moduleAudience: row.audience === "customer" ? "customer" : "internal",
            requestedAudience: input.audience === "customer" ? "customer" : "internal",
        })
        return this.passages(lens, question, ASK_LIMIT)
    }

    /** Hybrid search over both layers, filtered by the lens in SQL; the embedding of the query is metered against the workspace. */
    async passages(lens: Lens, query: string, limit: number): Promise<ReadonlyArray<Passage>> {
        const vectors =
            query.trim() === ""
                ? null
                : await this.embeddings.embed({
                      workspaceId: lens.workspaceId,
                      texts: [query],
                      timeoutMs: QUERY_TIMEOUT_MS,
                  })
        const vector = vectors?.[0]
        return this.match(lens, query, limit, vector === undefined ? null : toVector(vector))
    }

    /**
     * The business passages whose words match a question, WITHOUT the query embedding: no credits are spent. Used to check whether the
     * knowledge could answer at all (knowledge gaps), never to write a reply.
     */
    async passagesText(lens: Lens, query: string, limit: number): Promise<ReadonlyArray<Passage>> {
        const found = await this.match(lens, query, limit, null)
        return found.filter((passage) => passage.layer === "business")
    }

    private async match(
        lens: Lens,
        query: string,
        limit: number,
        vector: string | null,
    ): Promise<ReadonlyArray<Passage>> {
        const rows = await this.entityManager.query<Array<PassageRow>>(MATCH_KNOWLEDGE, [
            lens.workspaceId,
            lens.module,
            vector,
            query,
            limit,
            lens.audience,
            vector === null ? null : this.embeddings.model(),
            lens.installationId,
        ])
        return rows.map(toPassage)
    }
}

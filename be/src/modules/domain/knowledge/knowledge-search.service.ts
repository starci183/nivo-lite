import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { KnowledgeChunksService, toVector } from "@modules/domain/knowledge-chunks"
import type { ChunkHit } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { catalogAudienceOf } from "@modules/domain/module-audiences"
import { NivoKnowledgeSearchService } from "@modules/domain/nivo-knowledge"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeError, KnowledgeErrorCode } from "./errors/knowledge.error"
import type { AgentSearch, AskInput, Lens, Passage } from "./knowledge.contracts"
import { lensOf } from "./lens.policy"
import { businessPassage, rankPassages, tsqueryOf } from "./passage.mapper"

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
        private readonly chunks: KnowledgeChunksService,
        private readonly sources: KnowledgeSourcesService,
        private readonly nivo: NivoKnowledgeSearchService,
    ) {}

    /** "Try asking": what an agent would retrieve for a question. Any member may try; the customer audience shows public passages only. */
    async ask(userId: string, workspaceId: string, input: AskInput): Promise<ReadonlyArray<Passage>> {
        await this.members.require(userId, workspaceId)
        return this.forAgent({
            workspaceId,
            module: input.module,
            audience: input.audience === "customer" ? "customer" : "internal",
            installationId: input.installationId ?? null,
            question: input.question,
            limit: ASK_LIMIT,
        })
    }

    /**
     * What an agent lane may read for a question, with no member check: the retrieval step of a task the system runs for the agent.
     * The lens is the same as in `ask`: a customer-facing module or audience sees public passages only, and the instance joins its
     * own notes to the shared ones. A blank question finds nothing and spends nothing.
     */
    forAgent(request: AgentSearch): Promise<ReadonlyArray<Passage>> {
        const question = request.question.trim().slice(0, QUESTION_MAX_CHARS)
        const audience = catalogAudienceOf(request.module)
        if (audience === null) return Promise.reject(new KnowledgeError({ code: KnowledgeErrorCode.ModuleUnknown }))
        if (question === "") return Promise.resolve([])
        const lens = lensOf({
            workspaceId: request.workspaceId,
            module: request.module,
            moduleAudience: audience,
            requestedAudience: request.audience,
            installationId: request.installationId,
        })
        return this.passages(lens, question, request.limit)
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
        const [folded] = await callDbFunction<{ knowledge_fold: string }>(this.entityManager, "public.knowledge_fold", [
            query,
        ])
        const search = {
            vector,
            model: vector === null ? null : this.embeddings.model(),
            tsquery: tsqueryOf(folded?.knowledge_fold ?? ""),
            limit,
        }
        const [business, base] = await Promise.all([
            this.chunks.search({
                workspaceId: lens.workspaceId,
                module: lens.module,
                audience: lens.audience,
                installationId: lens.installationId,
                ...search,
            }),
            this.nivo.search({ module: lens.module, ...search }),
        ])
        return rankPassages(await this.withSources(lens.workspaceId, business), base, limit)
    }

    /** The passages of the business documents, each with the kind, title and topic of its source. */
    private async withSources(workspaceId: string, hits: ReadonlyArray<ChunkHit>): Promise<ReadonlyArray<Passage>> {
        const briefs = await this.sources.briefsOf(workspaceId, [...new Set(hits.map((hit) => hit.sourceId))])
        return hits.flatMap((hit) => {
            const brief = briefs.find((candidate) => candidate.id === hit.sourceId)
            return brief === undefined ? [] : [businessPassage(hit, brief)]
        })
    }
}

import { Injectable } from "@nestjs/common"
import { Brackets, type EntityManager } from "typeorm"
import { InjectVectorIndex, PLATFORM_TENANT, type VectorIndex, type VectorMatch } from "@modules/integrations/qdrant"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { NivoHit, NivoQuery } from "./nivo-knowledge.contracts"
import { NivoKnowledgeLogEvent } from "./nivo-knowledge.log-events"
import { CORE_FOLDER } from "./nivo-item.policy"
import { NivoKnowledgeItemEntity } from "./persistence/entities"

/** The most items one search answers. */
const SEARCH_MAX = 40

/** The share of the score the meaning half carries (the cosine similarity); the words carry the rest. */
const MEANING_WEIGHT = 0.7

/** The share of the score the word half carries (the text rank, capped at 1). */
const WORDS_WEIGHT = 0.3

/** The least cosine similarity a point needs to count as a hit by meaning (a distance under 0.8). */
const MEANING_FLOOR = 0.2

/** One row the statement answers: the item, and its word rank (0 when the query has no words or the item none of them). */
interface ItemLine {
    readonly id: string
    readonly module: string
    readonly kind: string
    readonly title: string
    readonly content: string
    readonly rank: number | string | null
}

@Injectable()
/**
 * Finds the items of the base knowledge of NIVO that answer a question, by meaning and by words. The meaning half is a query of the
 * vector index (kind `base`) inside its mandatory filters: the platform tenant, the identity of the query vector, items in force, the
 * reader's module and the core folder (`module` null); the word half is the `fts` index. The rows are then read from Postgres by id,
 * in the module filter again, so the index never decides what is read. An index that does not answer leaves the word half standing.
 */
export class NivoKnowledgeSearchService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectVectorIndex() private readonly index: VectorIndex,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The best items of the module folder and of core for a query (vector half and word half); none when the query has neither. */
    async search(query: NivoQuery): Promise<ReadonlyArray<NivoHit>> {
        const words = query.tsquery
        const limit = Math.max(1, Math.min(query.limit, SEARCH_MAX))
        const near = await this.nearest(query, limit)
        if (words === null && near.length === 0) return []
        const similarity = new Map(near.map((match) => [match.id, match.score]))
        const statement = this.entityManager
            .createQueryBuilder(NivoKnowledgeItemEntity, "k")
            .select("k.id", "id")
            .addSelect("k.module", "module")
            .addSelect("k.kind", "kind")
            .addSelect("k.title", "title")
            .addSelect("k.body", "content")
            .addSelect(words === null ? "0" : "least(1, ts_rank(k.fts, to_tsquery('simple', :tsquery)))", "rank")
            .where("k.module IN (:...modules)", { modules: [query.module, CORE_FOLDER] })
            .andWhere(
                new Brackets((hit) => {
                    if (words !== null) hit.orWhere("k.fts @@ to_tsquery('simple', :tsquery)")
                    if (near.length > 0) hit.orWhere("k.id IN (:...near)")
                }),
            )
            .setParameters({ tsquery: words, near: near.map((match) => match.id) })
            .limit(SEARCH_MAX * 2)
        const lines = await statement.getRawMany<ItemLine>()
        return lines
            .map((line) => ({
                id: line.id,
                module: line.module,
                kind: line.kind,
                title: line.title,
                content: line.content,
                score: (similarity.get(line.id) ?? 0) * MEANING_WEIGHT + Number(line.rank ?? 0) * WORDS_WEIGHT,
            }))
            .toSorted((left, right) => right.score - left.score || left.id.localeCompare(right.id))
            .slice(0, limit)
    }

    /** The meaning half: the nearest points of the base knowledge inside the mandatory filters, near enough to count; none without a vector. */
    private async nearest(query: NivoQuery, limit: number): Promise<ReadonlyArray<VectorMatch>> {
        if (query.vector === null || query.model === null) return []
        try {
            const matches = await this.index.search(
                "base",
                {
                    workspaceId: PLATFORM_TENANT,
                    audience: "internal",
                    module: query.module,
                    installationId: null,
                    model: query.model,
                    standing: "in_force",
                },
                query.vector,
                { limit },
            )
            return matches.filter((match) => match.score > MEANING_FLOOR)
        } catch (cause) {
            this.logger.error(NivoKnowledgeLogEvent.IndexUnavailable, cause, { module: query.module })
            return []
        }
    }
}

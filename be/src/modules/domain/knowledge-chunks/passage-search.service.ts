import { Injectable } from "@nestjs/common"
import { Brackets, type EntityManager, type SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { customerReadySelect, customerTrustWhere } from "./customer-trust.policy"
import type {
    MeaningHit,
    OptionalStoredPassage,
    MeaningQuery,
    PassageLens,
    PassageStretch,
    StoredPassage,
    WordHit,
    WordQuery,
} from "./passage-search.contracts"
import {
    LEG_MAX,
    STRETCH_MAX,
    boundedOf,
    isComplete,
    meaningDistance,
    meaningHitsOf,
    rankedWordsOf,
    storedPassageOf,
    wordHit,
    wordHitsOf,
    wordRank,
    type PassageRawRow,
} from "./passage-search.policy"
import { wordTermsOf } from "./word-terms.policy"
import { KnowledgeChunkEntity } from "./persistence/entities"

@Injectable()
/**
 * The READ side of the passage store, the way a code assistant reads a big repository: find passages by words (the GIN index on
 * `fts`) or by meaning (the HNSW index on `embedding`), each leg ONE bounded statement that answers its own best passages, then read a
 * stretch of a document in order (the index on `(source_id, ord)`). Nothing here reads a whole workspace, and no statement scores
 * every row. EVERY statement carries the lens: the workspace, the reader's module and instance, and for a customer audience
 * `visibility = 'public'` with the trust gate (`customerTrustWhere`); a caller cannot ask for more than its lens.
 */
export class PassageSearchService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The passages of the lens that hold the words, best rank first, then by id. Vietnamese matches with or without diacritics and a
     * number or a code matches as it is written, because the database folds and parses the query exactly as it did the passage.
     * Blank words find nothing and run nothing.
     */
    async byWords(lens: PassageLens, query: WordQuery): Promise<ReadonlyArray<WordHit>> {
        if (query.words.trim() === "") return []
        const match = query.match ?? "all"
        if (match === "ranked") return this.byRankedWords(lens, query)
        const rows = await this.inLens(lens)
            .addSelect(wordRank("c", match), "rank")
            .andWhere(wordHit("c", match))
            .setParameters({ words: query.words })
            .orderBy("rank", "DESC")
            .limit(boundedOf(query.limit, LEG_MAX))
            .getRawMany<PassageRawRow>()
        return wordHitsOf(rows, () => match === "all")
    }

    /**
     * The ranked word leg (`wordTermsOf`, `rankedWordsOf`): the passages of the lens that hold a code of the query or two of its words,
     * best covered first. Still one bounded statement on the GIN index; a query of question words only finds nothing and runs nothing.
     */
    private async byRankedWords(lens: PassageLens, query: WordQuery): Promise<ReadonlyArray<WordHit>> {
        const ranked = rankedWordsOf("c", wordTermsOf(query.words))
        if (ranked === null) return []
        const rows = await this.inLens(lens)
            .addSelect(ranked.coverage, "coverage")
            .addSelect(ranked.rank, "rank")
            .andWhere(ranked.hit)
            .setParameters(ranked.parameters)
            .orderBy("rank", "DESC")
            .addOrderBy("c.id", "ASC")
            .limit(boundedOf(query.limit, LEG_MAX))
            .getRawMany<PassageRawRow>()
        return wordHitsOf(rows, (coverage) => isComplete(coverage, ranked.total))
    }

    /**
     * The passages of the lens nearest in meaning to a query vector, nearest first, then by id: only passages whose vector comes
     * from the query's model are compared, and the statement orders by the distance alone so the vector index serves it.
     */
    async byMeaning(lens: PassageLens, query: MeaningQuery): Promise<ReadonlyArray<MeaningHit>> {
        const rows = await this.inLens(lens)
            .addSelect(meaningDistance("c"), "distance")
            .andWhere("c.embeddingModel = :model")
            .andWhere("c.embedding IS NOT NULL")
            .setParameters({ model: query.model, vector: query.vector })
            .orderBy("distance", "ASC")
            .limit(boundedOf(query.limit, LEG_MAX))
            .getRawMany<PassageRawRow>()
        return meaningHitsOf(rows)
    }

    /**
     * The passages of the lens among these ids, in no order: what a vector index found, read back from the system of record. An id
     * the lens does not hold (a row that is gone, moved to another lens, or no longer served to a customer) is simply not answered,
     * so a lagging index never shows what Postgres no longer serves.
     */
    async byIds(lens: PassageLens, passageIds: ReadonlyArray<string>): Promise<ReadonlyArray<StoredPassage>> {
        const ids = [...new Set(passageIds)].slice(0, LEG_MAX)
        if (ids.length === 0) return []
        const rows = await this.inLens(lens)
            .andWhere("c.id IN (:...passageIds)", { passageIds: ids })
            .limit(ids.length)
            .getRawMany<PassageRawRow>()
        return rows.map((row) => storedPassageOf(row))
    }

    /** One passage of the lens by its id, or null when the lens does not hold it (missing, another lens, or withheld from a customer). */
    async one(lens: PassageLens, passageId: string): Promise<OptionalStoredPassage> {
        const row = await this.inLens(lens).andWhere("c.id = :passageId", { passageId }).limit(1).getRawOne<PassageRawRow>()
        return row === undefined ? null : storedPassageOf(row)
    }

    /**
     * A stretch of one document of the lens in reading order: forward from a position (it and the later ones, ascending) or backward
     * (the earlier ones, descending), by keyset on the position. A customer audience steps over the passages it is not served.
     */
    async stretch(lens: PassageLens, stretch: PassageStretch): Promise<ReadonlyArray<StoredPassage>> {
        const forward = stretch.direction === "forward"
        const rows = await this.inLens(lens)
            .andWhere("c.sourceId = :sourceId", { sourceId: stretch.sourceId })
            .andWhere(forward ? "c.ord >= :from" : "c.ord < :from", { from: stretch.from })
            .orderBy("c.ord", forward ? "ASC" : "DESC")
            .limit(boundedOf(stretch.limit, STRETCH_MAX))
            .getRawMany<PassageRawRow>()
        return rows.map((row) => storedPassageOf(row))
    }

    /** The statement every read starts from: the columns of a passage and the whole lens, in the statement itself. */
    private inLens(lens: PassageLens): SelectQueryBuilder<KnowledgeChunkEntity> {
        const found = this.entityManager
            .createQueryBuilder(KnowledgeChunkEntity, "c")
            .select("c.id", "id")
            .addSelect("c.sourceId", "sourceId")
            .addSelect("c.module", "module")
            .addSelect("c.ord", "ord")
            .addSelect("c.content", "content")
            .addSelect("c.visibility", "visibility")
            .addSelect(customerReadySelect("c"), "customerReady")
            .addSelect("c.placeKind", "placeKind")
            .addSelect("c.placeLabel", "placeLabel")
            .where("c.workspaceId = :workspaceId", { workspaceId: lens.workspaceId })
            .andWhere(
                new Brackets((own) =>
                    own.where("c.module IS NULL").orWhere("c.module = :module", { module: lens.module }),
                ),
            )
            .andWhere(
                new Brackets((own) =>
                    own
                        .where("c.installationId IS NULL")
                        .orWhere("c.installationId = :installationId", { installationId: lens.installationId }),
                ),
            )
        if (lens.audience !== "customer") return found
        return found.andWhere("c.visibility = :served", { served: "public" }).andWhere(customerTrustWhere("c", "customer") ?? "FALSE")
    }
}

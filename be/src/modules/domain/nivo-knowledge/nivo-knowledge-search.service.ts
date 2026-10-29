import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { hybridHit, hybridScore } from "@modules/domain/knowledge-chunks"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { NivoHit, NivoQuery } from "./nivo-knowledge.contracts"
import { CORE_FOLDER } from "./nivo-item.policy"
import { NivoKnowledgeItemEntity } from "./persistence/entities"

/** The most items one search answers. */
const SEARCH_MAX = 40

@Injectable()
/** Finds the items of the base knowledge of NIVO that answer a question, scored like the business passages. */
export class NivoKnowledgeSearchService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The best items of the module folder and of core for a query (vector half and word half); none when the query has neither. */
    search(query: NivoQuery): Promise<ReadonlyArray<NivoHit>> {
        const terms = { vector: query.vector !== null && query.model !== null, text: query.tsquery !== null }
        if (!terms.vector && !terms.text) return Promise.resolve([])
        return this.entityManager
            .createQueryBuilder(NivoKnowledgeItemEntity, "k")
            .select("k.id", "id")
            .addSelect("k.module", "module")
            .addSelect("k.kind", "kind")
            .addSelect("k.title", "title")
            .addSelect("k.body", "content")
            .addSelect(hybridScore("k", terms), "score")
            .where("k.module IN (:...modules)", { modules: [query.module, CORE_FOLDER] })
            .andWhere(hybridHit("k", terms))
            .setParameters({ vector: query.vector, model: query.model, tsquery: query.tsquery })
            .orderBy("score", "DESC")
            .limit(Math.max(1, Math.min(query.limit, SEARCH_MAX)))
            .getRawMany<NivoHit>()
    }
}

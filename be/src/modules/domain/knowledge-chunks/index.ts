export { EMBEDDING_DIMENSIONS } from "./knowledge-chunks.contracts"
export type {
    ChunkDraft,
    EmbeddedChunk,
    LocatedText,
    MissingPassage,
    PassagePlace,
    StoredAt,
} from "./knowledge-chunks.contracts"
export { chunkLocated, chunkPassages } from "./chunk.policy"
export { passageHashOf, passageTextHashOf } from "./passage-hash.policy"
export { reusePlanOf } from "./passage-reuse.policy"
export { KnowledgeChunksModule } from "./knowledge-chunks.module"
export { KnowledgeChunksService } from "./knowledge-chunks.service"
export { PassageSearchService } from "./passage-search.service"
export { PassageVectorRowsService } from "./passage-vector-rows.service"
export type { PassageLens, StoredPassage, WordMatch } from "./passage-search.contracts"
export { hasStoredSize } from "./vector.policy"
export type {
    PassageVerdict,
    PassageView,
    TriageVerdict,
    TruthPassage,
} from "./knowledge-chunks.contracts"

export { knowledgeChunksEntities } from "./persistence/entities"
export { CUSTOMER_READY_COLUMN, customerReadyOf } from "./customer-trust.policy"

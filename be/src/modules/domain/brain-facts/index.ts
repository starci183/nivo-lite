export { brainFactsEntities } from "./persistence/entities"
export { BRAIN_FACTS_ERROR_KINDS } from "./errors/brain-facts.error"
export { BrainFactsModule } from "./brain-facts.module"
export { BrainFactsService } from "./brain-facts.service"
export { BrainFactBatchService } from "./brain-fact-batch.service"
export { BrainFactsReadService } from "./brain-facts-read.service"
export { isoOf } from "./fact-record.mapper"
export { factSlugOf, foldedText, sameValue } from "./fact-key.policy"
export { factLine, inForce, visibleTo } from "./fact-view.policy"
export { waitingCardCount } from "./fact-cards.policy"
export { BRAIN_FACTS_MESSAGES } from "./messages/brain-facts.messages"
export type { BrainSubjectType, Evidence, FactRecord, FactStatus, ProposeResult, Scope } from "./brain-facts.contracts"
export { SUBJECT_TYPES } from "./brain-facts.contracts"

export type { FactInput } from "./brain-facts.contracts"
export { batchIdOf, bulkNoteOf, isBulkSafe } from "./bulk-apply.policy"
export type { FactSource, FactProposalKind } from "./brain-facts.contracts"
export { BrainFactRelationsService } from "./brain-fact-relations.service"
export { BrainChangeRequestsService } from "./brain-change-requests.service"
export { DEFAULT_VALIDITY } from "./fact-write.policy"
export { NOTHING_STANDS } from "./fact-evidence.policy"
export type { UnchangedPassages } from "./fact-evidence.policy"
export { RELATION_KINDS } from "./brain-facts.contracts"
export type {
    ChangeFiled,
    ChangeRequest,
    FactRelation,
    RelationInput,
    RelationKind,
    FactAudience,
    InstallationScope,
} from "./brain-facts.contracts"
export { isRelationKind, otherEnd } from "./fact-relation.policy"
export type { EmbeddableFact } from "./embedding-standard.policy"
export { BrainFactEmbeddingsService } from "./brain-fact-embeddings.service"
export type { FactEmbeddingState, NearFact } from "./brain-fact-embeddings.service"
export { factEmbedHashOf, factEmbedTextOf, needsEmbedding, sameIdentity } from "./embedding-standard.policy"
export type { EmbeddingIdentity, StoredEmbedding } from "./embedding-standard.policy"
export { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"

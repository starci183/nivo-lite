export { brainFactsEntities } from "./persistence/entities"
export { BRAIN_FACTS_ERROR_KINDS } from "./errors/brain-facts.error"
export { BrainFactsModule } from "./brain-facts.module"
export { BrainFactsService } from "./brain-facts.service"
export type { FactsChangedHook } from "./brain-facts.service"
export { BrainFactBatchService } from "./brain-fact-batch.service"
export { BrainFactsReadService } from "./brain-facts-read.service"
export { BrainFactsPagingService, FACTS_PAGE_MAX } from "./brain-facts-paging.service"
export type { FactPageFilter } from "./brain-facts-paging.service"
export { isoOf } from "./fact-record.mapper"
export { factSlugOf, foldedText, numbersOf, readByJudge, sameValue, valueFormOf, valueTypeProblemOf } from "./fact-key.policy"
export { factLine, inForce, truthKeyOf, unshadowed, visibleTo } from "./fact-view.policy"
export { BrainFactAreasService } from "./brain-fact-areas.service"
export { valueLineOf } from "./fact-input.policy"
export { waitingCardCount } from "./fact-cards.policy"
export { readersAfterMove } from "./fact-audience.policy"
export { windowEndsBeforeStart, windowMovedOf } from "./fact-window.policy"
export { BRAIN_FACTS_MESSAGES } from "./messages/brain-facts.messages"
export type {
    BrainSubjectType,
    Evidence,
    FactFlag,
    FactRecord,
    FactStatus,
    ProposeResult,
    Scope,
} from "./brain-facts.contracts"
export { SUBJECT_TYPES } from "./brain-facts.contracts"

export type { FactInput } from "./brain-facts.contracts"
export { batchIdOf, bulkNoteOf, isBulkSafe } from "./bulk-apply.policy"
export type { FactSource, FactProposalKind } from "./brain-facts.contracts"
export { BrainFactRelationsService } from "./brain-fact-relations.service"
export { BrainChangeRequestsService } from "./brain-change-requests.service"
export type { ChangeRequestHook, ChangeSpeaker, ReasonedChangeRequest } from "./brain-change-requests.service"
export { RELATION_KINDS } from "./brain-facts.contracts"
export type { ChangeFiled, FactRelation, RelationInput, RelationKind, MaybeFact } from "./brain-facts.contracts"
export { isRelationKind, otherEnd } from "./fact-relation.policy"
export type { EmbeddableFact } from "./embedding-standard.policy"
export { BrainFactEmbeddingsService } from "./brain-fact-embeddings.service"
export { FactVectorRowsService } from "./fact-vector-rows.service"
export type {
    EmbeddedStatus,
    FactEmbeddingState,
    NearRead,
    WantingArm,
    WantingPage,
} from "./brain-fact-embeddings.contracts"
export { factEmbedHashOf, factEmbedTextOf, needsEmbedding } from "./embedding-standard.policy"
export type { EmbeddingIdentity } from "./embedding-standard.policy"
export { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
export { hasStatedPeriod, windowsArgue } from "./fact-window.policy"
export type { ValueDates } from "./fact-window.policy"

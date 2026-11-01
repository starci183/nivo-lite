export {
    KNOWLEDGE_SOURCES_ERROR_KINDS,
    KnowledgeSourcesError,
    KnowledgeSourcesErrorCode,
} from "./errors/knowledge-sources.error"
export { MAX_SOURCE_CHARS, MAX_UPLOAD_BYTES, StoredNote } from "./knowledge-sources.contracts"
export type {
    DossierDocumentCount,
    KnowledgeUsage,
    MaybeSource,
    SourceBrief,
    SourceCategory,
    SourceDetail,
    SourceRecord,
    SourceRef,
    SourceSummary,
    UploadAddress,
} from "./knowledge-sources.contracts"
export { KnowledgeSourcesModule } from "./knowledge-sources.module"
export { embedPercent, factsPercent, knowledgeProgressTopic } from "./knowledge-progress.policy"
export { KnowledgeSourcesService } from "./knowledge-sources.service"
export { contentHashOf } from "./source-hash.policy"
export { partsOf } from "./source-parts.policy"
export { SourcePartsService } from "./source-parts.service"
export { SourceTwinsService } from "./source-twins.service"
export type { TextParts } from "./source-twins.service"
export { SourceQuotaService } from "./source-quota.service"
export { SourceCriticStageService } from "./source-critic-stage.service"
export { SourceCategoriesService } from "./source-categories.service"
export { DossierSourcesService } from "./dossier-sources.service"
export type { DossierSource } from "./dossier-sources.contracts"
export { ApiKnowledgeSourcesService } from "./api-knowledge-sources.service"
export { ProfileSourcesService } from "./profile-sources.service"
export { KNOWLEDGE_SOURCES_MESSAGES } from "./messages/knowledge-sources.messages"
export { knowledgeSourcesEntities } from "./persistence/entities"
export { KnowledgeSourcesAdminReadService } from "./knowledge-sources-admin-read.service"
export { KnowledgeSourcesReadService } from "./knowledge-sources-read.service"
export type { ChangedPublicSource, OriginSource } from "./knowledge-sources-read.contracts"
export { KnowledgeSourcesReadableService } from "./knowledge-sources-readable.service"

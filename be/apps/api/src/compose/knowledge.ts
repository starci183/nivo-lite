import { DriveGrantService } from "@modules/domain/google-connections"
import type { DynamicModule } from "@nestjs/common"
import { BRAIN_ERROR_KINDS, BRAIN_MESSAGES, BrainModule } from "@modules/domain/brain"
import { BrainCommandsModule } from "@modules/domain/brain-commands"
import { BrainEvalCasesModule } from "@modules/domain/brain-eval-cases"
import {
    DOSSIER_REVIEW_ERROR_KINDS,
    DOSSIER_REVIEW_MESSAGES,
    DossierReviewModule,
} from "@modules/domain/dossier-review"
import { DossierReasonerService, DossierReviewAiModule } from "@modules/domain/dossier-review-ai"
import { BrainExtractionsModule } from "@modules/domain/brain-extractions"
import { BRAIN_FACTS_ERROR_KINDS, BRAIN_FACTS_MESSAGES, BrainFactsModule } from "@modules/domain/brain-facts"
import { BRAIN_LESSONS_ERROR_KINDS, BRAIN_LESSONS_MESSAGES, BrainLessonsModule } from "@modules/domain/brain-lessons"
import { EMBEDDING_DIMENSIONS, KnowledgeChunksModule } from "@modules/domain/knowledge-chunks"
import { KnowledgeGapsModule } from "@modules/domain/knowledge-gaps"
import {
    PUBLIC_DOCUMENTS_ERROR_KINDS,
    PUBLIC_DOCUMENTS_MESSAGES,
    PublicDocumentsModule,
} from "@modules/domain/public-documents"
import { KnowledgeSuggestionStateModule } from "@modules/domain/knowledge-suggestion-state"
import {
    KNOWLEDGE_ERROR_KINDS,
    KNOWLEDGE_MESSAGES,
    KnowledgeModule,
    VectorEmbedderService,
} from "@modules/domain/knowledge"
import { TeamChatNoticesService } from "@modules/domain/team-chat"
import { VectorSyncModule } from "@modules/domain/vector-sync"
import {
    KNOWLEDGE_SOURCES_ERROR_KINDS,
    KNOWLEDGE_SOURCES_MESSAGES,
    KnowledgeSourcesModule,
} from "@modules/domain/knowledge-sources"
import {
    CORE_FOLDER,
    NIVO_KNOWLEDGE_ERROR_KINDS,
    NIVO_KNOWLEDGE_MESSAGES,
    NivoKnowledgeModule,
} from "@modules/domain/nivo-knowledge"
import { DocumentsModule } from "@modules/integrations/documents"
import { DOCUMENT_READERS_ERROR_KINDS, DOCUMENT_READERS_MESSAGES } from "@modules/integrations/document-readers"
import { AiGatewayModule, chatProfileRoutes } from "@modules/integrations/ai-gateway"
import { AiModule } from "@modules/integrations/ai"
import { QDRANT_ERROR_KINDS, QDRANT_MESSAGES, QdrantModule } from "@modules/integrations/qdrant"
import { STORAGE_OBJECTS } from "@modules/integrations/object-storage"
import { MODULE_KNOWLEDGE_FOLDERS } from "@modules/domain/modules"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The knowledge area of the API, in registration order. */
export const knowledgeModules = (options: ApiOptions): Array<DynamicModule> => [
    AiGatewayModule.register({ isGlobal: true, ...options.aiGateway }),
    AiModule.register({ isGlobal: true, ...options.aiTasks.endpoint, profileRoutes: chatProfileRoutes() }),
    DocumentsModule.register({ isGlobal: true, ...options.documents }),
    // The vector index (Qdrant): a required engine piece, the only home of vectors (`QDRANT_URL` is required), kept in step with
    // Postgres by the vector sync below. The vector size is the embedding profile's.
    QdrantModule.register({ isGlobal: true, ...options.qdrant, dimensions: EMBEDDING_DIMENSIONS }),
    KnowledgeSourcesModule.register({ isGlobal: true, storage: STORAGE_OBJECTS }),
    KnowledgeChunksModule.register({ isGlobal: true }),
    KnowledgeSuggestionStateModule.register({ isGlobal: true }),
    NivoKnowledgeModule.register({
        isGlobal: true,
        folders: [CORE_FOLDER, ...MODULE_KNOWLEDGE_FOLDERS],
    }),
    KnowledgeModule.register({
        isGlobal: true,
        driveAccess: DriveGrantService,
        indexChunkDelayMs: options.knowledge.indexChunkDelayMs,
    }),
    BrainFactsModule.register({ isGlobal: true }),
    VectorSyncModule.register({
        isGlobal: true,
        embedder: VectorEmbedderService,
        driftReporter: TeamChatNoticesService,
    }),
    DossierReviewAiModule.register({ isGlobal: true }),
    DossierReviewModule.register({ isGlobal: true, model: DossierReasonerService }),
    KnowledgeGapsModule.register({ isGlobal: true }),
    PublicDocumentsModule.register({ isGlobal: true }),
    BrainLessonsModule.register({ isGlobal: true }),
    BrainExtractionsModule.register({ isGlobal: true }),
    BrainCommandsModule.register({ isGlobal: true }),
    BrainEvalCasesModule.register({ isGlobal: true }),
    BrainModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const knowledgeErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    BRAIN_ERROR_KINDS,
    DOSSIER_REVIEW_ERROR_KINDS,
    BRAIN_FACTS_ERROR_KINDS,
    BRAIN_LESSONS_ERROR_KINDS,
    KNOWLEDGE_ERROR_KINDS,
    KNOWLEDGE_SOURCES_ERROR_KINDS,
    NIVO_KNOWLEDGE_ERROR_KINDS,
    PUBLIC_DOCUMENTS_ERROR_KINDS,
    QDRANT_ERROR_KINDS,
    DOCUMENT_READERS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const knowledgeMessages: ReadonlyArray<MessageBundle> = [
    DOSSIER_REVIEW_MESSAGES,
    BRAIN_FACTS_MESSAGES,
    BRAIN_LESSONS_MESSAGES,
    BRAIN_MESSAGES,
    KNOWLEDGE_MESSAGES,
    KNOWLEDGE_SOURCES_MESSAGES,
    NIVO_KNOWLEDGE_MESSAGES,
    PUBLIC_DOCUMENTS_MESSAGES,
    QDRANT_MESSAGES,
    DOCUMENT_READERS_MESSAGES,
]

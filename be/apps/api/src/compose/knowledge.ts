import { DriveGrantService } from "@modules/domain/google-connections"
import { DecisionCorrectionsService } from "@modules/domain/decisions"
import type { DynamicModule } from "@nestjs/common"
import { BRAIN_ERROR_KINDS, BRAIN_MESSAGES, BrainModule } from "@modules/domain/brain"
import { BrainCommandsModule } from "@modules/domain/brain-commands"
import { BrainEvalCasesModule } from "@modules/domain/brain-eval-cases"
import { BrainExtractionsModule } from "@modules/domain/brain-extractions"
import { BRAIN_FACTS_ERROR_KINDS, BRAIN_FACTS_MESSAGES, BrainFactsModule } from "@modules/domain/brain-facts"
import { BRAIN_LESSONS_ERROR_KINDS, BRAIN_LESSONS_MESSAGES, BrainLessonsModule } from "@modules/domain/brain-lessons"
import { KnowledgeChunksModule } from "@modules/domain/knowledge-chunks"
import { KnowledgeGapsModule } from "@modules/domain/knowledge-gaps"
import { KnowledgeSuggestionStateModule } from "@modules/domain/knowledge-suggestion-state"
import { KNOWLEDGE_ERROR_KINDS, KNOWLEDGE_MESSAGES, KnowledgeModule } from "@modules/domain/knowledge"
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
import { AiGatewayModule } from "@modules/integrations/ai-gateway"
import { AiModule } from "@modules/integrations/ai"
import { STORAGE_OBJECTS } from "@modules/integrations/object-storage"
import { MODULE_KNOWLEDGE_FOLDERS } from "@modules/domain/modules"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The knowledge area of the API, in registration order. */
export const knowledgeModules = (options: ApiOptions): Array<DynamicModule> => [
    AiGatewayModule.register({ isGlobal: true, ...options.aiGateway }),
    AiModule.register({ isGlobal: true, ...options.aiTasks.endpoint }),
    DocumentsModule.register({ isGlobal: true, ...options.documents }),
    KnowledgeSourcesModule.register({ isGlobal: true, storage: STORAGE_OBJECTS }),
    KnowledgeChunksModule.register({ isGlobal: true }),
    KnowledgeSuggestionStateModule.register({ isGlobal: true }),
    NivoKnowledgeModule.register({
        isGlobal: true,
        folders: [CORE_FOLDER, ...MODULE_KNOWLEDGE_FOLDERS],
    }),
    KnowledgeModule.register({ isGlobal: true, driveAccess: DriveGrantService }),
    BrainFactsModule.register({ isGlobal: true }),
    KnowledgeGapsModule.register({ isGlobal: true }),
    BrainLessonsModule.register({ isGlobal: true }),
    BrainExtractionsModule.register({ isGlobal: true }),
    BrainCommandsModule.register({ isGlobal: true }),
    BrainEvalCasesModule.register({ isGlobal: true }),
    BrainModule.register({ isGlobal: true, corrections: DecisionCorrectionsService }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const knowledgeErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    BRAIN_ERROR_KINDS,
    BRAIN_FACTS_ERROR_KINDS,
    BRAIN_LESSONS_ERROR_KINDS,
    KNOWLEDGE_ERROR_KINDS,
    KNOWLEDGE_SOURCES_ERROR_KINDS,
    NIVO_KNOWLEDGE_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const knowledgeMessages: ReadonlyArray<MessageBundle> = [
    BRAIN_FACTS_MESSAGES,
    BRAIN_LESSONS_MESSAGES,
    BRAIN_MESSAGES,
    KNOWLEDGE_MESSAGES,
    KNOWLEDGE_SOURCES_MESSAGES,
    NIVO_KNOWLEDGE_MESSAGES,
]

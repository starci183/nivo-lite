import { DriveGrantService } from "@modules/domain/google-connections"
import { DecisionCorrectionsService } from "@modules/domain/decisions"
import type { DynamicModule } from "@nestjs/common"
import { BrainModule } from "@modules/domain/brain"
import { BrainCommandsModule } from "@modules/domain/brain-commands"
import { BrainEvalCasesModule } from "@modules/domain/brain-eval-cases"
import { BrainExtractionsModule } from "@modules/domain/brain-extractions"
import { BrainFactsModule } from "@modules/domain/brain-facts"
import { BrainLessonsModule } from "@modules/domain/brain-lessons"
import { KnowledgeChunksModule } from "@modules/domain/knowledge-chunks"
import { KnowledgeGapsModule } from "@modules/domain/knowledge-gaps"
import { KnowledgeSuggestionStateModule } from "@modules/domain/knowledge-suggestion-state"
import { KnowledgeModule } from "@modules/domain/knowledge"
import { KnowledgeSourcesModule } from "@modules/domain/knowledge-sources"
import { CORE_FOLDER, NivoKnowledgeModule } from "@modules/domain/nivo-knowledge"
import { DocumentsModule } from "@modules/integrations/documents"
import { AiPoolModule } from "@modules/integrations/ai-pool"
import { SUPABASE_OBJECTS } from "@modules/integrations/supabase"
import { MODULE_KNOWLEDGE_FOLDERS } from "@modules/domain/modules"
import type { ApiOptions } from "../api.options"
/** The knowledge area of the API, in registration order. */
export const knowledgeModules = (options: ApiOptions): Array<DynamicModule> => [
    AiPoolModule.register({ isGlobal: true, ...options.aiPool }),
    DocumentsModule.register({ isGlobal: true, ...options.documents }),
    KnowledgeSourcesModule.register({ isGlobal: true, storage: SUPABASE_OBJECTS }),
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

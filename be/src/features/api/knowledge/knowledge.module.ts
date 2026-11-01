import { Module } from "@nestjs/common"
import { KnowledgeSourcesHandler } from "./application/knowledge-sources.handler"
import { KnowledgeUsageHandler } from "./application/knowledge-usage.handler"
import { KnowledgeCategoriesHandler } from "./application/knowledge-categories.handler"
import { BrainDossiersHandler } from "./application/brain-dossiers.handler"
import { ImportBrainDossiersHandler } from "./application/import-brain-dossiers.handler"
import { KnowledgeSourceHandler } from "./application/knowledge-source.handler"
import { NivoKnowledgeCountHandler } from "./application/nivo-knowledge-count.handler"
import { NivoKnowledgeHandler } from "./application/nivo-knowledge.handler"
import { KnowledgeSuggestionsHandler } from "./application/knowledge-suggestions.handler"
import { AskKnowledgeHandler } from "./application/ask-knowledge.handler"
import { DriveLinkedFolderHandler } from "./application/drive-linked-folder.handler"
import { DrivePickedFolderHandler } from "./application/drive-picked-folder.handler"
import { EnqueueKnowledgeSourceHandler } from "./application/enqueue-knowledge-source.handler"
import { RetryKnowledgeSourceHandler } from "./application/retry-knowledge-source.handler"
import { ReindexKnowledgeSourceHandler } from "./application/reindex-knowledge-source.handler"
import { UpdateKnowledgeSourceHandler } from "./application/update-knowledge-source.handler"
import { DeleteKnowledgeSourceHandler } from "./application/delete-knowledge-source.handler"
import { SetKnowledgeSuggestionStateHandler } from "./application/set-knowledge-suggestion-state.handler"
import { CreateKnowledgeUploadHandler } from "./application/create-knowledge-upload.handler"
import { ReembedKnowledgeHandler } from "./application/reembed-knowledge.handler"
import { GetBrainHandler } from "./application/get-brain.handler"
import { SaveBrainFactHandler } from "./application/save-brain-fact.handler"
import { DecideBrainFactHandler } from "./application/decide-brain-fact.handler"
import { KeepCurrentBrainFactHandler } from "./application/keep-current-brain-fact.handler"
import { ApplyBrainFactGroupHandler } from "./application/apply-brain-fact-group.handler"
import { UndoBrainFactBatchHandler } from "./application/undo-brain-fact-batch.handler"
import { SaveBrainLessonHandler } from "./application/save-brain-lesson.handler"
import { DecideBrainLessonHandler } from "./application/decide-brain-lesson.handler"
import { DismissKnowledgeGapHandler } from "./application/dismiss-knowledge-gap.handler"
import { MaintainBrainHandler } from "./application/maintain-brain.handler"
import { RequestLessonMiningHandler } from "./application/request-lesson-mining.handler"
import { LessonMiningStatusHandler } from "./application/lesson-mining-status.handler"
import { AuthorizeDriveHandler } from "./application/authorize-drive.handler"
import { DisconnectDriveHandler } from "./application/disconnect-drive.handler"
import { GetDriveGrantHandler } from "./application/get-drive-grant.handler"
import { AgentKnowledgeLensesHandler } from "./application/agent-knowledge-lenses.handler"
import { ConfigurableModuleClass } from "./knowledge.module-definition"

@Module({
    providers: [
        KnowledgeSourcesHandler,
        KnowledgeSourceHandler,
        KnowledgeUsageHandler,
        KnowledgeCategoriesHandler,
        BrainDossiersHandler,
        ImportBrainDossiersHandler,
        NivoKnowledgeCountHandler,
        NivoKnowledgeHandler,
        KnowledgeSuggestionsHandler,
        AskKnowledgeHandler,
        DriveLinkedFolderHandler,
        DrivePickedFolderHandler,
        EnqueueKnowledgeSourceHandler,
        RetryKnowledgeSourceHandler,
        ReindexKnowledgeSourceHandler,
        UpdateKnowledgeSourceHandler,
        DeleteKnowledgeSourceHandler,
        SetKnowledgeSuggestionStateHandler,
        CreateKnowledgeUploadHandler,
        ReembedKnowledgeHandler,
        GetBrainHandler,
        SaveBrainFactHandler,
        DecideBrainFactHandler,
        KeepCurrentBrainFactHandler,
        ApplyBrainFactGroupHandler,
        UndoBrainFactBatchHandler,
        SaveBrainLessonHandler,
        DecideBrainLessonHandler,
        DismissKnowledgeGapHandler,
        MaintainBrainHandler,
        RequestLessonMiningHandler,
        LessonMiningStatusHandler,
        AuthorizeDriveHandler,
        DisconnectDriveHandler,
        GetDriveGrantHandler,
        AgentKnowledgeLensesHandler,
    ],
})
/** The knowledge feature: the handlers of its application. */
export class KnowledgeApiModule extends ConfigurableModuleClass {}

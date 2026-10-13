import { Module } from "@nestjs/common"
import { KnowledgeApiModule } from "../../knowledge.module"
import { KnowledgeSourcesResolver } from "./knowledge-sources.resolver"
import { KnowledgeSourceResolver } from "./knowledge-source.resolver"
import { NivoKnowledgeCountResolver } from "./nivo-knowledge-count.resolver"
import { NivoKnowledgeResolver } from "./nivo-knowledge.resolver"
import { KnowledgeSuggestionsResolver } from "./knowledge-suggestions.resolver"
import { AskKnowledgeResolver } from "./ask-knowledge.resolver"
import { DriveLinkedFolderResolver } from "./drive-linked-folder.resolver"
import { DrivePickedFolderResolver } from "./drive-picked-folder.resolver"
import { EnqueueKnowledgeSourceResolver } from "./enqueue-knowledge-source.resolver"
import { RetryKnowledgeSourceResolver } from "./retry-knowledge-source.resolver"
import { ReindexKnowledgeSourceResolver } from "./reindex-knowledge-source.resolver"
import { UpdateKnowledgeSourceResolver } from "./update-knowledge-source.resolver"
import { DeleteKnowledgeSourceResolver } from "./delete-knowledge-source.resolver"
import { SetKnowledgeSuggestionStateResolver } from "./set-knowledge-suggestion-state.resolver"
import { CreateKnowledgeUploadResolver } from "./create-knowledge-upload.resolver"
import { ReembedKnowledgeResolver } from "./reembed-knowledge.resolver"
import { GetBrainResolver } from "./get-brain.resolver"
import { SaveBrainFactResolver } from "./save-brain-fact.resolver"
import { DecideBrainFactResolver } from "./decide-brain-fact.resolver"
import { KeepCurrentBrainFactResolver } from "./keep-current-brain-fact.resolver"
import { SaveBrainLessonResolver } from "./save-brain-lesson.resolver"
import { DecideBrainLessonResolver } from "./decide-brain-lesson.resolver"
import { DismissKnowledgeGapResolver } from "./dismiss-knowledge-gap.resolver"
import { MaintainBrainResolver } from "./maintain-brain.resolver"
import { RequestLessonMiningResolver } from "./request-lesson-mining.resolver"
import { LessonMiningStatusResolver } from "./lesson-mining-status.resolver"
import { AuthorizeDriveResolver } from "./authorize-drive.resolver"
import { DisconnectDriveResolver } from "./disconnect-drive.resolver"
import { GetDriveGrantResolver } from "./get-drive-grant.resolver"

@Module({
    imports: [KnowledgeApiModule],
    providers: [
        KnowledgeSourcesResolver,
        KnowledgeSourceResolver,
        NivoKnowledgeCountResolver,
        NivoKnowledgeResolver,
        KnowledgeSuggestionsResolver,
        AskKnowledgeResolver,
        DriveLinkedFolderResolver,
        DrivePickedFolderResolver,
        EnqueueKnowledgeSourceResolver,
        RetryKnowledgeSourceResolver,
        ReindexKnowledgeSourceResolver,
        UpdateKnowledgeSourceResolver,
        DeleteKnowledgeSourceResolver,
        SetKnowledgeSuggestionStateResolver,
        CreateKnowledgeUploadResolver,
        ReembedKnowledgeResolver,
        GetBrainResolver,
        SaveBrainFactResolver,
        DecideBrainFactResolver,
        KeepCurrentBrainFactResolver,
        SaveBrainLessonResolver,
        DecideBrainLessonResolver,
        DismissKnowledgeGapResolver,
        MaintainBrainResolver,
        RequestLessonMiningResolver,
        LessonMiningStatusResolver,
        AuthorizeDriveResolver,
        DisconnectDriveResolver,
        GetDriveGrantResolver,
    ],
})
/** The GraphQL transport of the knowledge feature. */
export class KnowledgeGraphqlModule {}

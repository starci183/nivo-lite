import { Module } from "@nestjs/common"
import { VideoApiModule } from "../../video.module"
import { ListVideoProjectsResolver } from "./list-video-projects.resolver"
import { GetVideoProjectResolver } from "./get-video-project.resolver"
import { GetVideoBrandResolver } from "./get-video-brand.resolver"
import { GetVideoFiguresResolver } from "./get-video-figures.resolver"
import { ListVideoSourcesResolver } from "./list-video-sources.resolver"
import { ListVideoMediaResolver } from "./list-video-media.resolver"
import { GetVideoScopeResolver } from "./get-video-scope.resolver"
import { DuplicateVideoProjectResolver } from "./duplicate-video-project.resolver"
import { ArchiveVideoProjectResolver } from "./archive-video-project.resolver"
import { MarkVideoPublishedResolver } from "./mark-video-published.resolver"
import { CreateVideoProjectResolver } from "./create-video-project.resolver"
import { UpdateVideoProjectResolver } from "./update-video-project.resolver"
import { SaveVideoBrandResolver } from "./save-video-brand.resolver"
import { CreateVideoMediaUploadResolver } from "./create-video-media-upload.resolver"
import { ApproveVideoProjectResolver } from "./approve-video-project.resolver"
import { ShareVideoProjectResolver } from "./share-video-project.resolver"
import { RequestVideoScriptResolver } from "./request-video-script.resolver"
import { VideoScriptStatusResolver } from "./video-script-status.resolver"

@Module({
    imports: [VideoApiModule],
    providers: [
        ListVideoProjectsResolver,
        GetVideoProjectResolver,
        GetVideoBrandResolver,
        GetVideoFiguresResolver,
        ListVideoSourcesResolver,
        ListVideoMediaResolver,
        GetVideoScopeResolver,
        DuplicateVideoProjectResolver,
        ArchiveVideoProjectResolver,
        MarkVideoPublishedResolver,
        CreateVideoProjectResolver,
        UpdateVideoProjectResolver,
        SaveVideoBrandResolver,
        CreateVideoMediaUploadResolver,
        ApproveVideoProjectResolver,
        ShareVideoProjectResolver,
        RequestVideoScriptResolver,
        VideoScriptStatusResolver,
    ],
})
/** The GraphQL workbench reads and manager writes for videos. */
export class VideoGraphqlModule {}

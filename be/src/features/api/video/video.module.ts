import { Module } from "@nestjs/common"
import { ListVideoProjectsHandler } from "./application/list-video-projects.handler"
import { GetVideoProjectHandler } from "./application/get-video-project.handler"
import { GetVideoBrandHandler } from "./application/get-video-brand.handler"
import { GetVideoFiguresHandler } from "./application/get-video-figures.handler"
import { ListVideoSourcesHandler } from "./application/list-video-sources.handler"
import { ListVideoMediaHandler } from "./application/list-video-media.handler"
import { GetVideoScopeHandler } from "./application/get-video-scope.handler"
import { DuplicateVideoProjectHandler } from "./application/duplicate-video-project.handler"
import { ArchiveVideoProjectHandler } from "./application/archive-video-project.handler"
import { MarkVideoPublishedHandler } from "./application/mark-video-published.handler"
import { CreateVideoProjectHandler } from "./application/create-video-project.handler"
import { UpdateVideoProjectHandler } from "./application/update-video-project.handler"
import { SaveVideoBrandHandler } from "./application/save-video-brand.handler"
import { CreateVideoMediaUploadHandler } from "./application/create-video-media-upload.handler"
import { ApproveVideoProjectHandler } from "./application/approve-video-project.handler"
import { ShareVideoProjectHandler } from "./application/share-video-project.handler"
import { RequestVideoScriptHandler } from "./application/request-video-script.handler"
import { GetVideoScriptStatusHandler } from "./application/get-video-script-status.handler"

@Module({
    providers: [
        ListVideoProjectsHandler,
        GetVideoProjectHandler,
        GetVideoBrandHandler,
        GetVideoFiguresHandler,
        ListVideoSourcesHandler,
        ListVideoMediaHandler,
        GetVideoScopeHandler,
        DuplicateVideoProjectHandler,
        ArchiveVideoProjectHandler,
        MarkVideoPublishedHandler,
        CreateVideoProjectHandler,
        UpdateVideoProjectHandler,
        SaveVideoBrandHandler,
        CreateVideoMediaUploadHandler,
        ApproveVideoProjectHandler,
        ShareVideoProjectHandler,
        RequestVideoScriptHandler,
        GetVideoScriptStatusHandler,
    ],
})
/** The application handlers of the video workbench. */
export class VideoApiModule {}

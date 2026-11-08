import { QueryHandler } from "@nestjs/cqrs"
import { VideoScriptingService, type VideoScriptStatus } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetVideoScriptStatusQuery } from "./get-video-script-status.query"

@QueryHandler(GetVideoScriptStatusQuery)
/** Answers progress through one workspace-checked read. */
export class GetVideoScriptStatusHandler extends ICQRSHandler<GetVideoScriptStatusQuery, VideoScriptStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly scripting: VideoScriptingService,
    ) {
        super(logger)
    }

    protected override process(query: GetVideoScriptStatusQuery): Promise<VideoScriptStatus> {
        return this.scripting.status(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.id,
        )
    }
}

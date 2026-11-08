import { QueryHandler } from "@nestjs/cqrs"
import { VideoWorkbenchService, type VideoWorkbenchScope } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetVideoScopeQuery } from "./get-video-scope.query"

@QueryHandler(GetVideoScopeQuery)
/** Dispatches videoScope through its checked domain use case. */
export class GetVideoScopeHandler extends ICQRSHandler<GetVideoScopeQuery, VideoWorkbenchScope> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(operation: GetVideoScopeQuery): Promise<VideoWorkbenchScope> {
        return this.service.scope(operation.params.principal.id, operation.params.request.workspaceId)
    }
}

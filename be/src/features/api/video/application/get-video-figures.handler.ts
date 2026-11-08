import { QueryHandler } from "@nestjs/cqrs"
import { VideoWorkbenchService, type WorkbenchFigures } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetVideoFiguresQuery } from "./get-video-figures.query"

@QueryHandler(GetVideoFiguresQuery)
/** Dispatches videoFigures through its checked domain use case. */
export class GetVideoFiguresHandler extends ICQRSHandler<GetVideoFiguresQuery, WorkbenchFigures> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(operation: GetVideoFiguresQuery): Promise<WorkbenchFigures> {
        return this.service.figures(operation.params.principal.id, operation.params.request.workspaceId)
    }
}

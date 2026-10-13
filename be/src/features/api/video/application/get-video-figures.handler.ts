import { QueryHandler } from "@nestjs/cqrs"
import { VideoWorkbenchService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetVideoFiguresQuery } from "./get-video-figures.query"
import type { WorkbenchFigures } from "@modules/domain/video"

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

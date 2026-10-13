import { QueryHandler } from "@nestjs/cqrs"
import { VideoWorkbenchService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetVideoProjectQuery } from "./get-video-project.query"
import type { WorkbenchProject } from "@modules/domain/video"

@QueryHandler(GetVideoProjectQuery)
/** Dispatches videoProject through its checked domain use case. */
export class GetVideoProjectHandler extends ICQRSHandler<GetVideoProjectQuery, WorkbenchProject> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(operation: GetVideoProjectQuery): Promise<WorkbenchProject> {
        return this.service.get(
            operation.params.principal.id,
            operation.params.request.workspaceId,
            operation.params.request.projectId,
        )
    }
}

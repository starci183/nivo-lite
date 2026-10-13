import { QueryHandler } from "@nestjs/cqrs"
import { VideoWorkbenchService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListVideoProjectsQuery } from "./list-video-projects.query"
import type { ListVideoProjectsResult } from "./list-video-projects.contracts"

@QueryHandler(ListVideoProjectsQuery)
/** Dispatches videoProjects through its checked domain use case. */
export class ListVideoProjectsHandler extends ICQRSHandler<ListVideoProjectsQuery, ListVideoProjectsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(operation: ListVideoProjectsQuery): Promise<ListVideoProjectsResult> {
        return this.service.list(
            operation.params.principal.id,
            operation.params.request.workspaceId,
            operation.params.request.includeArchived,
        )
    }
}

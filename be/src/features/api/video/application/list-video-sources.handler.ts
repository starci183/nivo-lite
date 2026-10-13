import { QueryHandler } from "@nestjs/cqrs"
import { VideoWorkbenchService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListVideoSourcesQuery } from "./list-video-sources.query"
import type { ListVideoSourcesResult } from "./list-video-sources.contracts"

@QueryHandler(ListVideoSourcesQuery)
/** Dispatches videoSources through its checked domain use case. */
export class ListVideoSourcesHandler extends ICQRSHandler<ListVideoSourcesQuery, ListVideoSourcesResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(operation: ListVideoSourcesQuery): Promise<ListVideoSourcesResult> {
        return this.service.sources(operation.params.principal.id, operation.params.request.workspaceId)
    }
}

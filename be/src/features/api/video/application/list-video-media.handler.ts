import { QueryHandler } from "@nestjs/cqrs"
import { VideoMediaService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListVideoMediaQuery } from "./list-video-media.query"
import type { ListVideoMediaResult } from "./list-video-media.contracts"

@QueryHandler(ListVideoMediaQuery)
/** Dispatches videoMedia through its checked domain use case. */
export class ListVideoMediaHandler extends ICQRSHandler<ListVideoMediaQuery, ListVideoMediaResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoMediaService,
    ) {
        super(logger)
    }

    protected override process(operation: ListVideoMediaQuery): Promise<ListVideoMediaResult> {
        return this.service.list(operation.params.principal.id, operation.params.request.workspaceId)
    }
}

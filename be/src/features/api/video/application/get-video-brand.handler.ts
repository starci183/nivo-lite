import { QueryHandler } from "@nestjs/cqrs"
import { VideoWorkbenchService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetVideoBrandQuery } from "./get-video-brand.query"
import type { BrandKit } from "@modules/domain/video"

@QueryHandler(GetVideoBrandQuery)
/** Dispatches videoBrand through its checked domain use case. */
export class GetVideoBrandHandler extends ICQRSHandler<GetVideoBrandQuery, BrandKit> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(operation: GetVideoBrandQuery): Promise<BrandKit> {
        return this.service.brand(operation.params.principal.id, operation.params.request.workspaceId)
    }
}

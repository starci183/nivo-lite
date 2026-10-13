import { QueryHandler } from "@nestjs/cqrs"
import { VideoRenderStatusService } from "@modules/domain/video-renders"
import type { RenderStatus } from "@modules/domain/video-renders"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetRenderStatusQuery } from "./get-render-status.query"

@QueryHandler(GetRenderStatusQuery)
/** Proves workspace membership before reading the render's public progress and output. */
export class GetRenderStatusHandler extends ICQRSHandler<GetRenderStatusQuery, RenderStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly status: VideoRenderStatusService,
    ) {
        super(logger)
    }

    protected override process(query: GetRenderStatusQuery): Promise<RenderStatus> {
        return this.status.forMember(query.params.principal.id, query.params.request)
    }
}

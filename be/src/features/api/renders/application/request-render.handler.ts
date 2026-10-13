import { CommandHandler } from "@nestjs/cqrs"
import { VideoService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RequestRenderResult } from "./request-render.contracts"
import { RequestRenderCommand } from "./request-render.command"

@CommandHandler(RequestRenderCommand)
/** Queues the render of a project for the authenticated principal through one domain-service call; the render enqueues its job. */
export class RequestRenderHandler extends ICQRSHandler<RequestRenderCommand, RequestRenderResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly videoService: VideoService,
    ) {
        super(logger)
    }

    protected override process(command: RequestRenderCommand): Promise<RequestRenderResult> {
        return this.videoService.requestRender(command.params.principal.id, command.params.request.projectId)
    }
}

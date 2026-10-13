import { CommandHandler } from "@nestjs/cqrs"
import { VideoMediaService } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateVideoMediaUploadCommand } from "./create-video-media-upload.command"
import type { VideoMediaTicket } from "@modules/domain/video"

@CommandHandler(CreateVideoMediaUploadCommand)
/** Dispatches createVideoMediaUpload through its checked domain use case. */
export class CreateVideoMediaUploadHandler extends ICQRSHandler<CreateVideoMediaUploadCommand, VideoMediaTicket> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: VideoMediaService,
    ) {
        super(logger)
    }

    protected override process(operation: CreateVideoMediaUploadCommand): Promise<VideoMediaTicket> {
        return this.service.createUpload(
            operation.params.principal.id,
            operation.params.request.workspaceId,
            operation.params.request,
        )
    }
}

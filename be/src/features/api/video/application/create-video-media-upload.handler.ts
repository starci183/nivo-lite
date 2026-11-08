import { CommandHandler } from "@nestjs/cqrs"
import { VideoMediaService, type VideoMediaTicket } from "@modules/domain/video"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { CreateVideoMediaUploadCommand } from "./create-video-media-upload.command"

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

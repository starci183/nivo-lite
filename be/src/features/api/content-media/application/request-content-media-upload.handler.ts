import { CommandHandler } from "@nestjs/cqrs"
import { ContentMediaService } from "@modules/domain/content-media"
import type { ContentMediaUpload } from "@modules/domain/content-media"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestContentMediaUploadCommand } from "./request-content-media-upload.command"

@CommandHandler(RequestContentMediaUploadCommand)
/** Issues a unique upload address through the owner's or manager's media service. */
export class RequestContentMediaUploadHandler extends ICQRSHandler<
    RequestContentMediaUploadCommand,
    ContentMediaUpload
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly media: ContentMediaService,
    ) {
        super(logger)
    }

    protected override process(command: RequestContentMediaUploadCommand): Promise<ContentMediaUpload> {
        return this.media.requestUpload(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}

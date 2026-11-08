import { CommandHandler } from "@nestjs/cqrs"
import { AvatarsService, type AvatarUpload } from "@modules/domain/avatars"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RequestMyAvatarUploadCommand } from "./request-my-avatar-upload.command"

@CommandHandler(RequestMyAvatarUploadCommand)
/** Issues the upload address of the caller's own picture through the avatars service. */
export class RequestMyAvatarUploadHandler extends ICQRSHandler<RequestMyAvatarUploadCommand, AvatarUpload> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly avatars: AvatarsService,
    ) {
        super(logger)
    }

    protected override process(command: RequestMyAvatarUploadCommand): Promise<AvatarUpload> {
        return this.avatars.requestPersonUpload(command.params.request)
    }
}

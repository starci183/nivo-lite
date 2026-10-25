import { CommandHandler } from "@nestjs/cqrs"
import { AvatarsService } from "@modules/domain/avatars"
import type { AvatarUpload } from "@modules/domain/avatars"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestAgentAvatarUploadCommand } from "./request-agent-avatar-upload.command"

@CommandHandler(RequestAgentAvatarUploadCommand)
/** Issues the upload address of an agent picture through the avatars service. */
export class RequestAgentAvatarUploadHandler extends ICQRSHandler<RequestAgentAvatarUploadCommand, AvatarUpload> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly avatars: AvatarsService,
    ) {
        super(logger)
    }

    protected override process(command: RequestAgentAvatarUploadCommand): Promise<AvatarUpload> {
        return this.avatars.requestAgentUpload(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}

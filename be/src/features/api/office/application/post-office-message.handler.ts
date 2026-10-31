import { CommandHandler } from "@nestjs/cqrs"
import { OfficeTagService } from "@modules/domain/office-command-candidates"
import type { PostedMessage } from "@modules/domain/messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PostOfficeMessageCommand } from "./post-office-message.command"

@CommandHandler(PostOfficeMessageCommand)
/** Posts the line through the Office tag service: the line and a wake for each agent it tags the caller may ask, in one transaction. */
export class PostOfficeMessageHandler extends ICQRSHandler<PostOfficeMessageCommand, PostedMessage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tags: OfficeTagService,
    ) {
        super(logger)
    }

    protected override process(command: PostOfficeMessageCommand): Promise<PostedMessage> {
        return this.tags.post(command.params.principal.id, command.params.request.workspaceId, command.params.request)
    }
}

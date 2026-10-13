import { CommandHandler } from "@nestjs/cqrs"
import { SetupChatService } from "@modules/domain/modules"
import type { SetupMessageRecord } from "@modules/domain/module-setup-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PostSetupMessageCommand } from "./post-setup-message.command"

@CommandHandler(PostSetupMessageCommand)
/** Stores the message through the setup chat service. */
export class PostSetupMessageHandler extends ICQRSHandler<PostSetupMessageCommand, SetupMessageRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: SetupChatService,
    ) {
        super(logger)
    }

    protected override process(command: PostSetupMessageCommand): Promise<SetupMessageRecord> {
        return this.chat.postMessage(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.setupSessionId,
            command.params.request.text,
            command.params.request.locale,
        )
    }
}

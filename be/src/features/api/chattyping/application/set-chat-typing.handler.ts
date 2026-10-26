import { CommandHandler } from "@nestjs/cqrs"
import { ChatTypingService } from "@modules/domain/chat-typing"
import type { ChatTypingSignal } from "@modules/domain/chat-typing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetChatTypingCommand } from "./set-chat-typing.command"

@CommandHandler(SetChatTypingCommand)
/** Publishes a typing hint through the domain's target authorization. */
export class SetChatTypingHandler extends ICQRSHandler<SetChatTypingCommand, ChatTypingSignal> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly typing: ChatTypingService,
    ) {
        super(logger)
    }

    protected override process(command: SetChatTypingCommand): Promise<ChatTypingSignal> {
        return this.typing.set(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.target,
            command.params.request.typing,
        )
    }
}

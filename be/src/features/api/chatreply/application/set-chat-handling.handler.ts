import { CommandHandler } from "@nestjs/cqrs"
import { ChatReplyService } from "@modules/domain/chatreply"
import type { ChatHandlingResult } from "@modules/domain/chatreply"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetChatHandlingCommand } from "./set-chat-handling.command"

@CommandHandler(SetChatHandlingCommand)
/** Takes over a customer conversation or releases it to the AI. */
export class SetChatHandlingHandler extends ICQRSHandler<SetChatHandlingCommand, ChatHandlingResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: ChatReplyService,
    ) {
        super(logger)
    }

    protected override process(command: SetChatHandlingCommand): Promise<ChatHandlingResult> {
        return this.service.setHandling(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.conversationId,
            command.params.request.takeOver,
            command.params.request.locale,
        )
    }
}

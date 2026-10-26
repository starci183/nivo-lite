import { QueryHandler } from "@nestjs/cqrs"
import { ChatTypingService } from "@modules/domain/chat-typing"
import type { ChatTypingChannel } from "@modules/domain/chat-typing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatTypingChannelQuery } from "./chat-typing-channel.query"

@QueryHandler(ChatTypingChannelQuery)
/** Describes a typing channel through the domain's target authorization. */
export class ChatTypingChannelHandler extends ICQRSHandler<ChatTypingChannelQuery, ChatTypingChannel> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly typing: ChatTypingService,
    ) {
        super(logger)
    }

    protected override process(query: ChatTypingChannelQuery): Promise<ChatTypingChannel> {
        return this.typing.channel(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.target,
        )
    }
}

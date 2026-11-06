import { Injectable } from "@nestjs/common"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { CodeDelivery, CodeDeliveryParams } from "./loyalty.contracts"
import { LoyaltyLogEvent } from "./loyalty.log-events"

const PUSH_CHANNELS: ReadonlySet<string> = new Set(["telegram", "zalo"])

@Injectable()
/** Carries a public loyalty code into the customer's existing chat with the shop. */
export class LoyaltyCodeDeliveryService implements CodeDelivery {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly conversations: ChatConversationsService,
        private readonly messages: ChatMessagesService,
        private readonly channels: ChannelDeliveryService,
        @InjectIds() private readonly ids: Ids,
    ) {}

    /** Stores and sends only to a supported conversation owned by the programme's workspace. */
    async send(params: CodeDeliveryParams): Promise<boolean> {
        const target = await this.conversations.targetOf(params.workspaceId, params.conversationId)
        if (target.kind !== "ok" || !PUSH_CHANNELS.has(target.value.channel)) return false
        const stored = await this.messages.storeAgentLine({
            workspaceId: params.workspaceId,
            conversationId: params.conversationId,
            body: params.text,
            key: this.ids.next(),
        })
        return this.channels
            .deliver({
                workspaceId: params.workspaceId,
                conversationId: params.conversationId,
                messageId: stored.id,
                text: params.text,
            })
            .then(
                (result) => result.delivered,
                (cause: unknown) => {
                    this.logger.error(LoyaltyLogEvent.CodeDeliveryFailed, cause, {
                        conversationId: params.conversationId,
                    })
                    return false
                },
            )
    }
}

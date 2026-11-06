import { Injectable } from "@nestjs/common"
import type { ChatConversationTarget, OptionalChatCustomerProfile } from "@modules/domain/chat-records"
import { InjectZalo } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelsLogEvent } from "./channels.log-events"
import { customerIdOf } from "./customer-id.policy"
import { ZaloCredentialsService } from "./zalo-credentials.service"

@Injectable()
/** What a channel says of the customer of a conversation (name and picture): only Zalo is asked, and a refusal of any kind is an answer of null, never a throw. */
export class ChannelCustomerProfileService {
    constructor(
        private readonly credentials: ZaloCredentialsService,
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The customer's profile, or null when the channel will not say: another channel, a conversation not tied to a connection, or a failed lookup (logged). */
    async profileOf(target: ChatConversationTarget): Promise<OptionalChatCustomerProfile> {
        if (target.channel !== "zalo" || target.externalId === null || target.connectionId === null) return null
        try {
            const token = await this.credentials.accessToken(target.connectionId)
            return await this.zalo.userProfile(token, customerIdOf(target.externalId))
        } catch (cause) {
            this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, { conversationId: target.id, channel: "zalo" })
            return null
        }
    }
}

import {
    CustomerTurnRuntimeService,
    CustomerOutcomesService,
    CustomerTurnsModule,
} from "@modules/domain/customer-turns"
import type { DynamicModule } from "@nestjs/common"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { AgentConversationsModule } from "@modules/domain/agent-conversations"
import { AgentMessagesModule } from "@modules/domain/agent-messages"
import { ChannelsModule } from "@modules/domain/channels"
import { ChannelReceiptsModule } from "@modules/domain/channel-receipts"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { ConversationsModule } from "@modules/domain/conversations"
import { TelegramInboxModule } from "@modules/domain/telegram-inbox"
import { ZaloInboxModule } from "@modules/domain/zalo-inbox"
import { ZaloWizardDraftsModule } from "@modules/domain/zalo-wizard-drafts"
import { MailModule } from "@modules/integrations/mail"
import { TelegramModule } from "@modules/integrations/telegram"
import { ZaloModule } from "@modules/integrations/zalo"
import type { ApiOptions } from "../api.options"
/** The messaging area of the API, in registration order. */
export const messagingModules = (options: ApiOptions): Array<DynamicModule> => [
    TelegramModule.register({ isGlobal: true, ...options.telegram }),
    ZaloModule.register({ isGlobal: true, ...options.zalo }),
    MailModule.register({ isGlobal: true, ...options.mail }),
    ConnectionSecretsModule.register({ isGlobal: true, ...options.connectionSecrets }),
    AgentConversationsModule.register({ isGlobal: true }),
    AgentMessagesModule.register({ isGlobal: true }),
    ChannelReceiptsModule.register({ isGlobal: true }),
    InboundEventsModule.register({ isGlobal: true }),
    ChannelsModule.register({ isGlobal: true, ...options.channels }),
    ConversationsModule.register({
        isGlobal: true,
        runtime: CustomerTurnRuntimeService,
        outcomes: CustomerOutcomesService,
    }),
    CustomerTurnsModule.register({ isGlobal: true }),
    TelegramInboxModule.register({ isGlobal: true }),
    ZaloInboxModule.register({ isGlobal: true }),
    ZaloWizardDraftsModule.register({ isGlobal: true }),
]

import {
    CUSTOMER_TURNS_ERROR_KINDS,
    CUSTOMER_TURNS_MESSAGES,
    CustomerOutcomesService,
    CustomerTurnRuntimeService,
    CustomerTurnsModule,
    customerTurnsOptionsOf,
    GATEWAY_TURNS_MESSAGES,
} from "@modules/domain/customer-turns"
import type { DynamicModule } from "@nestjs/common"
import { MCP_GATEWAY_ERROR_KINDS, MCP_GATEWAY_MESSAGES, McpGatewayModule } from "@modules/domain/mcp-gateway"
import { NATIVE_TOOL_ADAPTERS, NativeToolsModule } from "@modules/domain/native-tools"
import {
    INBOUND_EVENTS_ERROR_KINDS,
    INBOUND_EVENTS_MESSAGES,
    InboundEventsModule,
} from "@modules/domain/inbound-events"
import {
    AGENT_CONVERSATIONS_ERROR_KINDS,
    AGENT_CONVERSATIONS_MESSAGES,
    AgentConversationsModule,
} from "@modules/domain/agent-conversations"
import {
    AGENT_MESSAGES_ERROR_KINDS,
    AGENT_MESSAGES_MESSAGES,
    AgentMessagesModule,
} from "@modules/domain/agent-messages"
import { ChatActivityModule } from "@modules/domain/chat-activity"
import { CHAT_MARKERS_ERROR_KINDS, CHAT_MARKERS_MESSAGES, ChatMarkersModule } from "@modules/domain/chat-markers"
import { ChatTypingModule } from "@modules/domain/chat-typing"
import { CHANNELS_ERROR_KINDS, CHANNELS_MESSAGES, ChannelsModule } from "@modules/domain/channels"
import { ChannelReceiptsModule } from "@modules/domain/channel-receipts"
import {
    CONNECTION_SECRETS_ERROR_KINDS,
    CONNECTION_SECRETS_MESSAGES,
    ConnectionSecretsModule,
} from "@modules/domain/connection-secrets"
import { CONVERSATIONS_ERROR_KINDS, CONVERSATIONS_MESSAGES, ConversationsModule } from "@modules/domain/conversations"
import { TelegramInboxModule } from "@modules/domain/telegram-inbox"
import { ZaloInboxModule, ZaloInboxPageReadService } from "@modules/domain/zalo-inbox"
import { ZaloWizardDraftsModule } from "@modules/domain/zalo-wizard-drafts"
import { MAIL_ERROR_KINDS, MAIL_MESSAGES, MailModule } from "@modules/integrations/mail"
import { TELEGRAM_ERROR_KINDS, TELEGRAM_MESSAGES, TelegramModule } from "@modules/integrations/telegram"
import { ZALO_ERROR_KINDS, ZALO_MESSAGES, ZaloModule } from "@modules/integrations/zalo"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The messaging area of the API, in registration order. */
export const messagingModules = (options: ApiOptions): Array<DynamicModule> => [
    TelegramModule.register({ isGlobal: true, ...options.telegram }),
    ZaloModule.register({ isGlobal: true, ...options.zalo }),
    MailModule.register({ isGlobal: true, ...options.mail }),
    ConnectionSecretsModule.register({ isGlobal: true, ...options.connectionSecrets }),
    AgentConversationsModule.register({ isGlobal: true }),
    ChatActivityModule.register({ isGlobal: true }),
    AgentMessagesModule.register({ isGlobal: true }),
    ChatMarkersModule.register({ isGlobal: true }),
    ChatTypingModule.register({ isGlobal: true }),
    ChannelReceiptsModule.register({ isGlobal: true }),
    InboundEventsModule.register({ isGlobal: true }),
    ChannelsModule.register({ isGlobal: true, ...options.channels, ports: { inbox: ZaloInboxPageReadService } }),
    ConversationsModule.register({
        isGlobal: true,
        runtime: CustomerTurnRuntimeService,
        outcomes: CustomerOutcomesService,
    }),
    NativeToolsModule.register({ isGlobal: true }),
    McpGatewayModule.register({
        isGlobal: true,
        ...options.mcpGateway,
        console: true,
        keyCheck: true,
        natives: NATIVE_TOOL_ADAPTERS,
    }),
    CustomerTurnsModule.register({ isGlobal: true, ...customerTurnsOptionsOf(options.connections.publicApiUrl) }),
    TelegramInboxModule.register({ isGlobal: true }),
    ZaloInboxModule.register({ isGlobal: true }),
    ZaloWizardDraftsModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const messagingErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENT_CONVERSATIONS_ERROR_KINDS,
    AGENT_MESSAGES_ERROR_KINDS,
    INBOUND_EVENTS_ERROR_KINDS,
    CHANNELS_ERROR_KINDS,
    CONNECTION_SECRETS_ERROR_KINDS,
    CONVERSATIONS_ERROR_KINDS,
    MAIL_ERROR_KINDS,
    TELEGRAM_ERROR_KINDS,
    ZALO_ERROR_KINDS,
    CHAT_MARKERS_ERROR_KINDS,
    MCP_GATEWAY_ERROR_KINDS,
    CUSTOMER_TURNS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const messagingMessages: ReadonlyArray<MessageBundle> = [
    AGENT_CONVERSATIONS_MESSAGES,
    AGENT_MESSAGES_MESSAGES,
    INBOUND_EVENTS_MESSAGES,
    CHANNELS_MESSAGES,
    CONNECTION_SECRETS_MESSAGES,
    CONVERSATIONS_MESSAGES,
    CUSTOMER_TURNS_MESSAGES,
    MAIL_MESSAGES,
    TELEGRAM_MESSAGES,
    ZALO_MESSAGES,
    CHAT_MARKERS_MESSAGES,
    MCP_GATEWAY_MESSAGES,
    GATEWAY_TURNS_MESSAGES,
]

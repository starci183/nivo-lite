import { AgentKnowledgeModule } from "@modules/domain/agent-knowledge"
import type { DynamicModule } from "@nestjs/common"
import { MCP_GATEWAY_ERROR_KINDS, MCP_GATEWAY_MESSAGES, McpGatewayModule } from "@modules/domain/mcp-gateway"
import {
    ENTITY_ENGINE_DOOR_ERROR_KINDS,
    ENTITY_ENGINE_DOOR_MESSAGES,
    EntityEngineDoorModule,
} from "@modules/domain/entity-engine-door"
import { NATIVE_TOOL_ADAPTERS, NativeToolsModule } from "@modules/domain/native-tools"
import {
    INBOUND_EVENTS_ERROR_KINDS,
    INBOUND_EVENTS_MESSAGES,
    InboundEventsModule,
} from "@modules/domain/inbound-events"
import {
    INBOX_LEADS_ERROR_KINDS,
    INBOX_LEADS_MESSAGES,
    InboxLeadsModule,
} from "@modules/domain/inbox-leads"
import { ChatActivityModule } from "@modules/domain/chat-activity"
import { CHAT_RECORDS_ERROR_KINDS, CHAT_RECORDS_MESSAGES, ChatRecordsModule } from "@modules/domain/chat-records"
import { CHAT_TYPING_ERROR_KINDS, CHAT_TYPING_MESSAGES, ChatTypingModule } from "@modules/domain/chat-typing"
import { STORAGE_ASSETS, STORAGE_OBJECTS } from "@modules/integrations/object-storage"
import {
    TEAM_CHAT_ERROR_KINDS,
    TEAM_CHAT_MESSAGES,
    TeamChatModule,
    TeamChatNativeService,
} from "@modules/domain/team-chat"
import {
    CHANNELS_ERROR_KINDS,
    CHANNELS_MESSAGES,
    ChannelsModule,
    ChatSendNativeService,
} from "@modules/domain/channels"
import { ChannelReceiptsModule } from "@modules/domain/channel-receipts"
import { TeamChatTurnsModule } from "@modules/domain/team-chat-turns"
import {
    CONNECTION_SECRETS_ERROR_KINDS,
    CONNECTION_SECRETS_MESSAGES,
    ConnectionSecretsModule,
} from "@modules/domain/connection-secrets"
import { CONVERSATIONS_ERROR_KINDS, CONVERSATIONS_MESSAGES, ConversationsModule } from "@modules/domain/conversations"
import { TelegramInboxModule } from "@modules/domain/telegram-inbox"
import { ZaloInboxModule, ZaloInboxPageReadService } from "@modules/domain/zalo-inbox"
import { ZaloProviderModule } from "@modules/domain/zalo-provider"
import { ZaloWizardDraftsModule } from "@modules/domain/zalo-wizard-drafts"
import { IMAGE, IMAGE_ERROR_KINDS, IMAGE_MESSAGES, ImageModule } from "@modules/integrations/image"
import { MAIL_ERROR_KINDS, MAIL_MESSAGES, MailModule } from "@modules/integrations/mail"
import { SEPAY_ERROR_KINDS, SEPAY_MESSAGES, SepayModule } from "@modules/integrations/sepay"
import { TELEGRAM_ERROR_KINDS, TELEGRAM_MESSAGES, TelegramModule } from "@modules/integrations/telegram"
import { ZALO_ERROR_KINDS, ZALO_MESSAGES, ZaloModule } from "@modules/integrations/zalo"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The messaging area of the API, in registration order. */
export const messagingModules = (options: ApiOptions): Array<DynamicModule> => [
    TelegramModule.register({ isGlobal: true, ...options.telegram }),
    SepayModule.register({ isGlobal: true, ...options.sepay }),
    ZaloModule.register({ isGlobal: true, ...options.zalo }),
    ImageModule.register({ isGlobal: true }),
    MailModule.register({ isGlobal: true, ...options.mail }),
    ConnectionSecretsModule.register({ isGlobal: true, ...options.connectionSecrets }),
    ChatRecordsModule.register({ isGlobal: true }),
    ChatActivityModule.register({ isGlobal: true }),
    ChatTypingModule.register({ isGlobal: true }),
    TeamChatModule.register({ isGlobal: true, storage: STORAGE_OBJECTS }),
    TeamChatTurnsModule.register({ isGlobal: true }),
    ChannelReceiptsModule.register({ isGlobal: true }),
    InboundEventsModule.register({ isGlobal: true }),
    InboxLeadsModule.register({ isGlobal: true }),
    ChannelsModule.register({
        isGlobal: true,
        ...options.channels,
        ports: { inbox: ZaloInboxPageReadService },
        image: IMAGE,
        storage: STORAGE_ASSETS,
        publicApiUrl: options.connections.publicApiUrl,
    }),
    ConversationsModule.register({ isGlobal: true }),
    NativeToolsModule.register({ isGlobal: true }),
    McpGatewayModule.register({
        isGlobal: true,
        ...options.mcpGateway,
        console: true,
        keyCheck: true,
        natives: [...NATIVE_TOOL_ADAPTERS, ChatSendNativeService, TeamChatNativeService],
    }),
    EntityEngineDoorModule.register({ isGlobal: true }),
    // What an agent knows (the lens, the recall, the knowledge search): one registration, reachable from every capability.
    AgentKnowledgeModule.register({ isGlobal: true }),
    TelegramInboxModule.register({ isGlobal: true }),
    ZaloInboxModule.register({ isGlobal: true }),
    ZaloProviderModule.register({ isGlobal: true, ...options.zaloProvider }),
    ZaloWizardDraftsModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const messagingErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    CHAT_RECORDS_ERROR_KINDS,
    INBOUND_EVENTS_ERROR_KINDS,
    INBOX_LEADS_ERROR_KINDS,
    CHANNELS_ERROR_KINDS,
    CONNECTION_SECRETS_ERROR_KINDS,
    CONVERSATIONS_ERROR_KINDS,
    MAIL_ERROR_KINDS,
    TELEGRAM_ERROR_KINDS,
    SEPAY_ERROR_KINDS,
    ZALO_ERROR_KINDS,
    IMAGE_ERROR_KINDS,
    CHAT_TYPING_ERROR_KINDS,
    TEAM_CHAT_ERROR_KINDS,
    MCP_GATEWAY_ERROR_KINDS,
    ENTITY_ENGINE_DOOR_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const messagingMessages: ReadonlyArray<MessageBundle> = [
    CHAT_RECORDS_MESSAGES,
    INBOUND_EVENTS_MESSAGES,
    INBOX_LEADS_MESSAGES,
    CHANNELS_MESSAGES,
    CONNECTION_SECRETS_MESSAGES,
    CONVERSATIONS_MESSAGES,
    MAIL_MESSAGES,
    TELEGRAM_MESSAGES,
    SEPAY_MESSAGES,
    ZALO_MESSAGES,
    IMAGE_MESSAGES,
    CHAT_TYPING_MESSAGES,
    TEAM_CHAT_MESSAGES,
    MCP_GATEWAY_MESSAGES,
    ENTITY_ENGINE_DOOR_MESSAGES,
]

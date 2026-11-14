import { AgentKnowledgeModule } from "@modules/domain/agent-knowledge"
import type { DynamicModule } from "@nestjs/common"
import { TOOLS_ERROR_KINDS, TOOLS_MESSAGES, ToolsModule } from "@modules/domain/tools"
import {
    ENTITY_ENGINE_DOOR_ERROR_KINDS,
    ENTITY_ENGINE_DOOR_MESSAGES,
    EntityEngineDoorModule,
} from "@modules/domain/entity-engine-door"
import { NATIVE_TOOL_ADAPTERS, NativeToolsModule } from "@modules/domain/native-tools"
import { VideoComposeNativeService } from "@modules/domain/video-compose"
import { RecordFileSinkService } from "@modules/domain/media-tools"
import {
    INBOUND_EVENTS_ERROR_KINDS,
    INBOUND_EVENTS_MESSAGES,
    InboundEventsModule,
} from "@modules/domain/inbound-events"
import {
    INBOX_LEADS_ERROR_KINDS,
    WEBSITE_INTAKE_MESSAGES,
    WebsiteIntakeModule,
} from "@modules/domain/inbox-leads"
import { ChatActivityModule } from "@modules/domain/chat-activity"
import { CHAT_TYPING_ERROR_KINDS, CHAT_TYPING_MESSAGES, ChatTypingModule } from "@modules/domain/chat-typing"
import { STORAGE_OBJECTS } from "@modules/integrations/object-storage"
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
    CustomerProfileNativeService,
    CustomerMessageNativeService,
} from "@modules/domain/channels"
import { TeamChatTurnsModule } from "@modules/domain/team-chat-turns"
import {
    CONNECTION_SECRETS_ERROR_KINDS,
    CONNECTION_SECRETS_MESSAGES,
    ConnectionSecretsModule,
} from "@modules/domain/connection-secrets"
import { CONVERSATIONS_ERROR_KINDS, CONVERSATIONS_MESSAGES, ConversationsModule } from "@modules/domain/conversations"
import {
    EMAIL_MESSAGES_ERROR_KINDS,
    EMAIL_MESSAGES_MESSAGES,
    EmailMessagesModule,
} from "@modules/domain/email-messages"
import { TelegramInboxModule } from "@modules/domain/telegram-inbox"
import { ZaloInboxModule, ZaloInboxPageReadService, ZaloInboxTokensService } from "@modules/domain/zalo-inbox"
import { ZaloProviderModule } from "@modules/domain/zalo-provider"
import { ZaloWizardDraftsModule } from "@modules/domain/zalo-wizard-drafts"
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
    MailModule.register({ isGlobal: true, ...options.mail }),
    ConnectionSecretsModule.register({ isGlobal: true, ...options.connectionSecrets }),
    ChatActivityModule.register({ isGlobal: true }),
    ChatTypingModule.register({ isGlobal: true }),
    TeamChatModule.register({ isGlobal: true, storage: STORAGE_OBJECTS }),
    TeamChatTurnsModule.register({ isGlobal: true }),
    InboundEventsModule.register({ isGlobal: true }),
    WebsiteIntakeModule.register({ isGlobal: true }),
    ChannelsModule.register({
        isGlobal: true,
        ...options.channels,
        ports: { inbox: ZaloInboxPageReadService },
    }),
    ConversationsModule.register({ isGlobal: true }),
    // A provider's file (a speech clip, a generated video) is staged in the records' file store, then put into a record by the node.
    NativeToolsModule.register({ isGlobal: true, fileSink: RecordFileSinkService }),
    ToolsModule.register({
        isGlobal: true,
        ...options.toolsConfig,
        console: true,
        // The api's own families beside the shared ones: the compose purpose is registered in this app only (`VideoComposeModule`).
        natives: [
            ...NATIVE_TOOL_ADAPTERS,
            CustomerMessageNativeService,
            CustomerProfileNativeService,
            TeamChatNativeService,
            VideoComposeNativeService,
        ],
    }),
    EntityEngineDoorModule.register({ isGlobal: true }),
    // What an agent knows (the lens, the recall, the knowledge search): one registration, reachable from every capability.
    AgentKnowledgeModule.register({ isGlobal: true }),
    TelegramInboxModule.register({ isGlobal: true }),
    ZaloInboxModule.register({ isGlobal: true }),
    // The provider reads with the connection's token through its port; the credential keeper behind it is the channels capability's.
    ZaloProviderModule.register({ isGlobal: true, ...options.zaloProvider, ports: { tokens: ZaloInboxTokensService } }),
    ZaloWizardDraftsModule.register({ isGlobal: true }),
    EmailMessagesModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const messagingErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    INBOUND_EVENTS_ERROR_KINDS,
    INBOX_LEADS_ERROR_KINDS,
    CHANNELS_ERROR_KINDS,
    CONNECTION_SECRETS_ERROR_KINDS,
    CONVERSATIONS_ERROR_KINDS,
    MAIL_ERROR_KINDS,
    TELEGRAM_ERROR_KINDS,
    SEPAY_ERROR_KINDS,
    ZALO_ERROR_KINDS,
    CHAT_TYPING_ERROR_KINDS,
    TEAM_CHAT_ERROR_KINDS,
    TOOLS_ERROR_KINDS,
    ENTITY_ENGINE_DOOR_ERROR_KINDS,
    EMAIL_MESSAGES_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const messagingMessages: ReadonlyArray<MessageBundle> = [
    INBOUND_EVENTS_MESSAGES,
    WEBSITE_INTAKE_MESSAGES,
    CHANNELS_MESSAGES,
    CONNECTION_SECRETS_MESSAGES,
    CONVERSATIONS_MESSAGES,
    MAIL_MESSAGES,
    TELEGRAM_MESSAGES,
    SEPAY_MESSAGES,
    ZALO_MESSAGES,
    CHAT_TYPING_MESSAGES,
    TEAM_CHAT_MESSAGES,
    TOOLS_MESSAGES,
    ENTITY_ENGINE_DOOR_MESSAGES,
    EMAIL_MESSAGES_MESSAGES,
]

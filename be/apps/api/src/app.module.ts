import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { ChannelsHttpModule } from "@features/api/channels"
import { CheckConnectionHealthQueueModule } from "@features/jobs/check-connection-health"
import { RefreshZaloTokensQueueModule } from "@features/jobs/refresh-zalo-tokens"
import { RunChatTurnQueueModule } from "@features/jobs/run-chat-turn"
import { TelegramHttpModule } from "@features/webhooks/telegram"
import { ZaloHttpModule } from "@features/webhooks/zalo"
import { ExternalApiHttpModule } from "@features/api/external-api"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import { WorkspacesHttpModule } from "@features/api/workspaces"
import { AGENT_CONVERSATIONS_ERROR_KINDS, AGENT_CONVERSATIONS_MESSAGES, AgentConversationsModule } from "@modules/domain/agent-conversations"
import { AGENT_MESSAGES_ERROR_KINDS, AGENT_MESSAGES_MESSAGES, AgentMessagesModule } from "@modules/domain/agent-messages"
import { CHANNELS_ERROR_KINDS, CHANNELS_MESSAGES, ChannelsModule } from "@modules/domain/channels"
import { ChannelReceiptsModule } from "@modules/domain/channel-receipts"
import {
    CONNECTION_SECRETS_ERROR_KINDS,
    CONNECTION_SECRETS_MESSAGES,
    ConnectionSecretsModule,
} from "@modules/domain/connection-secrets"
import { CONNECTIONS_ERROR_KINDS, CONNECTIONS_MESSAGES, ConnectionsModule } from "@modules/domain/connections"
import { CONVERSATIONS_ERROR_KINDS, CONVERSATIONS_MESSAGES, ConversationsModule } from "@modules/domain/conversations"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { TelegramInboxModule } from "@modules/domain/telegram-inbox"
import { ZaloInboxModule } from "@modules/domain/zalo-inbox"
import { AuthGuard, IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule } from "@modules/domain/identity"
import {
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_AUTH,
    SUPABASE_ERROR_KINDS,
    SupabaseModule,
    createSupabaseAccessTokenVerifier,
} from "@modules/integrations/supabase"
import { HttpModule, HTTP_ERROR_KINDS, HTTP_MESSAGES } from "@modules/platform/http"
import { MAIL_ERROR_KINDS, MAIL_MESSAGES, MailModule } from "@modules/integrations/mail"
import { TELEGRAM_ERROR_KINDS, TELEGRAM_MESSAGES, TelegramModule } from "@modules/integrations/telegram"
import { ZALO_ERROR_KINDS, ZALO_MESSAGES, ZaloModule } from "@modules/integrations/zalo"
import { CONNECTION_HEALTH_SCHEDULER } from "@modules/queues/connection-health"
import { ZALO_REFRESH_SCHEDULER } from "@modules/queues/zalo-refresh"
import { LivenessModule } from "@modules/domain/liveness"
import { PUBLIC_API_ERROR_KINDS, PUBLIC_API_MESSAGES, PublicApiModule } from "@modules/domain/public-api"
import { EventsModule } from "@modules/domain/events"
import {
    WORKSPACE_INVITES_ERROR_KINDS,
    WORKSPACE_INVITES_MESSAGES,
    WorkspaceInvitesModule,
} from "@modules/domain/workspace-invites"
import {
    WORKSPACE_MEMBERS_ERROR_KINDS,
    WORKSPACE_MEMBERS_MESSAGES,
    WorkspaceMembersModule,
} from "@modules/domain/workspace-members"
import { WORKSPACES_ERROR_KINDS, WORKSPACES_MESSAGES, WorkspacesModule } from "@modules/domain/workspaces"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsFilter, ErrorsModule } from "@modules/platform/errors"
import {
    HTTP_SECURITY_ERROR_KINDS,
    HTTP_SECURITY_MESSAGES,
    HttpSecurityModule,
    OriginGuard,
    RateLimitGuard,
} from "@modules/platform/http-security"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { JOBS_ERROR_KINDS, JOBS_MESSAGES, JobsModule } from "@modules/platform/jobs"
import { QUEUE_ERROR_KINDS, QUEUE_MESSAGES, QueueModule } from "@modules/platform/queue"
import type { ApiOptions } from "./api.options"

@Module({})
/** Composition root of the API: every capability is registered once and the three guards run in a fixed order. */
export class AppModule {
    /** Builds the module from options parsed once at boot; nothing here reads the environment. */
    static register(options: ApiOptions): DynamicModule {
        const verifyAccessToken = createSupabaseAccessTokenVerifier(options.supabase)
        return {
            module: AppModule,
            imports: [
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                I18nModule.register({
                    isGlobal: true,
                    bundles: [
                        AGENT_CONVERSATIONS_MESSAGES,
                        AGENT_MESSAGES_MESSAGES,
                        API_KEYS_MESSAGES,
                        CHANNELS_MESSAGES,
                        CONNECTION_SECRETS_MESSAGES,
                        CONNECTIONS_MESSAGES,
                        CONVERSATIONS_MESSAGES,
                        HTTP_MESSAGES,
                        MAIL_MESSAGES,
                        TELEGRAM_MESSAGES,
                        ZALO_MESSAGES,
                        ERRORS_MESSAGES,
                        HTTP_SECURITY_MESSAGES,
                        IDENTITY_MESSAGES,
                        JOBS_MESSAGES,
                        PUBLIC_API_MESSAGES,
                        QUEUE_MESSAGES,
                        WORKSPACE_INVITES_MESSAGES,
                        WORKSPACE_MEMBERS_MESSAGES,
                        WORKSPACES_MESSAGES,
                    ],
                }),
                ErrorsModule.register({
                    isGlobal: true,
                    kinds: [
                        AGENT_CONVERSATIONS_ERROR_KINDS,
                        AGENT_MESSAGES_ERROR_KINDS,
                        API_KEYS_ERROR_KINDS,
                        CHANNELS_ERROR_KINDS,
                        CONNECTION_SECRETS_ERROR_KINDS,
                        CONNECTIONS_ERROR_KINDS,
                        CONVERSATIONS_ERROR_KINDS,
                        HTTP_ERROR_KINDS,
                        MAIL_ERROR_KINDS,
                        TELEGRAM_ERROR_KINDS,
                        ZALO_ERROR_KINDS,
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        HTTP_SECURITY_ERROR_KINDS,
                        JOBS_ERROR_KINDS,
                        QUEUE_ERROR_KINDS,
                        IDENTITY_ERROR_KINDS,
                        PUBLIC_API_ERROR_KINDS,
                        SUPABASE_ERROR_KINDS,
                        WORKSPACE_INVITES_ERROR_KINDS,
                        WORKSPACE_MEMBERS_ERROR_KINDS,
                        WORKSPACES_ERROR_KINDS,
                    ],
                }),
                CqrsModule.register({ isGlobal: true }),
                HttpSecurityModule.register({
                    isGlobal: true,
                    ...options.httpSecurity,
                }),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: [options.database],
                }),
                QueueModule.register({
                    isGlobal: true,
                    schedulers: [CONNECTION_HEALTH_SCHEDULER, ZALO_REFRESH_SCHEDULER],
                    ...options.queue,
                }),
                JobsModule.register({
                    isGlobal: true,
                    connection: PRIMARY_ENTITY_MANAGER,
                    ...options.jobs,
                }),
                SupabaseModule.register({ isGlobal: true, ...options.supabase }),
                IdentityModule.register({ isGlobal: true, verifyAccessToken }),
                EventsModule.register({ isGlobal: true }),
                WorkspaceMembersModule.register({ isGlobal: true, accounts: SUPABASE_AUTH }),
                WorkspacesModule.register({ isGlobal: true, ...options.workspaces }),
                WorkspaceInvitesModule.register({
                    isGlobal: true,
                    delivery: SUPABASE_AUTH,
                    ...options.workspaceInvites,
                }),
                HttpModule.register({ isGlobal: true }),
                TelegramModule.register({ isGlobal: true, ...options.telegram }),
                ZaloModule.register({ isGlobal: true, ...options.zalo }),
                MailModule.register({ isGlobal: true, ...options.mail }),
                ConnectionsModule.register({ isGlobal: true }),
                ConnectionSecretsModule.register({ isGlobal: true, ...options.connectionSecrets }),
                AgentConversationsModule.register({ isGlobal: true }),
                AgentMessagesModule.register({ isGlobal: true }),
                ChannelReceiptsModule.register({ isGlobal: true }),
                InboundEventsModule.register({ isGlobal: true }),
                ChannelsModule.register({ isGlobal: true, ...options.channels }),
                ConversationsModule.register({ isGlobal: true }),
                TelegramInboxModule.register({ isGlobal: true }),
                ZaloInboxModule.register({ isGlobal: true }),
                LivenessModule.register({ isGlobal: true }),
                ApiKeysModule.register({ isGlobal: true }),
                PublicApiModule.register({ isGlobal: true }),
                ChannelsHttpModule,
                TelegramHttpModule,
                ZaloHttpModule,
                RunChatTurnQueueModule,
                CheckConnectionHealthQueueModule,
                RefreshZaloTokensQueueModule,
                ExternalApiHttpModule,
                SystemHealthHttpModule,
                WorkspacesHttpModule,
            ],
            providers: [
                { provide: SUPABASE_ACCESS_TOKEN_VERIFIER, useValue: verifyAccessToken },
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}

import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { InventoryHttpModule } from "@features/api/inventory"
import { CheckConnectionHealthQueueModule } from "@features/jobs/check-connection-health"
import { CompleteZaloAuthorizationQueueModule } from "@features/jobs/complete-zalo-authorization"
import { RefreshZaloTokensQueueModule } from "@features/jobs/refresh-zalo-tokens"
import { RunChatTurnQueueModule } from "@features/jobs/run-chat-turn"
import { TelegramHttpModule } from "@features/webhooks/telegram"
import { ZaloHttpModule } from "@features/webhooks/zalo"
import { LeadsHttpModule } from "@features/api/leads"
import { AdminHttpModule } from "@features/api/admin"
import { ModulesHttpModule } from "@features/api/modules"
import { ExternalApiHttpModule } from "@features/api/external-api"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import { WorkspacesHttpModule } from "@features/api/workspaces"
import { DeductOrderQueueModule } from "@features/jobs/deduct-order"
import { InventoryCommandQueueModule } from "@features/jobs/inventory-command"
import { ReplenishStockQueueModule } from "@features/jobs/replenish-stock"
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
import { INVENTORY_ERROR_KINDS, INVENTORY_MESSAGES, InventoryModule } from "@modules/domain/inventory"
import { MODULE_OPS_ERROR_KINDS, MODULE_OPS_MESSAGES, ModuleOpsModule } from "@modules/domain/module-ops"
import { HttpModule, HTTP_ERROR_KINDS, HTTP_MESSAGES } from "@modules/platform/http"
import { MAIL_ERROR_KINDS, MAIL_MESSAGES, MailModule } from "@modules/integrations/mail"
import { TELEGRAM_ERROR_KINDS, TELEGRAM_MESSAGES, TelegramModule } from "@modules/integrations/telegram"
import { ZALO_ERROR_KINDS, ZALO_MESSAGES, ZaloModule } from "@modules/integrations/zalo"
import { CONNECTION_HEALTH_SCHEDULER } from "@modules/queues/connection-health"
import { ZALO_REFRESH_SCHEDULER } from "@modules/queues/zalo-refresh"
import { CONTRACTS_ERROR_KINDS, CONTRACTS_MESSAGES, ContractsModule } from "@modules/domain/contracts"
import { LEADS_ERROR_KINDS, LEADS_MESSAGES, LeadsModule } from "@modules/domain/leads"
import { LivenessModule } from "@modules/domain/liveness"
import { MessagesModule } from "@modules/domain/messages"
import {
    RESPONSIBILITIES_ERROR_KINDS,
    RESPONSIBILITIES_MESSAGES,
    ResponsibilitiesModule,
} from "@modules/domain/responsibilities"
import { AiQuotaOverridesModule } from "@modules/domain/ai-quota-overrides"
import {
    PLATFORM_ADMIN_ERROR_KINDS,
    PLATFORM_ADMIN_MESSAGES,
    PlatformAdminModule,
} from "@modules/domain/platform-admin"
import { PlatformAuditModule } from "@modules/domain/platform-audit"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import {
    MODULE_CATALOG,
    MODULE_CATEGORIES,
    MODULES_ERROR_KINDS,
    MODULES_MESSAGES,
    ModulesModule,
} from "@modules/domain/modules"
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
import { CONTENT_MESSAGES, ContentModule } from "@modules/domain/content"
import { CONTENT_ITEMS_ERROR_KINDS, CONTENT_ITEMS_MESSAGES, ContentItemsModule } from "@modules/domain/content-items"
import { ContentSettingsModule } from "@modules/domain/content-settings"
import { VIDEO_ERROR_KINDS, VIDEO_MESSAGES, VideoModule } from "@modules/domain/video"
import { VideoProjectVersionsModule } from "@modules/domain/video-project-versions"
import { VideoProjectsModule } from "@modules/domain/video-projects"
import { VIDEO_RENDERS_ERROR_KINDS, VIDEO_RENDERS_MESSAGES, VideoRendersModule } from "@modules/domain/video-renders"
import { FFMPEG_ERROR_KINDS, FFMPEG_MESSAGES, FfmpegModule } from "@modules/integrations/ffmpeg"
import { TTS_ERROR_KINDS, TTS_MESSAGES, TtsModule } from "@modules/integrations/tts"
import { CONTENT_TICK_EVERY_MS, CONTENT_TICK_QUEUE, CONTENT_TICK_SCHEDULER } from "@modules/queues/content-tick"
import { RendersHttpModule } from "@features/api/renders"
import { PublishContentQueueModule } from "@features/jobs/publish-content"
import { RenderVideoQueueModule } from "@features/jobs/render-video"
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
                        INVENTORY_MESSAGES,
                        JOBS_MESSAGES,
                        MODULE_OPS_MESSAGES,
                        PLATFORM_ADMIN_MESSAGES,
                        JOBS_MESSAGES,
                        LEADS_MESSAGES,
                        RESPONSIBILITIES_MESSAGES,
                        CONTRACTS_MESSAGES,
                        MODULES_MESSAGES,
                        PUBLIC_API_MESSAGES,
                        QUEUE_MESSAGES,
                        WORKSPACE_INVITES_MESSAGES,
                        WORKSPACE_MEMBERS_MESSAGES,
                        WORKSPACES_MESSAGES,
                        FFMPEG_MESSAGES,
                        TTS_MESSAGES,
                        VIDEO_MESSAGES,
                        VIDEO_RENDERS_MESSAGES,
                        CONTENT_MESSAGES,
                        CONTENT_ITEMS_MESSAGES,
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
                        INVENTORY_ERROR_KINDS,
                        MODULE_OPS_ERROR_KINDS,
                        PLATFORM_ADMIN_ERROR_KINDS,
                        MODULES_ERROR_KINDS,
                        PUBLIC_API_ERROR_KINDS,
                        SUPABASE_ERROR_KINDS,
                        LEADS_ERROR_KINDS,
                        RESPONSIBILITIES_ERROR_KINDS,
                        CONTRACTS_ERROR_KINDS,
                        WORKSPACE_INVITES_ERROR_KINDS,
                        WORKSPACE_MEMBERS_ERROR_KINDS,
                        WORKSPACES_ERROR_KINDS,
                        FFMPEG_ERROR_KINDS,
                        TTS_ERROR_KINDS,
                        VIDEO_ERROR_KINDS,
                        VIDEO_RENDERS_ERROR_KINDS,
                        CONTENT_ITEMS_ERROR_KINDS,
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
                    schedulers: [
                        { queue: CONTENT_TICK_QUEUE, id: CONTENT_TICK_SCHEDULER, everyMs: CONTENT_TICK_EVERY_MS },
                        CONNECTION_HEALTH_SCHEDULER,
                        ZALO_REFRESH_SCHEDULER,
                    ],
                    ...options.queue,
                }),
                JobsModule.register({
                    isGlobal: true,
                    connection: PRIMARY_ENTITY_MANAGER,
                    ...options.jobs,
                }),
                SupabaseModule.register({ isGlobal: true, ...options.supabase }),
                IdentityModule.register({ isGlobal: true, verifyAccessToken }),
                ContractsModule.register({ isGlobal: true }),
                LeadsModule.register({ isGlobal: true }),
                MessagesModule.register({ isGlobal: true }),
                ResponsibilitiesModule.register({ isGlobal: true }),
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
                FfmpegModule.register({ isGlobal: true, ...options.ffmpeg }),
                TtsModule.register({ isGlobal: true, ...options.tts }),
                VideoRendersModule.register({ isGlobal: true }),
                VideoProjectsModule.register({ isGlobal: true }),
                VideoProjectVersionsModule.register({ isGlobal: true }),
                VideoModule.register({ isGlobal: true, ...options.video }),
                ContentItemsModule.register({ isGlobal: true }),
                ContentSettingsModule.register({ isGlobal: true }),
                ContentModule.register({ isGlobal: true }),
                RenderVideoQueueModule,
                PublishContentQueueModule,
                RendersHttpModule,
                LivenessModule.register({ isGlobal: true }),
                ModuleOpsModule.register({ isGlobal: true }),
                InventoryModule.register({ isGlobal: true }),
                InventoryHttpModule,
                ReplenishStockQueueModule,
                DeductOrderQueueModule,
                InventoryCommandQueueModule,
                LeadsHttpModule,
                PlatformAuditModule.register({ isGlobal: true }),
                AiQuotaOverridesModule.register({ isGlobal: true }),
                PlatformAdminModule.register({ isGlobal: true, ...options.platformAdmin }),
                AuthorityActionsModule.register({ isGlobal: true }),
                ModulesModule.register({ isGlobal: true, categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }),
                ModulesHttpModule,
                ApiKeysModule.register({ isGlobal: true }),
                PublicApiModule.register({ isGlobal: true }),
                TelegramHttpModule,
                ZaloHttpModule,
                RunChatTurnQueueModule,
                CheckConnectionHealthQueueModule,
                CompleteZaloAuthorizationQueueModule,
                RefreshZaloTokensQueueModule,
                ExternalApiHttpModule,
                SystemHealthHttpModule,
                WorkspacesHttpModule,
                AdminHttpModule,
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

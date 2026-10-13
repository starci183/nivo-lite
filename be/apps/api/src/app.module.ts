import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { LeadsHttpModule } from "@features/api/leads"
import { AdminHttpModule } from "@features/api/admin"
import { ModulesHttpModule } from "@features/api/modules"
import { ExternalApiHttpModule } from "@features/api/external-api"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import { WorkspacesHttpModule } from "@features/api/workspaces"
import { AuthGuard, IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule } from "@modules/domain/identity"
import {
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_AUTH,
    SUPABASE_ERROR_KINDS,
    SupabaseModule,
    createSupabaseAccessTokenVerifier,
} from "@modules/integrations/supabase"
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
import { CONNECTIONS_ERROR_KINDS, CONNECTIONS_MESSAGES, ConnectionsModule } from "@modules/domain/connections"
import {
    CONNECTION_GRANTS_ERROR_KINDS,
    CONNECTION_GRANTS_MESSAGES,
    ConnectionGrantsModule,
} from "@modules/domain/connection-grants"
import {
    CHANNEL_CONNECTIONS_ERROR_KINDS,
    CHANNEL_CONNECTIONS_MESSAGES,
    ChannelConnectionsModule,
} from "@modules/domain/channel-connections"
import {
    WEBHOOK_CONNECTIONS_ERROR_KINDS,
    WEBHOOK_CONNECTIONS_MESSAGES,
    WebhookConnectionsModule,
} from "@modules/domain/webhook-connections"
import {
    GOOGLE_CONNECTIONS_ERROR_KINDS,
    GOOGLE_CONNECTIONS_MESSAGES,
    GoogleConnectionsModule,
} from "@modules/domain/google-connections"
import {
    META_CONNECTIONS_ERROR_KINDS,
    META_CONNECTIONS_MESSAGES,
    MetaConnectionsModule,
} from "@modules/domain/meta-connections"
import { META_INBOX_ERROR_KINDS, META_INBOX_MESSAGES, MetaInboxModule } from "@modules/domain/meta-inbox"
import { ConnectionLifecycleModule } from "@modules/domain/connection-lifecycle"
import { GOOGLE_ERROR_KINDS, GOOGLE_MESSAGES, GoogleModule } from "@modules/integrations/google"
import { META_ERROR_KINDS, META_MESSAGES, MetaModule } from "@modules/integrations/meta"
import {
    CHANNEL_SETUP_ERROR_KINDS,
    CHANNEL_SETUP_MESSAGES,
    ChannelSetupModule,
} from "@modules/integrations/channel-setup"
import {
    WEBHOOK_DELIVERY_ERROR_KINDS,
    WEBHOOK_DELIVERY_MESSAGES,
    WebhookDeliveryModule,
} from "@modules/integrations/webhook-delivery"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import { ConnectionsHttpModule } from "@features/api/connections"
import { ConnectionGrantsHttpModule } from "@features/api/connection-grants"
import { ChannelConnectionsHttpModule } from "@features/api/channel-connections"
import { WebhookConnectionsHttpModule } from "@features/api/webhook-connections"
import { GoogleConnectionsHttpModule } from "@features/api/google-connections"
import { MetaConnectionsHttpModule } from "@features/api/meta-connections"
import { ConnectionLifecycleHttpModule } from "@features/api/connection-lifecycle"
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
                        CONNECTIONS_MESSAGES,
                        CONNECTION_GRANTS_MESSAGES,
                        CHANNEL_CONNECTIONS_MESSAGES,
                        WEBHOOK_CONNECTIONS_MESSAGES,
                        GOOGLE_CONNECTIONS_MESSAGES,
                        META_CONNECTIONS_MESSAGES,
                        META_INBOX_MESSAGES,
                        GOOGLE_MESSAGES,
                        META_MESSAGES,
                        CHANNEL_SETUP_MESSAGES,
                        WEBHOOK_DELIVERY_MESSAGES,
                        HTTP_MESSAGES,
                        API_KEYS_MESSAGES,
                        ERRORS_MESSAGES,
                        HTTP_SECURITY_MESSAGES,
                        IDENTITY_MESSAGES,
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
                        CONNECTIONS_ERROR_KINDS,
                        CONNECTION_GRANTS_ERROR_KINDS,
                        CHANNEL_CONNECTIONS_ERROR_KINDS,
                        WEBHOOK_CONNECTIONS_ERROR_KINDS,
                        GOOGLE_CONNECTIONS_ERROR_KINDS,
                        META_CONNECTIONS_ERROR_KINDS,
                        META_INBOX_ERROR_KINDS,
                        GOOGLE_ERROR_KINDS,
                        META_ERROR_KINDS,
                        CHANNEL_SETUP_ERROR_KINDS,
                        WEBHOOK_DELIVERY_ERROR_KINDS,
                        HTTP_ERROR_KINDS,
                        API_KEYS_ERROR_KINDS,
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        HTTP_SECURITY_ERROR_KINDS,
                        JOBS_ERROR_KINDS,
                        QUEUE_ERROR_KINDS,
                        IDENTITY_ERROR_KINDS,
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
                ConnectionsModule.register({ isGlobal: true, ...options.connections }),
                ConnectionGrantsModule.register({ isGlobal: true }),
                ChannelConnectionsModule.register({ isGlobal: true }),
                WebhookConnectionsModule.register({ isGlobal: true, ...options.webhookConnections }),
                GoogleConnectionsModule.register({ isGlobal: true }),
                MetaConnectionsModule.register({ isGlobal: true }),
                MetaInboxModule.register({ isGlobal: true }),
                ConnectionLifecycleModule.register({ isGlobal: true }),
                GoogleModule.register({ isGlobal: true, ...options.google }),
                MetaModule.register({ isGlobal: true, ...options.meta }),
                ChannelSetupModule.register({ isGlobal: true, ...options.channelSetup }),
                WebhookDeliveryModule.register({ isGlobal: true, ...options.webhookDelivery }),
                HttpModule.register({ isGlobal: true }),
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
                LeadsHttpModule,
                PlatformAuditModule.register({ isGlobal: true }),
                AiQuotaOverridesModule.register({ isGlobal: true }),
                PlatformAdminModule.register({ isGlobal: true, ...options.platformAdmin }),
                AuthorityActionsModule.register({ isGlobal: true }),
                ModulesModule.register({ isGlobal: true, categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }),
                ModulesHttpModule,
                ApiKeysModule.register({ isGlobal: true }),
                PublicApiModule.register({ isGlobal: true }),
                ExternalApiHttpModule,
                SystemHealthHttpModule,
                WorkspacesHttpModule,
                ConnectionsHttpModule,
                ConnectionGrantsHttpModule,
                ChannelConnectionsHttpModule,
                WebhookConnectionsHttpModule,
                GoogleConnectionsHttpModule,
                MetaConnectionsHttpModule,
                ConnectionLifecycleHttpModule,
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

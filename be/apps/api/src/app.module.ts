import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { AutomationsHttpModule } from "@features/api/automations"
import { FlowsHttpModule } from "@features/api/flows"
import { N8nPipelinesHttpModule } from "@features/api/n8n-pipelines"
import { EmitN8nEventQueueModule } from "@features/jobs/emit-n8n-event"
import { RunAutomationTickQueueModule } from "@features/jobs/run-automation-tick"
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
import { AUTOMATIONS_ERROR_KINDS, AUTOMATIONS_MESSAGES, AutomationsModule } from "@modules/domain/automations"
import { AutomationPortsModule } from "@modules/domain/automation-ports"
import {
    AUTOMATION_PIPELINES_ERROR_KINDS,
    AUTOMATION_PIPELINES_MESSAGES,
    AutomationPipelinesModule,
} from "@modules/domain/automation-pipelines"
import { AUTOMATION_RUNS_MESSAGES, AutomationRunsModule } from "@modules/domain/automation-runs"
import {
    AUTOMATION_TEMPLATES_ERROR_KINDS,
    AUTOMATION_TEMPLATES_MESSAGES,
    AutomationTemplatesModule,
} from "@modules/domain/automation-templates"
import { FlowsModule } from "@modules/domain/flows"
import { N8N_RUNS_ERROR_KINDS, N8N_RUNS_MESSAGES, N8nRunsModule } from "@modules/domain/n8n-runs"
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
import { N8N_ERROR_KINDS, N8nModule } from "@modules/integrations/n8n"
import { TEMPLATE_FILES_ERROR_KINDS, TemplateFilesModule } from "@modules/integrations/template-files"
import { AUTOMATION_TICK_SCHEDULER } from "@modules/queues/automation"
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
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
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
                        AUTOMATION_PIPELINES_MESSAGES,
                        AUTOMATION_RUNS_MESSAGES,
                        AUTOMATION_TEMPLATES_MESSAGES,
                        AUTOMATIONS_MESSAGES,
                        API_KEYS_MESSAGES,
                        ERRORS_MESSAGES,
                        HTTP_MESSAGES,
                        HTTP_SECURITY_MESSAGES,
                        IDENTITY_MESSAGES,
                        PLATFORM_ADMIN_MESSAGES,
                        JOBS_MESSAGES,
                        N8N_RUNS_MESSAGES,
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
                        AUTOMATION_PIPELINES_ERROR_KINDS,
                        AUTOMATION_TEMPLATES_ERROR_KINDS,
                        AUTOMATIONS_ERROR_KINDS,
                        API_KEYS_ERROR_KINDS,
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        HTTP_SECURITY_ERROR_KINDS,
                        HTTP_ERROR_KINDS,
                        JOBS_ERROR_KINDS,
                        N8N_ERROR_KINDS,
                        N8N_RUNS_ERROR_KINDS,
                        QUEUE_ERROR_KINDS,
                        IDENTITY_ERROR_KINDS,
                        PLATFORM_ADMIN_ERROR_KINDS,
                        MODULES_ERROR_KINDS,
                        PUBLIC_API_ERROR_KINDS,
                        SUPABASE_ERROR_KINDS,
                        TEMPLATE_FILES_ERROR_KINDS,
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
                        AUTOMATION_TICK_SCHEDULER,
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
                HttpModule.register({ isGlobal: true }),
                N8nModule.register({ isGlobal: true, ...options.n8n }),
                TemplateFilesModule.register({ isGlobal: true, ...options.templateFiles }),
                AutomationPortsModule.register({ isGlobal: true }),
                AutomationTemplatesModule.register({ isGlobal: true }),
                AutomationPipelinesModule.register({ isGlobal: true }),
                AutomationRunsModule.register({ isGlobal: true }),
                N8nRunsModule.register({ isGlobal: true }),
                AutomationsModule.register({ isGlobal: true }),
                FlowsModule.register({ isGlobal: true }),
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
                AutomationsHttpModule,
                FlowsHttpModule,
                N8nPipelinesHttpModule,
                EmitN8nEventQueueModule,
                RunAutomationTickQueueModule,
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

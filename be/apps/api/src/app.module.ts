import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
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
import { LivenessModule } from "@modules/domain/liveness"
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
                        API_KEYS_MESSAGES,
                        ERRORS_MESSAGES,
                        HTTP_SECURITY_MESSAGES,
                        IDENTITY_MESSAGES,
                        JOBS_MESSAGES,
                        MODULES_MESSAGES,
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
                        API_KEYS_ERROR_KINDS,
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        HTTP_SECURITY_ERROR_KINDS,
                        JOBS_ERROR_KINDS,
                        QUEUE_ERROR_KINDS,
                        IDENTITY_ERROR_KINDS,
                        MODULES_ERROR_KINDS,
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
                    schedulers: [],
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
                LivenessModule.register({ isGlobal: true }),
                AuthorityActionsModule.register({ isGlobal: true }),
                ModulesModule.register({ isGlobal: true, categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }),
                ModulesHttpModule,
                ApiKeysModule.register({ isGlobal: true }),
                PublicApiModule.register({ isGlobal: true }),
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

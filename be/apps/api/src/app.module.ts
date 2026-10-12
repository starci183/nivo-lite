import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { BookingHttpModule } from "@features/api/booking"
import { LoyaltyHttpModule } from "@features/api/loyalty"
import { LoyaltyTillHttpModule } from "@features/api/loyalty-till"
import { PublicBookingHttpModule } from "@features/api/public-booking"
import { PublicLoyaltyHttpModule } from "@features/api/public-loyalty"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { BOOKINGS_ERROR_KINDS, BOOKINGS_MESSAGES, BookingsModule } from "@modules/domain/bookings"
import {
    LOYALTY_CAMPAIGNS_ERROR_KINDS,
    LOYALTY_CAMPAIGNS_MESSAGES,
    LoyaltyCampaignsModule,
} from "@modules/domain/loyalty-campaigns"
import { LoyaltyCustomerLinksModule } from "@modules/domain/loyalty-customer-links"
import { LoyaltyCustomersModule } from "@modules/domain/loyalty-customers"
import {
    LOYALTY_LEDGER_ERROR_KINDS,
    LOYALTY_LEDGER_MESSAGES,
    LoyaltyLedgerModule,
} from "@modules/domain/loyalty-ledger"
import { LOYALTY_OTPS_ERROR_KINDS, LOYALTY_OTPS_MESSAGES, LoyaltyOtpsModule } from "@modules/domain/loyalty-otps"
import { LoyaltyProgramsModule } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsModule } from "@modules/domain/loyalty-rewards"
import { LOYALTY_ERROR_KINDS, LOYALTY_MESSAGES, LoyaltyModule } from "@modules/domain/loyalty"
import { ExternalApiHttpModule } from "@features/api/external-api"
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
                        BOOKINGS_MESSAGES,
                        LOYALTY_CAMPAIGNS_MESSAGES,
                        LOYALTY_LEDGER_MESSAGES,
                        LOYALTY_MESSAGES,
                        LOYALTY_OTPS_MESSAGES,
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
                        PUBLIC_API_ERROR_KINDS,
                        SUPABASE_ERROR_KINDS,
                        BOOKINGS_ERROR_KINDS,
                        LOYALTY_CAMPAIGNS_ERROR_KINDS,
                        LOYALTY_ERROR_KINDS,
                        LOYALTY_LEDGER_ERROR_KINDS,
                        LOYALTY_OTPS_ERROR_KINDS,
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
                BookingsModule.register({ isGlobal: true }),
                ApiKeysModule.register({ isGlobal: true }),
                PublicApiModule.register({ isGlobal: true }),
                ExternalApiHttpModule,
                SystemHealthHttpModule,
                LoyaltyProgramsModule.register({ isGlobal: true }),
                LoyaltyCustomersModule.register({ isGlobal: true }),
                LoyaltyCustomerLinksModule.register({ isGlobal: true }),
                LoyaltyRewardsModule.register({ isGlobal: true }),
                LoyaltyLedgerModule.register({ isGlobal: true }),
                LoyaltyCampaignsModule.register({ isGlobal: true }),
                LoyaltyOtpsModule.register({ isGlobal: true, pepper: options.supabase.serviceRoleKey.reveal() }),
                LoyaltyModule.register({
                    isGlobal: true,
                    // Until the chat lanes provide the channel adapters nothing delivers a code, so the public points check cannot unlock yet.
                    delivery: { deliver: () => Promise.resolve(false) },
                }),
                PublicBookingHttpModule,
                BookingHttpModule,
                PublicLoyaltyHttpModule,
                LoyaltyHttpModule,
                LoyaltyTillHttpModule,
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

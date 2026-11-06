import { AppErrorsModule } from "@modules/domain/app-errors"
import type { DynamicModule } from "@nestjs/common"
import { appPgTypes } from "@modules/integrations/data-sources"
import { ClockModule } from "@modules/platform/clock"
import { IdsModule } from "@modules/platform/ids"
import { LoggingModule } from "@modules/platform/logging"
import { I18nModule } from "@modules/platform/i18n"
import { ErrorsModule } from "@modules/platform/errors"
import { CqrsModule } from "@modules/platform/cqrs"
import { HttpSecurityModule } from "@modules/platform/http-security"
import { DatabaseModule, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PRIMARY_ENTITIES } from "@modules/platform/database/entities"
import { EventBusModule } from "@modules/platform/event-bus"
import { QueueModule } from "@modules/platform/queue"
import { RetryModule } from "@modules/platform/retry"
import { REALTIME_ERROR_KINDS, RealtimeModule, withConnection } from "@modules/platform/realtime"
import { API_SCHEDULERS } from "./schedulers"
import { platformErrorKinds, platformMessages } from "./platform-catalog"
import { JobsModule } from "@modules/platform/jobs"
import { JobOpsModule } from "@modules/domain/job-ops"
import type { ApiOptions } from "../api.options"
import { accountingErrorKinds, accountingMessages } from "./accounting"
import { adminErrorKinds, adminMessages } from "./admin"
import { agentApiErrorKinds, agentApiMessages } from "./agent-api"
import { agentsErrorKinds, agentsMessages } from "./agents"
import { agentWorkErrorKinds, agentWorkMessages } from "./agent-work"
import { apiErrorKinds, apiMessages } from "./api"
import { authenticationErrorKinds, authenticationMessages } from "./authentication"
import { automationsErrorKinds, automationsMessages } from "./automations"
import { billingErrorKinds, billingMessages } from "./billing"
import { bindingsErrorKinds, bindingsMessages } from "./bindings"
import { bookingsErrorKinds, bookingsMessages } from "./bookings"
import { businessErrorKinds, businessMessages } from "./business"
import { connectionsErrorKinds, connectionsMessages } from "./connections"
import { contentErrorKinds, contentMessages } from "./content"
import { identityErrorKinds, identityMessages } from "./identity"
import { knowledgeErrorKinds, knowledgeMessages } from "./knowledge"
import { messagingErrorKinds, messagingMessages } from "./messaging"
import { agentGraphsErrorKinds, agentGraphsMessages } from "./agent-graphs"
import { modulesErrorKinds, modulesMessages } from "./modules"
import { videoErrorKinds, videoMessages } from "./video"

/** Registers the shared platform services before the API's domain capabilities. */
export const platformModules = (options: ApiOptions): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    IdsModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    I18nModule.register({
        isGlobal: true,
        bundles: [
            ...platformMessages,
            ...accountingMessages,
            ...adminMessages,
            ...agentApiMessages,
            ...agentsMessages,
            ...agentWorkMessages,
            ...apiMessages,
            ...authenticationMessages,
            ...automationsMessages,
            ...billingMessages,
            ...bindingsMessages,
            ...bookingsMessages,
            ...businessMessages,
            ...connectionsMessages,
            ...contentMessages,
            ...identityMessages,
            ...knowledgeMessages,
            ...messagingMessages,
            ...modulesMessages,
            ...agentGraphsMessages,
            ...videoMessages,
        ],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            ...platformErrorKinds,
            ...accountingErrorKinds,
            ...adminErrorKinds,
            ...agentApiErrorKinds,
            ...agentsErrorKinds,
            ...agentWorkErrorKinds,
            ...apiErrorKinds,
            ...authenticationErrorKinds,
            ...automationsErrorKinds,
            ...billingErrorKinds,
            ...bindingsErrorKinds,
            ...bookingsErrorKinds,
            ...businessErrorKinds,
            ...connectionsErrorKinds,
            ...contentErrorKinds,
            ...identityErrorKinds,
            ...knowledgeErrorKinds,
            ...messagingErrorKinds,
            ...modulesErrorKinds,
            ...agentGraphsErrorKinds,
            ...videoErrorKinds,
            REALTIME_ERROR_KINDS,
        ],
    }),
    CqrsModule.register({ isGlobal: true }),
    HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
    DatabaseModule.register({
        isGlobal: true,
        connections: [options.database],
        entities: PRIMARY_ENTITIES,
        typeParsers: appPgTypes,
    }),
    RetryModule.register({ isGlobal: true }),
    RealtimeModule.register({
        isGlobal: true,
        ...withConnection(options.realtime, PRIMARY_ENTITY_MANAGER, options.database.url),
    }),
    AppErrorsModule.register({ isGlobal: true }),
    QueueModule.register({ isGlobal: true, schedulers: API_SCHEDULERS, ...options.queue }),
    EventBusModule.register({ isGlobal: true, consumersEnabled: true }),
    JobsModule.register({ isGlobal: true, connection: PRIMARY_ENTITY_MANAGER, ...options.jobs }),
    JobOpsModule.register({ isGlobal: true, alerts: options.jobsAlert }),
]

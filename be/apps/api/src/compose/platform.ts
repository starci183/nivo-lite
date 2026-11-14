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
import { OBJECT_STORAGE_ERROR_KINDS, ObjectStorageModule } from "@modules/integrations/object-storage"
import type { ApiOptions } from "../api.options"
import { adminErrorKinds, adminMessages } from "./admin"
import { agentApiErrorKinds, agentApiMessages } from "./agent-api"
import { agentsErrorKinds, agentsMessages } from "./agents"
import { agentWorkErrorKinds, agentWorkMessages } from "./agent-work"
import { authenticationErrorKinds, authenticationMessages } from "./authentication"
import { automationsErrorKinds, automationsMessages } from "./automations"
import { billingErrorKinds, billingMessages } from "./billing"
import { bindingsErrorKinds, bindingsMessages } from "./bindings"
import { connectionsErrorKinds, connectionsMessages } from "./connections"
import { identityErrorKinds, identityMessages } from "./identity"
import { knowledgeErrorKinds, knowledgeMessages } from "./knowledge"
import { messagingErrorKinds, messagingMessages } from "./messaging"
import { agentGraphsErrorKinds, agentGraphsMessages } from "./agent-graphs"
import { modulesErrorKinds, modulesMessages } from "./modules"

/** Registers the shared platform services before the API's domain capabilities. */
export const platformModules = (options: ApiOptions): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    IdsModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    I18nModule.register({
        isGlobal: true,
        bundles: [
            ...platformMessages,
            ...adminMessages,
            ...agentApiMessages,
            ...agentsMessages,
            ...agentWorkMessages,
            ...authenticationMessages,
            ...automationsMessages,
            ...billingMessages,
            ...bindingsMessages,
            ...connectionsMessages,
            ...identityMessages,
            ...knowledgeMessages,
            ...messagingMessages,
            ...modulesMessages,
            ...agentGraphsMessages,
        ],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            ...platformErrorKinds,
            ...adminErrorKinds,
            ...agentApiErrorKinds,
            ...agentsErrorKinds,
            ...agentWorkErrorKinds,
            ...authenticationErrorKinds,
            ...automationsErrorKinds,
            ...billingErrorKinds,
            ...bindingsErrorKinds,
            ...connectionsErrorKinds,
            ...identityErrorKinds,
            ...knowledgeErrorKinds,
            ...messagingErrorKinds,
            ...modulesErrorKinds,
            ...agentGraphsErrorKinds,
            REALTIME_ERROR_KINDS,
            OBJECT_STORAGE_ERROR_KINDS,
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
    ObjectStorageModule.register({ isGlobal: true, ...options.storage }),
    QueueModule.register({ isGlobal: true, schedulers: API_SCHEDULERS, ...options.queue }),
    EventBusModule.register({ isGlobal: true, consumersEnabled: true }),
    JobsModule.register({ isGlobal: true, connection: PRIMARY_ENTITY_MANAGER, ...options.jobs }),
    JobOpsModule.register({ isGlobal: true, alerts: options.jobsAlert }),
]

import { AppErrorsModule } from "@modules/domain/app-errors"
import type { DynamicModule } from "@nestjs/common"
import { appPgTypes } from "@modules/integrations/data-sources"
import { ClockModule } from "@modules/platform/clock"
import { IdsModule } from "@modules/platform/ids"
import { LoggingModule } from "@modules/platform/logging"
import { I18nModule } from "@modules/platform/i18n"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { CqrsModule } from "@modules/platform/cqrs"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES, HttpSecurityModule } from "@modules/platform/http-security"
import { DATABASE_ERROR_KINDS, DatabaseModule, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PRIMARY_ENTITIES } from "@modules/platform/database/entities"
import { EVENT_BUS_ERROR_KINDS, EVENT_BUS_MESSAGES, EventBusModule } from "@modules/platform/event-bus"
import { QUEUE_ERROR_KINDS, QUEUE_MESSAGES, QueueModule } from "@modules/platform/queue"
import { RetryModule } from "@modules/platform/retry"
import { REALTIME_ERROR_KINDS, RealtimeModule, withConnection } from "@modules/platform/realtime"
import { API_SCHEDULERS } from "./schedulers"
import { JOBS_ERROR_KINDS, JOBS_MESSAGES, JobsModule } from "@modules/platform/jobs"
import { JOB_OPS_ERROR_KINDS, JobOpsModule } from "@modules/domain/job-ops"
import type { ApiOptions } from "../api.options"
import { FLOW_ENGINE_ERROR_KINDS, FLOW_ENGINE_MESSAGES } from "@modules/domain/flow-engine"
import { AUTHORITY_ERROR_KINDS, AUTHORITY_MESSAGES } from "@modules/domain/authority"
import { AUTHORITY_RULES_ERROR_KINDS, AUTHORITY_RULES_MESSAGES } from "@modules/domain/authority-rules"
import { MEMBER_GRANTS_ERROR_KINDS, MEMBER_GRANTS_MESSAGES } from "@modules/domain/member-grants"
import { EXECUTIONS_ERROR_KINDS, EXECUTIONS_MESSAGES } from "@modules/domain/executions"
import { WORK_ITEMS_ERROR_KINDS, WORK_ITEMS_MESSAGES } from "@modules/domain/work-items"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { API_ERROR_KINDS, EVENTS_MESSAGES } from "@modules/events/api"
import { MCP_ERROR_KINDS, MCP_MESSAGES } from "@modules/integrations/mcp"
import { MCP_GATEWAY_RECEIPTS_ERROR_KINDS, MCP_GATEWAY_RECEIPTS_MESSAGES } from "@modules/domain/mcp-gateway-receipts"
import { BOOKING_PORTS_MESSAGES } from "@modules/domain/booking-ports"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
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
import { loyaltyErrorKinds, loyaltyMessages } from "./loyalty"
import { messagingErrorKinds, messagingMessages } from "./messaging"
import { modulesErrorKinds, modulesMessages } from "./modules"
import { salesErrorKinds, salesMessages } from "./sales"
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
            ...loyaltyMessages,
            ...messagingMessages,
            ...modulesMessages,
            ...salesMessages,
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
            ...loyaltyErrorKinds,
            ...messagingErrorKinds,
            ...modulesErrorKinds,
            ...salesErrorKinds,
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

/** The error kinds of the capabilities this group registers, in registration order. */
export const platformErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    JOB_OPS_ERROR_KINDS,
    FLOW_ENGINE_ERROR_KINDS,
    AUTHORITY_ERROR_KINDS,
    AUTHORITY_RULES_ERROR_KINDS,
    MEMBER_GRANTS_ERROR_KINDS,
    EXECUTIONS_ERROR_KINDS,
    WORK_ITEMS_ERROR_KINDS,
    CONFIG_ERROR_KINDS,
    DATABASE_ERROR_KINDS,
    HTTP_SECURITY_ERROR_KINDS,
    API_ERROR_KINDS,
    EVENT_BUS_ERROR_KINDS,
    JOBS_ERROR_KINDS,
    QUEUE_ERROR_KINDS,
    MCP_ERROR_KINDS,
    MCP_GATEWAY_RECEIPTS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const platformMessages: ReadonlyArray<MessageBundle> = [
    BOOKING_PORTS_MESSAGES,
    FLOW_ENGINE_MESSAGES,
    EVENTS_MESSAGES,
    EVENT_BUS_MESSAGES,
    AUTHORITY_MESSAGES,
    AUTHORITY_RULES_MESSAGES,
    MEMBER_GRANTS_MESSAGES,
    EXECUTIONS_MESSAGES,
    WORK_ITEMS_MESSAGES,
    ERRORS_MESSAGES,
    HTTP_SECURITY_MESSAGES,
    JOBS_MESSAGES,
    QUEUE_MESSAGES,
    MCP_MESSAGES,
    MCP_GATEWAY_RECEIPTS_MESSAGES,
]

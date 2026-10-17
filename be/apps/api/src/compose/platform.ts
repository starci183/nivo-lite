import {
    AppErrorsModule,
    API_MESSAGES_1,
    API_MESSAGES_2,
    API_MESSAGES_3,
    API_MESSAGES_4,
    API_ERROR_KINDS_1,
    API_ERROR_KINDS_2,
    API_ERROR_KINDS_3,
    API_ERROR_KINDS_4,
} from "@modules/domain/app-errors"
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
import { QueueModule } from "@modules/platform/queue"
import { API_SCHEDULERS } from "./schedulers"
import { JobsModule } from "@modules/platform/jobs"
import { JobOpsModule } from "@modules/domain/job-ops"
import type { ApiOptions } from "../api.options"

/** Registers the shared platform services before the API's domain capabilities. */
export const platformModules = (options: ApiOptions): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    IdsModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    I18nModule.register({
        isGlobal: true,
        bundles: [...API_MESSAGES_1, ...API_MESSAGES_2, ...API_MESSAGES_3, ...API_MESSAGES_4],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [...API_ERROR_KINDS_1, ...API_ERROR_KINDS_2, ...API_ERROR_KINDS_3, ...API_ERROR_KINDS_4],
    }),
    CqrsModule.register({ isGlobal: true }),
    HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
    DatabaseModule.register({ isGlobal: true, connections: [options.database], typeParsers: appPgTypes }),
    AppErrorsModule.register({ isGlobal: true }),
    QueueModule.register({ isGlobal: true, schedulers: API_SCHEDULERS, ...options.queue }),
    JobsModule.register({ isGlobal: true, connection: PRIMARY_ENTITY_MANAGER, ...options.jobs }),
    JobOpsModule.register({ isGlobal: true, alerts: options.jobsAlert }),
]

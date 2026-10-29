import type { DynamicModule } from "@nestjs/common"
import { AUTOMATIONS_ERROR_KINDS, AUTOMATIONS_MESSAGES, AutomationsModule } from "@modules/domain/automations"
import { AutomationCommandsModule } from "@modules/domain/automation-commands"
import { AUTOMATION_PORTS_MESSAGES, AutomationPortsModule } from "@modules/domain/automation-ports"
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
import { N8N_ERROR_KINDS, N8nModule } from "@modules/integrations/n8n"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import { GraphqlModule } from "@modules/platform/graphql"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The automations area of the API, in registration order. */
export const automationsModules = (options: ApiOptions): Array<DynamicModule> => [
    HttpModule.register({ isGlobal: true }),
    GraphqlModule.register({ isGlobal: true }),
    N8nModule.register({ isGlobal: true, ...options.n8n }),
    AutomationPortsModule.register({ isGlobal: true }),
    AutomationTemplatesModule.register({ isGlobal: true }),
    AutomationPipelinesModule.register({ isGlobal: true }),
    AutomationRunsModule.register({ isGlobal: true }),
    N8nRunsModule.register({ isGlobal: true }),
    AutomationsModule.register({ isGlobal: true }),
    AutomationCommandsModule.register({ isGlobal: true }),
    FlowsModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const automationsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    HTTP_ERROR_KINDS,
    AUTOMATION_PIPELINES_ERROR_KINDS,
    AUTOMATION_TEMPLATES_ERROR_KINDS,
    AUTOMATIONS_ERROR_KINDS,
    N8N_ERROR_KINDS,
    N8N_RUNS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const automationsMessages: ReadonlyArray<MessageBundle> = [
    HTTP_MESSAGES,
    AUTOMATION_PIPELINES_MESSAGES,
    AUTOMATION_RUNS_MESSAGES,
    AUTOMATION_TEMPLATES_MESSAGES,
    AUTOMATIONS_MESSAGES,
    AUTOMATION_PORTS_MESSAGES,
    N8N_RUNS_MESSAGES,
]

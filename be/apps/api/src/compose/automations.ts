import type { DynamicModule } from "@nestjs/common"
import {
    AUTOMATION_PIPELINES_ERROR_KINDS,
    AUTOMATION_PIPELINES_MESSAGES,
    AutomationPipelinesModule,
} from "@modules/domain/automation-pipelines"
import {
    AUTOMATION_TEMPLATES_ERROR_KINDS,
    AUTOMATION_TEMPLATES_MESSAGES,
    AutomationTemplatesModule,
} from "@modules/domain/automation-templates"
import { FlowEngineModule, FlowEngineService } from "@modules/domain/flow-engine"
import { FlowsModule } from "@modules/domain/flows"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import { GraphqlModule } from "@modules/platform/graphql"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The automations area of the API, in registration order. */
export const automationsModules = (): Array<DynamicModule> => [
    HttpModule.register({ isGlobal: true }),
    GraphqlModule.register({ isGlobal: true }),
    AutomationTemplatesModule.register({ isGlobal: true }),
    AutomationPipelinesModule.register({ isGlobal: true }),
    FlowEngineModule.register({ isGlobal: true }),
    FlowsModule.register({ isGlobal: true, gate: FlowEngineService }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const automationsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    HTTP_ERROR_KINDS,
    AUTOMATION_PIPELINES_ERROR_KINDS,
    AUTOMATION_TEMPLATES_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const automationsMessages: ReadonlyArray<MessageBundle> = [
    HTTP_MESSAGES,
    AUTOMATION_PIPELINES_MESSAGES,
    AUTOMATION_TEMPLATES_MESSAGES,
]

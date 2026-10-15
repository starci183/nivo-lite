import type { ModuleMetadata } from "@nestjs/common"
import { AutomationsModule } from "@modules/domain/automations"
import { AutomationCommandsModule } from "@modules/domain/automation-commands"
import { AutomationPortsModule } from "@modules/domain/automation-ports"
import { AutomationPipelinesModule } from "@modules/domain/automation-pipelines"
import { AutomationRunsModule } from "@modules/domain/automation-runs"
import { AutomationTemplatesModule } from "@modules/domain/automation-templates"
import { FlowsModule } from "@modules/domain/flows"
import { N8nRunsModule } from "@modules/domain/n8n-runs"
import { N8nModule } from "@modules/integrations/n8n"
import { HttpModule } from "@modules/platform/http"
import { GraphqlModule } from "@modules/platform/graphql"
import type { ApiOptions } from "../api.options"
/** The automations area of the API, in registration order. */
export const automationsModules = (options: ApiOptions): NonNullable<ModuleMetadata["imports"]> => [
    ...[HttpModule.register({ isGlobal: true }), GraphqlModule.register({ isGlobal: true })],
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

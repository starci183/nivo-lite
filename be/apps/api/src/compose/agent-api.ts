import type { ModuleMetadata } from "@nestjs/common"
import { AgentToolsHttpModule } from "@features/api/agent-tools"
import { AgentsGraphqlModule } from "@features/api/agents"
import { DecisionsGraphqlModule } from "@features/api/decisions"
import { OfficeGraphqlModule } from "@features/api/office"
/** The agent api area of the API, in registration order. */
export const agentApiModules = (): NonNullable<ModuleMetadata["imports"]> => [
    AgentsGraphqlModule,
    AgentToolsHttpModule,
    DecisionsGraphqlModule,
    OfficeGraphqlModule,
]

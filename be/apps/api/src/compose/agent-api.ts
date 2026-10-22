import type { DynamicModule } from "@nestjs/common"
import { AgentToolsHttpModule } from "@features/api/agent-tools"
import { AgentsGraphqlModule } from "@features/api/agents"
import { DecisionsGraphqlModule } from "@features/api/decisions"
import { OfficeGraphqlModule } from "@features/api/office"
import { WorkThreadsGraphqlModule } from "@features/api/work-threads"
import { AgentsService } from "@modules/domain/agents"
import { ApprovalRequestsService } from "@modules/domain/approval-requests"
import { ThreadMessagesModule } from "@modules/domain/thread-messages"
import { WorkChainsModule } from "@modules/domain/work-chains"
import { WorkThreadsModule } from "@modules/domain/work-threads"
/** The agent api area of the API, in registration order. */
export const agentApiModules = (): Array<DynamicModule> => [
    AgentsGraphqlModule.register({}),
    AgentToolsHttpModule.register({}),
    DecisionsGraphqlModule.register({}),
    OfficeGraphqlModule.register({}),
    WorkChainsModule.register({ isGlobal: true, ownerDirectory: AgentsService }),
    WorkThreadsModule.register({ isGlobal: true }),
    ThreadMessagesModule.register({ isGlobal: true, agentRules: AgentsService, approvalGate: ApprovalRequestsService }),
    WorkThreadsGraphqlModule.register({}),
]

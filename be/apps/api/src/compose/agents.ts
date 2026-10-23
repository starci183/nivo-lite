import { InstallationDirectoryService } from "@modules/domain/modules"
import { AgentKnowledgeLensService, ModuleProfilesService } from "@modules/domain/agent-knowledge"
import type { DynamicModule } from "@nestjs/common"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import { AgentConnectionsModule } from "@modules/domain/agent-connections"
import { AgentToolsModule } from "@modules/domain/agent-tools"
import { AgentProfileModule } from "@modules/domain/agent-profile"
import { AGENTS_SYNC_FRESH_MS, AgentsModule, AgentsService } from "@modules/domain/agents"
import { AI_GENERATIONS_POLL_MS, AiGenerationsModule, TextGeneratorService } from "@modules/domain/ai-generations"
import { ApprovalRequestsModule } from "@modules/domain/approval-requests"
import { ThreadApprovalOutcomesService, ThreadAssignmentsService } from "@modules/domain/thread-messages"
import { ThreadWorkService } from "@modules/domain/thread-work"
import { DecisionsModule } from "@modules/domain/decisions"
import { OPENCLAW_RELOAD_SETTLE_MS, OpenclawAgentSyncModule } from "@modules/domain/openclaw-agent-sync"
import { DeepseekModule } from "@modules/integrations/deepseek"
import { OpenclawModule } from "@modules/integrations/openclaw"
import { ContentGenerationCompletionService } from "@modules/domain/content-ai"
import { AGENT_TOOLS_PORTS, DECISIONS_PORTS } from "../api.options"
import type { ApiOptions } from "../api.options"
/** The agents area of the API, in registration order. */
export const agentsModules = (options: ApiOptions): Array<DynamicModule> => [
    OpenclawModule.register({ isGlobal: true, ...options.openclaw }),
    DeepseekModule.register({ isGlobal: true, ...options.deepseek, generator: TextGeneratorService }),
    AgentsModule.register({
        isGlobal: true,
        ports: {
            installations: InstallationDirectoryService,
            knowledge: AgentKnowledgeLensService,
            modules: ModuleProfilesService,
        },
        syncFreshMs: AGENTS_SYNC_FRESH_MS,
    }),
    AgentProfileModule.register({ isGlobal: true, threads: ThreadAssignmentsService, work: ThreadWorkService }),
    AgentConnectionsModule.register({ isGlobal: true }),
    AiGenerationsModule.register({
        isGlobal: true,
        usage: UsageGateService,
        pollMs: AI_GENERATIONS_POLL_MS,
        completion: ContentGenerationCompletionService,
    }),
    OpenclawAgentSyncModule.register({ isGlobal: true, reloadSettleMs: OPENCLAW_RELOAD_SETTLE_MS }),
    AgentToolsModule.register({ isGlobal: true, ports: AGENT_TOOLS_PORTS }),
    DecisionsModule.register({ isGlobal: true, ports: DECISIONS_PORTS }),
    ApprovalRequestsModule.register({
        isGlobal: true,
        ports: { agentOwners: AgentsService, events: ThreadApprovalOutcomesService },
    }),
]

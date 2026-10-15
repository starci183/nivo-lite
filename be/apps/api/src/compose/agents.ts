import type { ModuleMetadata } from "@nestjs/common"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import { AgentConnectionsModule } from "@modules/domain/agent-connections"
import { AgentToolsModule } from "@modules/domain/agent-tools"
import { AGENTS_SYNC_FRESH_MS, AgentsModule } from "@modules/domain/agents"
import { AI_GENERATIONS_POLL_MS, AiGenerationsModule, TextGeneratorService } from "@modules/domain/ai-generations"
import { DecisionsModule } from "@modules/domain/decisions"
import { OPENCLAW_RELOAD_SETTLE_MS, OpenclawAgentSyncModule } from "@modules/domain/openclaw-agent-sync"
import { DeepseekModule } from "@modules/integrations/deepseek"
import { OpenclawModule } from "@modules/integrations/openclaw"
import { ContentGenerationCompletionService } from "@modules/domain/content-ai"
import { AGENT_TOOLS_PORTS, DECISIONS_PORTS } from "../api.options"
import { G19_PORTS } from "./ports"
import type { ApiOptions } from "../api.options"
/** The agents area of the API, in registration order. */
export const agentsModules = (options: ApiOptions): NonNullable<ModuleMetadata["imports"]> => [
    OpenclawModule.register({ isGlobal: true, ...options.openclaw }),
    DeepseekModule.register({ isGlobal: true, ...options.deepseek, generator: TextGeneratorService }),
    AgentsModule.register({ isGlobal: true, ports: G19_PORTS.agents, syncFreshMs: AGENTS_SYNC_FRESH_MS }),
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
]

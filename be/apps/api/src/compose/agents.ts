import { InstallationDirectoryService, MODULES_ERROR_KINDS, MODULES_MESSAGES } from "@modules/domain/modules"
import { AgentKnowledgeLensService, ModuleProfilesService } from "@modules/domain/agent-knowledge"
import type { DynamicModule } from "@nestjs/common"
import { AI_USAGE_EVENTS_MESSAGES, UsageGateService } from "@modules/domain/ai-usage-events"
import {
    AGENT_CONNECTIONS_ERROR_KINDS,
    AGENT_CONNECTIONS_MESSAGES,
    AgentBindingsService,
    AgentConnectionsModule,
} from "@modules/domain/agent-connections"
import { AGENT_TOOLS_ERROR_KINDS, AGENT_TOOLS_MESSAGES, AgentToolsModule } from "@modules/domain/agent-tools"
import { AGENT_PROFILE_ERROR_KINDS, AGENT_PROFILE_MESSAGES, AgentProfileModule } from "@modules/domain/agent-profile"
import { AGENTS_SYNC_FRESH_MS, AgentDirectoryService, AgentsModule, AgentsService } from "@modules/domain/agents"
import {
    AI_GENERATIONS_ERROR_KINDS,
    AI_GENERATIONS_MESSAGES,
    AI_GENERATIONS_POLL_MS,
    AiGenerationsModule,
    TextGeneratorService,
} from "@modules/domain/ai-generations"
import { ApprovalRequestsModule } from "@modules/domain/approval-requests"
import { ThreadAssignmentsService } from "@modules/domain/thread-messages"
import { ThreadWorkService } from "@modules/domain/thread-work"
import { DECISIONS_ERROR_KINDS, DECISIONS_MESSAGES, DecisionsModule } from "@modules/domain/decisions"
import {
    OPENCLAW_AGENT_SYNC_ERROR_KINDS,
    OPENCLAW_AGENT_SYNC_MESSAGES,
    OPENCLAW_RELOAD_SETTLE_MS,
    OpenclawAgentSyncModule,
} from "@modules/domain/openclaw-agent-sync"
import { AiTasksModule } from "@modules/domain/ai-tasks"
import { OPENCLAW_ERROR_KINDS, OPENCLAW_MESSAGES, OpenclawModule } from "@modules/integrations/openclaw"
import { AGENT_TOOLS_PORTS, DECISIONS_PORTS } from "../api.options"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The agents area of the API, in registration order. */
export const agentsModules = (options: ApiOptions): Array<DynamicModule> => [
    OpenclawModule.register({ isGlobal: true, ...options.openclaw }),
    AiTasksModule.register({
        isGlobal: true,
        ...options.aiTasks,
        generator: TextGeneratorService,
        recall: AgentKnowledgeLensService,
        meter: UsageGateService,
    }),
    AgentsModule.register({
        isGlobal: true,
        ports: {
            installations: InstallationDirectoryService,
            connections: AgentBindingsService,
            knowledge: AgentKnowledgeLensService,
            modules: ModuleProfilesService,
        },
        syncFreshMs: AGENTS_SYNC_FRESH_MS,
    }),
    AgentProfileModule.register({ isGlobal: true, threads: ThreadAssignmentsService, work: ThreadWorkService }),
    AgentConnectionsModule.register({ isGlobal: true, ports: { agents: AgentDirectoryService } }),
    AiGenerationsModule.register({
        isGlobal: true,
        usage: UsageGateService,
        pollMs: AI_GENERATIONS_POLL_MS,
    }),
    OpenclawAgentSyncModule.register({ isGlobal: true, reloadSettleMs: OPENCLAW_RELOAD_SETTLE_MS }),
    AgentToolsModule.register({ isGlobal: true, ports: AGENT_TOOLS_PORTS }),
    DecisionsModule.register({ isGlobal: true, ports: DECISIONS_PORTS }),
    ApprovalRequestsModule.register({
        isGlobal: true,
        ports: { agentOwners: AgentsService },
    }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const agentsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    DECISIONS_ERROR_KINDS,
    AGENT_CONNECTIONS_ERROR_KINDS,
    AGENT_TOOLS_ERROR_KINDS,
    AI_GENERATIONS_ERROR_KINDS,
    OPENCLAW_AGENT_SYNC_ERROR_KINDS,
    OPENCLAW_ERROR_KINDS,
    MODULES_ERROR_KINDS,
    AGENT_PROFILE_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const agentsMessages: ReadonlyArray<MessageBundle> = [
    DECISIONS_MESSAGES,
    AGENT_CONNECTIONS_MESSAGES,
    AGENT_TOOLS_MESSAGES,
    AI_GENERATIONS_MESSAGES,
    AI_USAGE_EVENTS_MESSAGES,
    OPENCLAW_AGENT_SYNC_MESSAGES,
    OPENCLAW_MESSAGES,
    MODULES_MESSAGES,
    AGENT_PROFILE_MESSAGES,
]

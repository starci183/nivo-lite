import type { DynamicModule } from "@nestjs/common"
import {
    AGENT_CONNECTIONS_ERROR_KINDS,
    AGENT_CONNECTIONS_MESSAGES,
    AgentConnectionsModule,
} from "@modules/domain/agent-connections"
import { AGENT_RUNS_ERROR_KINDS, AGENT_RUNS_MESSAGES, AgentRunsModule } from "@modules/domain/agent-runs"
import { AGENT_THREADS_ERROR_KINDS, AgentThreadsModule, RUN_STOPS_ERROR_KINDS } from "@modules/domain/agent-threads"
import { AGENT_WORK_ERROR_KINDS, AGENT_WORK_MESSAGES, AgentWorkModule } from "@modules/domain/agent-work"
import { AgentDirectoryService, AgentOwnershipService } from "@modules/domain/agents"
import { WorkItemsModule } from "@modules/domain/work-items"
import {
    AI_GENERATIONS_ERROR_KINDS,
    AI_GENERATIONS_MESSAGES,
    AI_GENERATIONS_POLL_MS,
    AiGenerationsModule,
} from "@modules/domain/ai-generations"
import { AI_USAGE_EVENTS_MESSAGES, AiUsageEventsModule, UsageGateService } from "@modules/domain/ai-usage-events"
import { BrainExtractionsModule } from "@modules/domain/brain-extractions"
import { ChatRoomDirectoryModule } from "@modules/domain/chat-room-directory"
import { KnowledgeGapsModule } from "@modules/domain/knowledge-gaps"
import { INTENT_CONTRACTS_MESSAGES } from "@modules/domain/intent-contracts"
import {
    MODULE_CATALOG,
    MODULE_CATEGORIES,
    MODULES_ERROR_KINDS,
    MODULES_MESSAGES,
    ModulesModule,
} from "@modules/domain/modules"
import { PAYMENT_ORDERS_ERROR_KINDS, PAYMENT_ORDERS_MESSAGES, PaymentOrdersModule } from "@modules/domain/payment-orders"
import {
    TEAM_CHAT_ERROR_KINDS,
    TEAM_CHAT_MESSAGES,
    TeamChatModule,
    TeamChatNoticesService,
    teamChatEntities,
} from "@modules/domain/team-chat"
import {
    WORKBENCH_DOOR_ERROR_KINDS,
    WORKBENCH_DOOR_MESSAGES,
    WorkbenchDoorModule,
} from "@modules/domain/workbench-door"
import { INSTALLED, INSTALLED_MODULES, INSTALLED_REGISTRY_HASH } from "@modules/domain/installed-plugins"
import { PLUGIN_SERVICES_ERROR_KINDS, PLUGIN_SERVICES_MESSAGES, PluginServicesModule } from "@modules/domain/plugin-services"
import { WORKSPACES_ERROR_KINDS, WORKSPACES_MESSAGES, WorkspacesModule } from "@modules/domain/workspaces"
import { STORAGE_OBJECTS } from "@modules/integrations/object-storage"
import { RedisModule } from "@modules/integrations/redis"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS_ERROR_KINDS, EVENT_BUS_MESSAGES, EventBusModule } from "@modules/platform/event-bus"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
import { REALTIME_ERROR_KINDS, RealtimeModule, withConnection } from "@modules/platform/realtime"
import type { McpAppOptions } from "../mcp.options"

/**
 * The capabilities behind the endpoint's ops, registered as the api registers them but WITHOUT the engine: the handlers are the api
 * resolvers' own (one code path), and none of them runs a tool or a graph. The workspaces and payment orders the plan's entitlements
 * read (a file upload's storage room); the team chat rooms and their notices; the work store whose wake a workflow start writes (the
 * api's engine drains it), the runs and their usage, the open stops read alone (no thread run, no stop door); the module installs and
 * the setup they carry (the agent list and the record types); the workbench door. The gateway runs no worker and reads no queue: it
 * writes rows and outbox jobs only, which the api's relay and consumers take.
 */
export const mcpEndpointModules = (options: McpAppOptions): Array<DynamicModule> => [
    RealtimeModule.register({
        isGlobal: true,
        ...withConnection(options.realtime, PRIMARY_ENTITY_MANAGER, options.database.url),
    }),
    EventBusModule.register({ isGlobal: true }),
    WorkspacesModule.register({ isGlobal: true, ...options.workspaces }),
    PaymentOrdersModule.register({ isGlobal: true }),
    RedisModule.register({ isGlobal: true, ...options.redis }),
    BrainExtractionsModule.register({ isGlobal: true }),
    ChatRoomDirectoryModule.register({ isGlobal: true, rooms: teamChatEntities[0], seats: teamChatEntities[1] }),
    AgentConnectionsModule.register({
        isGlobal: true,
        ports: { agents: AgentDirectoryService, managers: AgentOwnershipService },
    }),
    TeamChatModule.register({ isGlobal: true, storage: STORAGE_OBJECTS }),
    AiUsageEventsModule.register({ isGlobal: true, notices: TeamChatNoticesService }),
    // The setup chat's stores the module installs carry (its gaps and its generation client); nothing here runs a setup turn.
    KnowledgeGapsModule.register({ isGlobal: true }),
    AiGenerationsModule.register({ isGlobal: true, usage: UsageGateService, pollMs: AI_GENERATIONS_POLL_MS }),
    WorkItemsModule.register({ isGlobal: true }),
    AgentWorkModule.register({ isGlobal: true }),
    AgentRunsModule.register({ isGlobal: true, ...options.agentRuns }),
    // The open stops (`stop.list`): the store and its records alone; answering a stop resumes a thread, which only the api does.
    AgentThreadsModule.registerRecords({ isGlobal: true }),
    ModulesModule.register({
        isGlobal: true,
        categories: MODULE_CATEGORIES,
        catalog: MODULE_CATALOG,
    }),
    WorkbenchDoorModule.register({
        isGlobal: true,
        modules: INSTALLED_MODULES,
        entities: INSTALLED.entities(),
        registryHash: INSTALLED_REGISTRY_HASH,
    }),
    // The services the installed plugins ship, built for one agent: the engine never imports a plugin.
    PluginServicesModule.register({ isGlobal: true, catalog: INSTALLED }),
]

/** The error kinds of the capabilities this group registers. */
export const mcpEndpointErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    REALTIME_ERROR_KINDS,
    EVENT_BUS_ERROR_KINDS,
    WORKSPACES_ERROR_KINDS,
    PAYMENT_ORDERS_ERROR_KINDS,
    AGENT_CONNECTIONS_ERROR_KINDS,
    TEAM_CHAT_ERROR_KINDS,
    AI_GENERATIONS_ERROR_KINDS,
    AGENT_WORK_ERROR_KINDS,
    AGENT_RUNS_ERROR_KINDS,
    AGENT_THREADS_ERROR_KINDS,
    RUN_STOPS_ERROR_KINDS,
    MODULES_ERROR_KINDS,
    WORKBENCH_DOOR_ERROR_KINDS,
    PLUGIN_SERVICES_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers. */
export const mcpEndpointMessages: ReadonlyArray<MessageBundle> = [
    EVENT_BUS_MESSAGES,
    WORKSPACES_MESSAGES,
    PAYMENT_ORDERS_MESSAGES,
    INTENT_CONTRACTS_MESSAGES,
    AGENT_CONNECTIONS_MESSAGES,
    TEAM_CHAT_MESSAGES,
    AI_USAGE_EVENTS_MESSAGES,
    AI_GENERATIONS_MESSAGES,
    AGENT_WORK_MESSAGES,
    AGENT_RUNS_MESSAGES,
    MODULES_MESSAGES,
    WORKBENCH_DOOR_MESSAGES,
    PLUGIN_SERVICES_MESSAGES,
]

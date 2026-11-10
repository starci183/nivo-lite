import type { DynamicModule } from "@nestjs/common"
import { OfficeBackgroundVoiceService, OfficeInboundStopReporterService } from "@modules/domain/messages"
import {
    AGENT_SCHEDULES_ERROR_KINDS,
    AGENT_SCHEDULES_MESSAGES,
    AgentSchedulesModule,
} from "@modules/domain/agent-schedules"
import { AGENT_INBOUND_ERROR_KINDS, AGENT_INBOUND_MESSAGES, AgentInboundModule } from "@modules/domain/agent-inbound"
import { ENTITY_ENGINE_ERROR_KINDS, ENTITY_ENGINE_MESSAGES, EntityEngineModule } from "@modules/domain/entity-engine"
import {
    AGENT_RUNS_ERROR_KINDS,
    AGENT_RUNS_MESSAGES,
    AgentRunEngineAlertsService,
    AgentRunsModule,
} from "@modules/domain/agent-runs"
import { AGENT_WORK_ERROR_KINDS, AGENT_WORK_MESSAGES, AgentWorkModule } from "@modules/domain/agent-work"
import { GRAPH_NODES_ERROR_KINDS, GRAPH_NODES_MESSAGES, GraphNodesModule } from "@modules/domain/graph-nodes"
import type { NodeInstall } from "@modules/domain/graph-nodes"
import { AiTasksService } from "@modules/domain/ai-tasks"
import { NodeToolDoorService } from "@modules/domain/mcp-gateway"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import { MODULE_JOBS } from "@nivo-lite/blocks-core/modules"
import { coreDataKinds, coreEffects, coreNodes, coreTools, modelWordsOf } from "@nivo-lite/blocks-core"
import {
    CHAT_NODE_PORTS_ERROR_KINDS,
    CHAT_NODE_PORTS_MESSAGES,
    ChatNodePortsModule,
} from "@modules/domain/chat-node-ports"
import { SALES_EFFECTS_ERROR_KINDS, SALES_EFFECTS_MESSAGES, SalesEffectsModule } from "@modules/domain/sales-effects"
import { AGENT_GRAPHS_ERROR_KINDS, AGENT_GRAPHS_MESSAGES } from "@modules/domain/agent-graphs"
import { AGENT_PLUGINS_ERROR_KINDS, AGENT_PLUGINS_MESSAGES, AgentPluginsModule } from "@modules/domain/agent-plugins"
import { CUSTOMER_INTENTS_MESSAGES } from "@modules/domain/customer-turns"
import {
    INTENT_CONTRACTS_ERROR_KINDS,
    INTENT_CONTRACTS_MESSAGES,
    IntentContractsModule,
} from "@modules/domain/intent-contracts"
import type { ErrorKind } from "@modules/platform/errors"
import type { ApiOptions } from "../api.options"
import type { MessageBundle } from "@modules/platform/i18n"

/** The nodes this app installs: the core library's nodes and the effects, tools and data kinds they may use. */
const installedNodes: NodeInstall = {
    nodes: coreNodes,
    effects: coreEffects,
    tools: coreTools,
    dataKinds: coreDataKinds,
    words: modelWordsOf,
}

/** The agent work area of the API: the store that lets an agent be woken by an event or a clock and run one turn at a time per scope, the durable run of each wake, and the clock that wakes it. */
export const agentWorkModules = (options: ApiOptions): Array<DynamicModule> => [
    AgentWorkModule.register({ isGlobal: true, ...options.agentWork }),
    AgentRunsModule.register({ isGlobal: true, ...options.agentRuns }),
    EntityEngineModule.register({
        isGlobal: true,
        entities: FLOW_F_ENTITIES,
        jobs: MODULE_JOBS,
        alerts: AgentRunEngineAlertsService,
        cursorKey: options.entityEngine.cursorKey,
        buildId: options.entityEngine.buildId,
    }),
    GraphNodesModule.register({
        isGlobal: true,
        install: installedNodes,
        model: AiTasksService,
        tools: NodeToolDoorService,
    }),
    ChatNodePortsModule.register({ isGlobal: true }),
    SalesEffectsModule.register({ isGlobal: true }),
    IntentContractsModule.register({ isGlobal: true }),
    AgentPluginsModule.register({ isGlobal: true }),
    AgentInboundModule.register({ isGlobal: true, stopReporter: OfficeInboundStopReporterService }),
    AgentSchedulesModule.register({ isGlobal: true, reactive: true, voice: OfficeBackgroundVoiceService }),
]

/** The error kinds of the capabilities this group registers. */
export const agentWorkErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENT_WORK_ERROR_KINDS,
    AGENT_RUNS_ERROR_KINDS,
    ENTITY_ENGINE_ERROR_KINDS,
    GRAPH_NODES_ERROR_KINDS,
    CHAT_NODE_PORTS_ERROR_KINDS,
    SALES_EFFECTS_ERROR_KINDS,
    INTENT_CONTRACTS_ERROR_KINDS,
    AGENT_PLUGINS_ERROR_KINDS,
    AGENT_INBOUND_ERROR_KINDS,
    AGENT_SCHEDULES_ERROR_KINDS,
    AGENT_GRAPHS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers. */
export const agentWorkMessages: ReadonlyArray<MessageBundle> = [
    AGENT_WORK_MESSAGES,
    AGENT_RUNS_MESSAGES,
    ENTITY_ENGINE_MESSAGES,
    GRAPH_NODES_MESSAGES,
    CHAT_NODE_PORTS_MESSAGES,
    SALES_EFFECTS_MESSAGES,
    AGENT_INBOUND_MESSAGES,
    AGENT_SCHEDULES_MESSAGES,
    AGENT_GRAPHS_MESSAGES,
    INTENT_CONTRACTS_MESSAGES,
    AGENT_PLUGINS_MESSAGES,
    CUSTOMER_INTENTS_MESSAGES,
]

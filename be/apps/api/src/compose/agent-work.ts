import type { DynamicModule } from "@nestjs/common"
import { OfficeInboundStopReporterService } from "@modules/domain/messages"
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
import { AgentCheckpointsModule } from "@modules/domain/agent-checkpoints"
import { AgentDoorsModule } from "@modules/domain/agent-doors"
import { AGENT_THREADS_ERROR_KINDS, AgentThreadsModule, RUN_STOPS_ERROR_KINDS } from "@modules/domain/agent-threads"
import {
    AGENT_LOOPS,
    LANGGRAPH_ERROR_KINDS,
    LANGGRAPH_MESSAGES,
    LanggraphModule,
} from "@modules/integrations/langgraph"
import { AGENT_PLUGINS_ERROR_KINDS, AGENT_PLUGINS_MESSAGES, AgentPluginsModule } from "@modules/domain/agent-plugins"
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
        // `AGENT_LOOP` unset names no node: every step's agent then runs the SDK's JSON loop, as before.
        agentLoop: { nodes: options.agentLoop?.nodes ?? [], loops: AGENT_LOOPS },
    }),
    ChatNodePortsModule.register({ isGlobal: true }),
    SalesEffectsModule.register({ isGlobal: true }),
    IntentContractsModule.register({ isGlobal: true }),
    AgentPluginsModule.register({ isGlobal: true }),
    AgentInboundModule.register({ isGlobal: true, stopReporter: OfficeInboundStopReporterService }),
    AgentSchedulesModule.register({ isGlobal: true, reactive: true }),
    // The engine on LangGraph threads. The store of the checkpoints, the one integration that owns the library, and the thread
    // runs; with `AGENT_ENGINE_LANGGRAPH` unset the thread runs engage no workflow and every run is the old engine's, as before.
    AgentCheckpointsModule.register({ isGlobal: true }),
    LanggraphModule.register({ isGlobal: true, ...(options.langgraph ?? DEFAULT_LANGGRAPH) }),
    AgentThreadsModule.register({ isGlobal: true, ...(options.agentThreads ?? THREADS_OFF) }),
    // The owner's doors onto the agents' work: the schedule list with "run now", the care opt-out, handing a conversation back.
    AgentDoorsModule.register({ isGlobal: true }),
]

/** The bounds of the LangGraph integration for an app whose options name none (a test world): the parser's own defaults. */
const DEFAULT_LANGGRAPH = { compiledMax: 200, stepLimit: 500 } as const

/** The thread runs with the flag off. */
const THREADS_OFF = { workflows: [] } as const

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
    AGENT_THREADS_ERROR_KINDS,
    RUN_STOPS_ERROR_KINDS,
    LANGGRAPH_ERROR_KINDS,
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
    LANGGRAPH_MESSAGES,
]

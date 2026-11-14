import type { DynamicModule } from "@nestjs/common"
import { TeamChatChainStopReporterService } from "@modules/domain/team-chat"
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
import {
    GRAPH_NODES_ERROR_KINDS,
    GRAPH_NODES_MESSAGES,
    GraphNodesModule,
    type NodeInstall,
} from "@modules/domain/graph-nodes"
import { AiTasksService } from "@modules/domain/ai-tasks"
import { NodeToolDoorService } from "@modules/domain/tools"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    CHAT_NODE_PORTS_ERROR_KINDS,
    CHAT_NODE_PORTS_MESSAGES,
    ChatNodePortsModule,
} from "@modules/domain/chat-node-ports"
import { AGENT_GRAPHS_ERROR_KINDS, AGENT_GRAPHS_MESSAGES, AgentNodeRoutesService } from "@modules/domain/agent-graphs"
import { AgentCheckpointsModule } from "@modules/domain/agent-checkpoints"
import { AgentDoorsModule } from "@modules/domain/agent-doors"
import { AGENT_THREADS_ERROR_KINDS, AgentThreadsModule, RUN_STOPS_ERROR_KINDS } from "@modules/domain/agent-threads"
import {
    AGENT_LOOPS,
    LANGGRAPH_ERROR_KINDS,
    LANGGRAPH_MESSAGES,
    LanggraphModule,
} from "@modules/integrations/langgraph"
import {
    INTENT_CONTRACTS_MESSAGES,
} from "@modules/domain/intent-contracts"
import type { ErrorKind } from "@modules/platform/errors"
import type { ApiOptions } from "../api.options"
import type { MessageBundle } from "@modules/platform/i18n"
import { AvatarsService } from "@modules/domain/avatars"
import { WorkspaceSettingsModule } from "@modules/domain/workspace-settings"

/** The nodes this app installs: the nodes of every installed plugin (the core package and each plugin package) and the effects, tools and data kinds they may use. */
const installedNodes: NodeInstall = INSTALLED.nodeInstall()

/** The agent work area of the API: the store that lets an agent be woken by an event or a clock and run one turn at a time per scope, the durable run of each wake, and the clock that wakes it. */
export const agentWorkModules = (options: ApiOptions): Array<DynamicModule> => [
    AgentWorkModule.register({ isGlobal: true }),
    AgentRunsModule.register({ isGlobal: true, ...options.agentRuns }),
    EntityEngineModule.register({
        isGlobal: true,
        entities: INSTALLED.entities(),
        jobs: INSTALLED.jobs(),
        alerts: AgentRunEngineAlertsService,
        cursorKey: options.entityEngine.cursorKey,
        buildId: options.entityEngine.buildId,
    }),
    // The workspace's own settings (name, time zone, logo) and, in this app, the door people change them through.
    WorkspaceSettingsModule.register({ isGlobal: true, logos: AvatarsService }),
    GraphNodesModule.register({
        isGlobal: true,
        install: installedNodes,
        model: AiTasksService,
        tools: NodeToolDoorService,
        // `AGENT_LOOP` unset names no node: every step's agent then runs the SDK's JSON loop, as before.
        agentLoop: { nodes: options.agentLoop?.nodes ?? [], loops: AGENT_LOOPS },
        // The routes a routing step cannot follow in the workspace (`ctx.run.unreachable`): read from the pinned graph.
        routes: AgentNodeRoutesService,
    }),
    ChatNodePortsModule.register({ isGlobal: true }),
    AgentInboundModule.register({ isGlobal: true, stopReporter: TeamChatChainStopReporterService }),
    AgentSchedulesModule.register({ isGlobal: true, reactive: true }),
    // The engine on LangGraph threads: the store of the checkpoints, the one integration that owns the library, and the thread
    // runs (every workflow's runs).
    AgentCheckpointsModule.register({ isGlobal: true }),
    LanggraphModule.register({ isGlobal: true, ...(options.langgraph ?? DEFAULT_LANGGRAPH) }),
    AgentThreadsModule.register({ isGlobal: true, ...(options.agentThreads ?? THREADS_DEFAULT) }),
    // The owner's doors onto the agents' work: the schedule list with "run now", the care opt-out, handing a conversation back.
    AgentDoorsModule.register({ isGlobal: true }),
]

/** The bounds of the LangGraph integration for an app whose options name none (a test world): the parser's own defaults. */
const DEFAULT_LANGGRAPH = { compiledMax: 200, stepLimit: 500 } as const

/** The thread runs with their default tunables. */
const THREADS_DEFAULT = {} as const

/** The error kinds of the capabilities this group registers. */
export const agentWorkErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENT_WORK_ERROR_KINDS,
    AGENT_RUNS_ERROR_KINDS,
    ENTITY_ENGINE_ERROR_KINDS,
    GRAPH_NODES_ERROR_KINDS,
    CHAT_NODE_PORTS_ERROR_KINDS,
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
    AGENT_INBOUND_MESSAGES,
    AGENT_SCHEDULES_MESSAGES,
    AGENT_GRAPHS_MESSAGES,
    INTENT_CONTRACTS_MESSAGES,
    LANGGRAPH_MESSAGES,
]

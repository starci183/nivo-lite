import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentGraphApprovalsService } from "./agent-graph-approvals.service"
import type { AgentGraphsOptions } from "./agent-graphs.options"
import type { AgentGraphBrief, FlowTriggerMessages, GraphFactReader } from "./agent-graphs.port"
import type { GraphWorkDecisions } from "./graph-work-decisions.port"

/** Token of the agent-graphs options. */
export const AGENT_GRAPHS_OPTIONS: unique symbol = Symbol("domain.agent-graphs.options")

/** Token of the fact readers the app root registered. */
export const GRAPH_FACT_READERS: unique symbol = Symbol("domain.agent-graphs.fact-readers")

/** Injects the agent-graphs options. Parameter type: AgentGraphsOptions. */
export const InjectAgentGraphsOptions = (): TypedParameterDecorator<AgentGraphsOptions> =>
    injector<AgentGraphsOptions>(AGENT_GRAPHS_OPTIONS)

/** Injects the fact readers. Parameter type: ReadonlyArray<GraphFactReader>. */
export const InjectGraphFactReaders = (): TypedParameterDecorator<ReadonlyArray<GraphFactReader>> =>
    injector<ReadonlyArray<GraphFactReader>>(GRAPH_FACT_READERS)

/** Token of the approval road of the graph; an app that judges branches with no road behind them binds none. */
export const AGENT_GRAPH_APPROVALS: unique symbol = Symbol("domain.agent-graphs.approvals")

/** The work owner's decision road, bound by the app root. */
export const GRAPH_WORK_DECISIONS: unique symbol = Symbol("domain.agent-graphs.work-decisions")

/** Injects the transaction-owning work decision road. Parameter type: GraphWorkDecisions. */
export const InjectGraphWorkDecisions = (): TypedParameterDecorator<GraphWorkDecisions> =>
    injector<GraphWorkDecisions>(GRAPH_WORK_DECISIONS)

/** Injects the approval road. Parameter type: AgentGraphApprovalsService. */
export const InjectAgentGraphApprovals = (): TypedParameterDecorator<AgentGraphApprovalsService> =>
    injector<AgentGraphApprovalsService>(AGENT_GRAPH_APPROVALS)

/** Token of the action graph brief port: absent until the action graph binds one, and then a turn lists no intents. */
export const AGENT_GRAPH_BRIEF: unique symbol = Symbol("domain.agent-graphs.graph-brief")

/** Injects the action graph brief port. Parameter type: AgentGraphBrief. */
export const InjectAgentGraphBrief = (): TypedParameterDecorator<AgentGraphBrief> =>
    injector<AgentGraphBrief>(AGENT_GRAPH_BRIEF)

/** Token of the port that reads the customer messages a node graph's run answers. Absent until the conversations capability binds it. */
export const GRAPH_FLOW_TRIGGER_MESSAGES: unique symbol = Symbol("domain.agent-graphs.flow-trigger-messages")

/** Injects the flow trigger messages port. Parameter type: FlowTriggerMessages. */
export const InjectFlowTriggerMessages = (): TypedParameterDecorator<FlowTriggerMessages> =>
    injector<FlowTriggerMessages>(GRAPH_FLOW_TRIGGER_MESSAGES)

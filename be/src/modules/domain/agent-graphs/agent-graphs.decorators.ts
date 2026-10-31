import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentGraphApprovalsService } from "./agent-graph-approvals.service"
import type { AgentGraphsOptions } from "./agent-graphs.options"
import type { GraphFactReader } from "./agent-graphs.port"

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

/** Injects the approval road. Parameter type: AgentGraphApprovalsService. */
export const InjectAgentGraphApprovals = (): TypedParameterDecorator<AgentGraphApprovalsService> =>
    injector<AgentGraphApprovalsService>(AGENT_GRAPH_APPROVALS)

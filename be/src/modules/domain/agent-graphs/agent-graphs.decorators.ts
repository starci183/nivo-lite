import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
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

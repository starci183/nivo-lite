import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { LanggraphOptions } from "./langgraph.options"
import type { GraphThreads } from "./langgraph.port"

/** Token of the integration's options, exported so a spec can provide them. */
export const LANGGRAPH_OPTIONS: unique symbol = Symbol("integrations.langgraph.options")

/** Token of the checkpoint saver the client compiles every graph over; the `persistence` folder provides the class, a spec a double. */
export const GRAPH_CHECKPOINTS: unique symbol = Symbol("integrations.langgraph.checkpoints")

/** Token of the threads port. */
export const GRAPH_THREADS: unique symbol = Symbol("integrations.langgraph.threads")

/** Injects the integration's options. Parameter type: LanggraphOptions. */
export const InjectLanggraphOptions = (): TypedParameterDecorator<LanggraphOptions> =>
    injector<LanggraphOptions>(LANGGRAPH_OPTIONS)

/** Injects the checkpoint saver. Parameter type: BaseCheckpointSaver. */
export const InjectGraphCheckpoints = (): TypedParameterDecorator<BaseCheckpointSaver> =>
    injector<BaseCheckpointSaver>(GRAPH_CHECKPOINTS)

/** Injects the threads of the engine. Parameter type: GraphThreads. */
export const InjectGraphThreads = (): TypedParameterDecorator<GraphThreads> => injector<GraphThreads>(GRAPH_THREADS)

import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentThreadsOptions } from "./agent-threads.options"

/** Token of the thread runs' options, exported so a spec can provide them. */
export const AGENT_THREADS_OPTIONS: unique symbol = Symbol("domain.agent-threads.options")

/** Injects the options of the thread runs. Parameter type: AgentThreadsOptions. */
export const InjectAgentThreadsOptions = (): TypedParameterDecorator<AgentThreadsOptions> =>
    injector<AgentThreadsOptions>(AGENT_THREADS_OPTIONS)

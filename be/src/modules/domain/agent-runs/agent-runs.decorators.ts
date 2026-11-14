import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentRunsOptions } from "./agent-runs.options"

/** Token of the agent-runs options, exported so a spec can provide it. */
export const AGENT_RUNS_OPTIONS: unique symbol = Symbol("domain.agent-runs.options")

/** Injects the options of the agent runs. Parameter type: AgentRunsOptions. */
export const InjectAgentRunsOptions = (): TypedParameterDecorator<AgentRunsOptions> =>
    injector<AgentRunsOptions>(AGENT_RUNS_OPTIONS)

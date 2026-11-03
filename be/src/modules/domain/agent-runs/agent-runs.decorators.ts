import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentRunItemVerdicts, AgentRunWaitTimeout } from "./agent-runs-engine.contracts"
import type { AgentRunsOptions } from "./agent-runs.options"

/** Token of the wait timeout port: the graph applies the timeout of the branch a work item waits on. Absent until a capability binds one. */
export const AGENT_RUN_WAIT_TIMEOUT: unique symbol = Symbol("domain.agent-runs.wait-timeout")

/** Injects the wait timeout port. Parameter type: AgentRunWaitTimeout. */
export const InjectAgentRunWaitTimeout = (): TypedParameterDecorator<AgentRunWaitTimeout> =>
    injector<AgentRunWaitTimeout>(AGENT_RUN_WAIT_TIMEOUT)

/** Token of the item verdicts port: reads which work items closed by a decision. Absent until a capability binds one. */
export const AGENT_RUN_ITEM_VERDICTS: unique symbol = Symbol("domain.agent-runs.item-verdicts")

/** Injects the item verdicts port. Parameter type: AgentRunItemVerdicts. */
export const InjectAgentRunItemVerdicts = (): TypedParameterDecorator<AgentRunItemVerdicts> =>
    injector<AgentRunItemVerdicts>(AGENT_RUN_ITEM_VERDICTS)

/** Token of the agent-runs options, exported so a spec can provide it. */
export const AGENT_RUNS_OPTIONS: unique symbol = Symbol("domain.agent-runs.options")

/** Injects the options of the agent runs. Parameter type: AgentRunsOptions. */
export const InjectAgentRunsOptions = (): TypedParameterDecorator<AgentRunsOptions> =>
    injector<AgentRunsOptions>(AGENT_RUNS_OPTIONS)

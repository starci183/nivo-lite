import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentRunWaitTimeout } from "./agent-runs-engine.contracts"

/** Token of the wait timeout port: the graph applies the timeout of the branch a work item waits on. Absent until a capability binds one. */
export const AGENT_RUN_WAIT_TIMEOUT: unique symbol = Symbol("domain.agent-runs.wait-timeout")

/** Injects the wait timeout port. Parameter type: AgentRunWaitTimeout. */
export const InjectAgentRunWaitTimeout = (): TypedParameterDecorator<AgentRunWaitTimeout> =>
    injector<AgentRunWaitTimeout>(AGENT_RUN_WAIT_TIMEOUT)

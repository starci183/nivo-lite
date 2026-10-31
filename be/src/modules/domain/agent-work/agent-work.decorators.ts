import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentTurnExecutor } from "./agent-work.port"

/** Token of the turn executor port: absent until a capability binds one, and then every wake is held for want of it. */
export const AGENT_TURN_EXECUTOR: unique symbol = Symbol("domain.agent-work.turn-executor")

/** Injects the turn executor port. Parameter type: AgentTurnExecutor. */
export const InjectAgentTurnExecutor = (): TypedParameterDecorator<AgentTurnExecutor> =>
    injector<AgentTurnExecutor>(AGENT_TURN_EXECUTOR)

import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentTurnExecutor, WakeInterruptions } from "./agent-work.port"

/** Token of the turn executor port: absent until a capability binds one, and then every wake is held for want of it. */
export const AGENT_TURN_EXECUTOR: unique symbol = Symbol("domain.agent-work.turn-executor")

/** Injects the turn executor port. Parameter type: AgentTurnExecutor. */
export const InjectAgentTurnExecutor = (): TypedParameterDecorator<AgentTurnExecutor> =>
    injector<AgentTurnExecutor>(AGENT_TURN_EXECUTOR)

/** Token of the wake interruptions port: the durable runs bind it; with none bound a runtime that goes down only holds the line. */
export const AGENT_WAKE_INTERRUPTIONS: unique symbol = Symbol("domain.agent-work.wake-interruptions")

/** Injects the wake interruptions port. Parameter type: WakeInterruptions. */
export const InjectWakeInterruptions = (): TypedParameterDecorator<WakeInterruptions> =>
    injector<WakeInterruptions>(AGENT_WAKE_INTERRUPTIONS)

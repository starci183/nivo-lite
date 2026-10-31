import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentTurnQueue } from "./agent-turn.queue"

/** Token of the agent-turn queue producer, for the capabilities that enqueue a drain. */
export const AGENT_TURN_QUEUE_PRODUCER: unique symbol = Symbol("queues.agent-turn.producer")

/** Injects the agent-turn queue producer. Parameter type: AgentTurnQueue. */
export const InjectAgentTurnQueue = (): TypedParameterDecorator<AgentTurnQueue> =>
    injector<AgentTurnQueue>(AGENT_TURN_QUEUE_PRODUCER)

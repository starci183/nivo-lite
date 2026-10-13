import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentsQueue } from "./agents.queue"

/** Token of the agents queue producer, for the capabilities that enqueue sync or generate jobs. */
export const AGENTS_QUEUE_PRODUCER: unique symbol = Symbol("queues.agents.producer")

/** Injects the agents queue producer. Parameter type: AgentsQueue. */
export const InjectAgentsQueue = (): TypedParameterDecorator<AgentsQueue> =>
    injector<AgentsQueue>(AGENTS_QUEUE_PRODUCER)

import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { BindingAgentsDirectory } from "./agent-connections.port"

/** Token of the agents port (agents capability). */
export const BINDING_AGENTS: unique symbol = Symbol("domain.agent-connections.agents")

/** Injects the agents port. Parameter type: BindingAgentsDirectory. */
export const InjectBindingAgents = (): TypedParameterDecorator<BindingAgentsDirectory> =>
    injector<BindingAgentsDirectory>(BINDING_AGENTS)

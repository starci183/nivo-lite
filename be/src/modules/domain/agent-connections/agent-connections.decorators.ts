import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { BindingAgentsDirectory, BindingManagers } from "./agent-connections.port"

/** Token of the agents port (agents capability). */
export const BINDING_AGENTS: unique symbol = Symbol("domain.agent-connections.agents")

/** Injects the agents port. Parameter type: BindingAgentsDirectory. */
export const InjectBindingAgents = (): TypedParameterDecorator<BindingAgentsDirectory> =>
    injector<BindingAgentsDirectory>(BINDING_AGENTS)

/** Token of the manager scope port (agents capability); optional, and a manager is refused without it. */
export const BINDING_MANAGERS: unique symbol = Symbol("domain.agent-connections.managers")

/** Injects the manager scope port, when the app gives one. Parameter type: BindingManagers. */
export const InjectBindingManagers = (): TypedParameterDecorator<BindingManagers> =>
    injector<BindingManagers>(BINDING_MANAGERS)

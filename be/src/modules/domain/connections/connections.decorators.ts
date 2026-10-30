import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ConnectionsConfig } from "./connections.options"
import type { ConnectionAgentsDirectory } from "./connections.port"

/** Token of the connections options, exported so a spec can provide it. */
export const CONNECTIONS_OPTIONS: unique symbol = Symbol("domain.connections.options")

/** Injects the options of the connections capability. Parameter type: ConnectionsConfig (the env part; ports are bound separately). */
export const InjectConnectionsOptions = (): TypedParameterDecorator<ConnectionsConfig> =>
    injector<ConnectionsConfig>(CONNECTIONS_OPTIONS)

/** Token of the agents port (agent-connections lane); absent in an app that composes no agents. */
export const CONNECTION_AGENTS: unique symbol = Symbol("domain.connections.agents")

/** Injects the agents port. Parameter type: ConnectionAgentsDirectory. */
export const InjectConnectionAgents = (): TypedParameterDecorator<ConnectionAgentsDirectory> =>
    injector<ConnectionAgentsDirectory>(CONNECTION_AGENTS)

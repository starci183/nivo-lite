import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ConnectionsOptions } from "./connections.options"

/** Token of the connections options, exported so a spec can provide it. */
export const CONNECTIONS_OPTIONS: unique symbol = Symbol("domain.connections.options")

/** Injects the options of the connections capability. Parameter type: ConnectionsOptions. */
export const InjectConnectionsOptions = (): TypedParameterDecorator<ConnectionsOptions> =>
    injector<ConnectionsOptions>(CONNECTIONS_OPTIONS)

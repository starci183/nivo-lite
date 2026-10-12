import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { GatewaySocketFactory } from "./gateway.client"
import type { OpenclawOptions } from "./openclaw.options"

/** Token of the OpenClaw options, exported so a spec can provide it. */
export const OPENCLAW_OPTIONS: unique symbol = Symbol("integrations.openclaw.options")

/** Token of the factory that opens a gateway socket. */
export const OPENCLAW_SOCKET_FACTORY: unique symbol = Symbol("integrations.openclaw.socket-factory")

/** Injects the OpenClaw options. Parameter type: OpenclawOptions. */
export const InjectOpenclawOptions = (): TypedParameterDecorator<OpenclawOptions> =>
    injector<OpenclawOptions>(OPENCLAW_OPTIONS)

/** Injects the gateway socket factory. Parameter type: GatewaySocketFactory. */
export const InjectOpenclawSocketFactory = (): TypedParameterDecorator<GatewaySocketFactory> =>
    injector<GatewaySocketFactory>(OPENCLAW_SOCKET_FACTORY)

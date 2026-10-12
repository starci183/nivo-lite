import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { GatewaySocketFactory } from "./gateway.client"
import type { OpenclawFiles } from "./openclaw-files.port"
import type { OpenclawOptions } from "./openclaw.options"

/** Token of the OpenClaw options, exported so a spec can provide it. */
export const OPENCLAW_OPTIONS: unique symbol = Symbol("integrations.openclaw.options")

/** Token of the factory that opens a gateway socket. */
export const OPENCLAW_SOCKET_FACTORY: unique symbol = Symbol("integrations.openclaw.socket-factory")

/** Token of the file system port. */
export const OPENCLAW_FILES: unique symbol = Symbol("integrations.openclaw.files")

/** Injects the OpenClaw options. Parameter type: OpenclawOptions. */
export const InjectOpenclawOptions = (): TypedParameterDecorator<OpenclawOptions> =>
    injector<OpenclawOptions>(OPENCLAW_OPTIONS)

/** Injects the gateway socket factory. Parameter type: GatewaySocketFactory. */
export const InjectOpenclawSocketFactory = (): TypedParameterDecorator<GatewaySocketFactory> =>
    injector<GatewaySocketFactory>(OPENCLAW_SOCKET_FACTORY)

/** Injects the file system port. Parameter type: OpenclawFiles. */
export const InjectOpenclawFiles = (): TypedParameterDecorator<OpenclawFiles> => injector<OpenclawFiles>(OPENCLAW_FILES)

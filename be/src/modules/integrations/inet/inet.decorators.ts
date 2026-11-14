import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { InetClient } from "./inet.client"
import type { InetOptions } from "./inet.options"

/** Token of the iNET client. */
export const INET: unique symbol = Symbol("integrations.inet")

/** Token of the options of the iNET integration, exported so a spec can provide it. */
export const INET_OPTIONS: unique symbol = Symbol("integrations.inet.options")

/** Injects the options of the iNET integration. Parameter type: InetOptions. */
export const InjectInetOptions = (): TypedParameterDecorator<InetOptions> => injector<InetOptions>(INET_OPTIONS)

/** Injects the iNET client. Parameter type: InetClient. */
export const InjectInet = (): TypedParameterDecorator<InetClient> => injector<InetClient>(INET)

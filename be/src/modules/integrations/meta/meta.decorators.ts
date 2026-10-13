import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { MetaClient } from "./meta.client"
import type { MetaOptions } from "./meta.options"

/** Token of the options of the meta integration, exported so a spec can provide it. */
export const META_OPTIONS: unique symbol = Symbol("integrations.meta.options")

/** Token of the meta client. */
export const META_CLIENT: unique symbol = Symbol("integrations.meta.client")

/** Injects the options of the meta integration. Parameter type: MetaOptions. */
export const InjectMetaOptions = (): TypedParameterDecorator<MetaOptions> => injector<MetaOptions>(META_OPTIONS)

/** Injects the meta client. Parameter type: MetaClient. */
export const InjectMetaClient = (): TypedParameterDecorator<MetaClient> => injector<MetaClient>(META_CLIENT)

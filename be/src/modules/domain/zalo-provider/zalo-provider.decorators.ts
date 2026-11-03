import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ZaloProviderOptions } from "./zalo-provider.options"

/** Token of the zalo-inbox options, exported so a spec can provide it. */
export const ZALO_PROVIDER_OPTIONS: unique symbol = Symbol("domain.zalo-provider.options")

/** Injects the options of the zalo-provider capability. Parameter type: ZaloProviderOptions. */
export const InjectZaloProviderOptions = (): TypedParameterDecorator<ZaloProviderOptions> =>
    injector<ZaloProviderOptions>(ZALO_PROVIDER_OPTIONS)

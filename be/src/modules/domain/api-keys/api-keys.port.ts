import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ApiKeysOptions } from "./api-keys.options"

/** The options token of the api-keys capability. */
export const API_KEYS_OPTIONS: unique symbol = Symbol("domain.api-keys.options")

/** Injects the options of the api-keys capability. Parameter type: ApiKeysOptions. */
export const InjectApiKeysOptions = (): TypedParameterDecorator<ApiKeysOptions> =>
    injector<ApiKeysOptions>(API_KEYS_OPTIONS)

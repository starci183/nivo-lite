import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { TiktokClient } from "./tiktok.client"
import type { TiktokOptions } from "./tiktok.options"

/** Token of the TikTok client. */
export const TIKTOK: unique symbol = Symbol("integrations.tiktok")

/** Token of the options of the TikTok integration, exported so a spec can provide it. */
export const TIKTOK_OPTIONS: unique symbol = Symbol("integrations.tiktok.options")

/** Injects the options of the TikTok integration. Parameter type: TiktokOptions. */
export const InjectTiktokOptions = (): TypedParameterDecorator<TiktokOptions> => injector<TiktokOptions>(TIKTOK_OPTIONS)

/** Injects the TikTok client. Parameter type: TiktokClient. */
export const InjectTiktok = (): TypedParameterDecorator<TiktokClient> => injector<TiktokClient>(TIKTOK)

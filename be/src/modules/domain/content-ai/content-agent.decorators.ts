import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { MarketingAssets } from "./content-agent.port"
import type { ContentAiOptions } from "./content-ai.options"

/** Token of the options of the AI Marketing capability. */
export const CONTENT_AI_OPTIONS: unique symbol = Symbol("domain.content-ai.options")

/** Token of the object writer the root binds. */
export const MARKETING_ASSETS: unique symbol = Symbol("domain.content-ai.assets")

/** Injects the options. Parameter type: ContentAiOptions. */
export const InjectContentAiOptions = (): TypedParameterDecorator<ContentAiOptions> =>
    injector<ContentAiOptions>(CONTENT_AI_OPTIONS)

/** Injects the object writer. Parameter type: MarketingAssets. */
export const InjectMarketingAssets = (): TypedParameterDecorator<MarketingAssets> =>
    injector<MarketingAssets>(MARKETING_ASSETS)

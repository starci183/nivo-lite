import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { MetaPublishingClient } from "./meta-publishing.client"
import type { MetaPublishingOptions } from "./meta-publishing.options"

/** Token of the MetaPublishing client. */
export const META_PUBLISHING: unique symbol = Symbol("integrations.meta-publishing")

/** Token of the options of the MetaPublishing integration, exported so a spec can provide it. */
export const META_PUBLISHING_OPTIONS: unique symbol = Symbol("integrations.meta-publishing.options")

/** Injects the options of the MetaPublishing integration. Parameter type: MetaPublishingOptions. */
export const InjectMetaPublishingOptions = (): TypedParameterDecorator<MetaPublishingOptions> =>
    injector<MetaPublishingOptions>(META_PUBLISHING_OPTIONS)

/** Injects the MetaPublishing client. Parameter type: MetaPublishingClient. */
export const InjectMetaPublishing = (): TypedParameterDecorator<MetaPublishingClient> => injector<MetaPublishingClient>(META_PUBLISHING)

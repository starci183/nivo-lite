import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ProviderFileSink } from "@modules/domain/provider-registry"

/**
 * The token of the generic file store's sink (G3): bound by the app once the store exists. Without it a speech clip (answered in its
 * call, so it cannot be reopened) is refused `file_store_unavailable`, and an async job's files are answered as handles only.
 */
export const PROVIDER_FILE_SINK: unique symbol = Symbol("domain.media-tools.file-sink")

/** Injects the file sink of the generic media tools. Parameter type: ProviderFileSink. */
export const InjectProviderFileSink = (): TypedParameterDecorator<ProviderFileSink> => injector<ProviderFileSink>(PROVIDER_FILE_SINK)

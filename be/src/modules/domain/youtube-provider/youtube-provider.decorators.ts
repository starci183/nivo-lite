import type { PublishFileSource } from "@modules/domain/provider-registry"
import { injector, type TypedParameterDecorator } from "@modules/platform/composition"

/**
 * The token of the file door a publishing adapter reads a stored file through (a `PublishFileSource`): bound by the app once the generic
 * file store (G3) exists. Without it a video cannot be read and an upload is refused `not_available` (nothing sent).
 */
export const PUBLISH_FILE_SOURCE: unique symbol = Symbol("domain.youtube-provider.file-source")

/** Injects the file door a publishing adapter reads a stored file through. Parameter type: PublishFileSource | undefined. */
export const InjectPublishFileSource = (): TypedParameterDecorator<PublishFileSource | undefined> => injector<PublishFileSource | undefined>(PUBLISH_FILE_SOURCE)

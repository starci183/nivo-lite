import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"

/** Token of the storage door selected by the app root. */
export const CONTENT_MEDIA_STORAGE: unique symbol = Symbol("domain.content-media.storage")

/** Injects the private object storage door. Parameter type: StorageObjectsPort. */
export const InjectContentMediaStorage = (): TypedParameterDecorator<StorageObjectsPort> =>
    injector<StorageObjectsPort>(CONTENT_MEDIA_STORAGE)

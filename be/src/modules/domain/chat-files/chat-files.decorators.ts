import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"

/** Token of the storage door selected by the app root. */
export const CHAT_FILES_STORAGE: unique symbol = Symbol("domain.chat-files.storage")

/** Injects the private object storage door. Parameter type: StorageObjectsPort. */
export const InjectChatFilesStorage = (): TypedParameterDecorator<StorageObjectsPort> =>
    injector<StorageObjectsPort>(CHAT_FILES_STORAGE)

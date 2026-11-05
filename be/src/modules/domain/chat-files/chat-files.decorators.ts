import type { StorageAssetsPort, StorageObjectsPort } from "@modules/integrations/object-storage"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { InboundFileReader } from "./inbound-file.client"
import type { HostResolver } from "./host-resolver.client"

/** Token of the storage door selected by the app root. */
export const CHAT_FILES_STORAGE: unique symbol = Symbol("domain.chat-files.storage")

/** Token of the file store the files a channel brings in are written through. */
export const CHAT_FILES_ASSETS: unique symbol = Symbol("domain.chat-files.assets")

/** Token of the folder manual imports are read from. */
export const CHAT_FILES_IMPORT_ROOT: unique symbol = Symbol("domain.chat-files.import-root")

/** Token of the reader of local import files. */
export const CHAT_FILES_READER: unique symbol = Symbol("domain.chat-files.reader")

/** Injects the private object storage door. Parameter type: StorageObjectsPort. */
export const InjectChatFilesStorage = (): TypedParameterDecorator<StorageObjectsPort> =>
    injector<StorageObjectsPort>(CHAT_FILES_STORAGE)

/** Injects the file store. Parameter type: StorageAssetsPort. */
export const InjectChatFilesAssets = (): TypedParameterDecorator<StorageAssetsPort> =>
    injector<StorageAssetsPort>(CHAT_FILES_ASSETS)

/** Injects the folder manual imports are read from. Parameter type: string. */
export const InjectChatFilesImportRoot = (): TypedParameterDecorator<string> => injector<string>(CHAT_FILES_IMPORT_ROOT)

/** Injects the reader of local import files. Parameter type: InboundFileReader. */
export const InjectChatFilesReader = (): TypedParameterDecorator<InboundFileReader> =>
    injector<InboundFileReader>(CHAT_FILES_READER)

/** Token of the resolver of host names for downloads. */
export const CHAT_FILES_RESOLVER: unique symbol = Symbol("domain.chat-files.resolver")

/** Injects the resolver of host names. Parameter type: HostResolver. */
export const InjectChatFilesResolver = (): TypedParameterDecorator<HostResolver> =>
    injector<HostResolver>(CHAT_FILES_RESOLVER)

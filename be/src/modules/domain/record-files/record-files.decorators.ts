import type { StorageFilesPort } from "@modules/integrations/object-storage"
import { injector, type TypedParameterDecorator } from "@modules/platform/composition"

/** Token of the file store of the records selected by the app root. */
export const RECORD_FILES_STORAGE: unique symbol = Symbol("domain.record-files.storage")

/** Injects the file store of the records. Parameter type: StorageFilesPort. */
export const InjectRecordFilesStorage = (): TypedParameterDecorator<StorageFilesPort> =>
    injector<StorageFilesPort>(RECORD_FILES_STORAGE)

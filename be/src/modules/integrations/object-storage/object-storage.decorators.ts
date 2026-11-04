import { OBJECT_STORAGE } from "@starci/object-storage"
import type { ObjectStorage } from "@starci/object-storage"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ObjectStorageOptions } from "./object-storage.options"
import type { StorageAssetsPort, StorageObjectsPort } from "./object-storage.port"

export { OBJECT_STORAGE }

/** Token of the options of the storage integration, exported so a spec can provide it. */
export const STORAGE_OPTIONS: unique symbol = Symbol("integrations.object-storage.options")
/** Token of the objects service domains issue upload addresses and read stored objects through. */
export const STORAGE_OBJECTS: unique symbol = Symbol("integrations.object-storage.objects")
/** Token of the file store the render and seed jobs read and write whole files through. */
export const STORAGE_ASSETS: unique symbol = Symbol("integrations.object-storage.assets")

/** Injects the options of the storage integration. Parameter type: ObjectStorageOptions. */
export const InjectStorageOptions = (): TypedParameterDecorator<ObjectStorageOptions> =>
    injector<ObjectStorageOptions>(STORAGE_OPTIONS)

/** Injects the object storage port of `@starci/object-storage`. Parameter type: ObjectStorage. */
export const InjectObjectStorage = (): TypedParameterDecorator<ObjectStorage> => injector<ObjectStorage>(OBJECT_STORAGE)

/** Injects the objects service. Parameter type: StorageObjectsPort. */
export const InjectStorageObjects = (): TypedParameterDecorator<StorageObjectsPort> =>
    injector<StorageObjectsPort>(STORAGE_OBJECTS)

/** Injects the file store. Parameter type: StorageAssetsPort. */
export const InjectStorageAssets = (): TypedParameterDecorator<StorageAssetsPort> =>
    injector<StorageAssetsPort>(STORAGE_ASSETS)

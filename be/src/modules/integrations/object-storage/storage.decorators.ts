import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { S3Client } from "@aws-sdk/client-s3"
import type { StorageClient } from "./object-storage.contracts"
import type { ObjectStorageOptions } from "./storage.options"
import type { StorageSigner } from "./s3.client"
import type { StorageAssetsPort, StorageObjectsPort } from "./object-storage.port"

/** Token of the options of the storage integration, exported so a spec can provide it. */
export const STORAGE_OPTIONS: unique symbol = Symbol("integrations.object-storage.options")
/** Token of the AWS SDK client of the internal endpoint. */
export const S3_CLIENT: unique symbol = Symbol("integrations.object-storage.s3-client")
/** Token of the signer of presigned addresses for the public origin. */
export const STORAGE_SIGNER: unique symbol = Symbol("integrations.object-storage.signer")
/** Token of the S3 operations of the integration. */
export const STORAGE_CLIENT: unique symbol = Symbol("integrations.object-storage.client")
/** Token of the objects service domains issue upload addresses and read stored objects through. */
export const STORAGE_OBJECTS: unique symbol = Symbol("integrations.object-storage.objects")
/** Token of the file store the render and seed jobs read and write whole files through. */
export const STORAGE_ASSETS: unique symbol = Symbol("integrations.object-storage.assets")

/** Injects the options of the storage integration. Parameter type: ObjectStorageOptions. */
export const InjectStorageOptions = (): TypedParameterDecorator<ObjectStorageOptions> =>
    injector<ObjectStorageOptions>(STORAGE_OPTIONS)

/** Injects the AWS SDK client. Parameter type: S3Client. */
export const InjectS3Client = (): TypedParameterDecorator<S3Client> => injector<S3Client>(S3_CLIENT)

/** Injects the presigned-address signer. Parameter type: StorageSigner. */
export const InjectStorageSigner = (): TypedParameterDecorator<StorageSigner> => injector<StorageSigner>(STORAGE_SIGNER)

/** Injects the S3 operations. Parameter type: StorageClient. */
export const InjectStorageClient = (): TypedParameterDecorator<StorageClient> => injector<StorageClient>(STORAGE_CLIENT)

/** Injects the objects service. Parameter type: StorageObjectsPort. */
export const InjectStorageObjects = (): TypedParameterDecorator<StorageObjectsPort> =>
    injector<StorageObjectsPort>(STORAGE_OBJECTS)

/** Injects the file store. Parameter type: StorageAssetsPort. */
export const InjectStorageAssets = (): TypedParameterDecorator<StorageAssetsPort> =>
    injector<StorageAssetsPort>(STORAGE_ASSETS)

import { Injectable } from "@nestjs/common"
import type { ObjectStorage } from "@starci/object-storage"
import { ObjectStorageError, ObjectStorageErrorCode } from "./errors/object-storage.error"
import { InjectObjectStorage, InjectStorageOptions } from "./object-storage.decorators"
import type { ObjectStorageOptions } from "./object-storage.options"
import type { StorageAssetDownload, StorageAssetUpload, StorageAssetsPort } from "./object-storage.port"
import { bucketNameOf } from "./object-storage.policy"

@Injectable()
/** Whole files in and out of a bucket for the render and seed jobs; failures are answered as values, never thrown. */
export class StorageAssetsService implements StorageAssetsPort {
    constructor(
        @InjectObjectStorage() private readonly storage: ObjectStorage,
        @InjectStorageOptions() private readonly options: ObjectStorageOptions,
    ) {}

    /** Reads one file of a bucket. */
    async download(bucket: string, path: string): Promise<StorageAssetDownload> {
        try {
            const found = await this.storage.get(bucketNameOf(this.options.bucketPrefix, bucket), path)
            if (found === null) {
                return { data: null, error: new ObjectStorageError({ code: ObjectStorageErrorCode.ObjectNotFound }) }
            }
            return { data: new Blob([found.bytes], { type: found.contentType }), error: null }
        } catch (error_) {
            return { data: null, error: error_ instanceof Error ? error_ : new Error("storage failure") }
        }
    }

    /** Writes one file into a bucket, replacing an earlier file at the same path. */
    async upload(bucket: string, path: string, body: Buffer, contentType: string): Promise<StorageAssetUpload> {
        try {
            await this.storage.put(bucketNameOf(this.options.bucketPrefix, bucket), path, body, contentType)
            return { error: null }
        } catch (error_) {
            return { error: error_ instanceof Error ? error_ : new Error("storage failure") }
        }
    }
}

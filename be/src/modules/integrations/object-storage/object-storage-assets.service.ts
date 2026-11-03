import { Injectable } from "@nestjs/common"
import { OBJECT_STORAGE_ERROR_CODES, ObjectStorageError } from "@starci/object-storage"
import type { ObjectStorage } from "@starci/object-storage"
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
                return { data: null, error: new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.ObjectNotFound) }
            }
            return { data: new Blob([found.bytes], { type: found.contentType }), error: null }
        } catch (failure) {
            return { data: null, error: failure instanceof Error ? failure : new Error("storage failure") }
        }
    }

    /** Writes one file into a bucket, replacing an earlier file at the same path. */
    async upload(bucket: string, path: string, body: Buffer, contentType: string): Promise<StorageAssetUpload> {
        try {
            await this.storage.put(bucketNameOf(this.options.bucketPrefix, bucket), path, body, contentType)
            return { error: null }
        } catch (failure) {
            return { error: failure instanceof Error ? failure : new Error("storage failure") }
        }
    }
}

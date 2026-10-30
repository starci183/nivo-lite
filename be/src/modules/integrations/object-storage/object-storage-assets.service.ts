import { Injectable } from "@nestjs/common"
import { ObjectStorageError, ObjectStorageErrorCode } from "./errors/object-storage.error"
import type { StorageClient } from "./object-storage.contracts"
import { InjectStorageClient, InjectStorageOptions } from "./storage.decorators"
import type { ObjectStorageOptions } from "./storage.options"
import type { StorageAssetDownload, StorageAssetUpload, StorageAssetsPort } from "./object-storage.port"
import { bucketNameOf, objectKeyOf } from "./object-storage.policy"

@Injectable()
/** Whole files in and out of a bucket for the render and seed jobs; failures are answered as values, never thrown. */
export class StorageAssetsService implements StorageAssetsPort {
    constructor(
        @InjectStorageClient() private readonly client: StorageClient,
        @InjectStorageOptions() private readonly options: ObjectStorageOptions,
    ) {}

    /** Reads one file of a bucket. */
    async download(bucket: string, path: string): Promise<StorageAssetDownload> {
        try {
            const found = await this.client.get(bucketNameOf(this.options.bucketPrefix, bucket), objectKeyOf(path))
            if (found === null)
                return { data: null, error: new ObjectStorageError({ code: ObjectStorageErrorCode.ObjectNotFound }) }
            return { data: new Blob([found.bytes], { type: found.contentType }), error: null }
        } catch (failure) {
            return { data: null, error: failure instanceof Error ? failure : new Error("storage failure") }
        }
    }

    /** Writes one file into a bucket, replacing an earlier file at the same path. */
    async upload(bucket: string, path: string, body: Buffer, contentType: string): Promise<StorageAssetUpload> {
        try {
            await this.client.put(bucketNameOf(this.options.bucketPrefix, bucket), objectKeyOf(path), body, contentType)
            return { error: null }
        } catch (failure) {
            return { error: failure instanceof Error ? failure : new Error("storage failure") }
        }
    }
}

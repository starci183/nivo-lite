import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { StorageClient } from "./object-storage.contracts"
import { InjectStorageClient, InjectStorageOptions } from "./object-storage.decorators"
import { StorageLogEvent } from "./object-storage.log-events"
import type { ObjectStorageOptions } from "./object-storage.options"
import { STORAGE_BUCKETS, bucketNameOf } from "./object-storage.policy"

@Injectable()
/** Sets the buckets of an environment up: creates the missing ones and opens the picture bucket to anonymous reads. */
export class StorageBootstrapService {
    constructor(
        @InjectStorageClient() private readonly client: StorageClient,
        @InjectStorageOptions() private readonly options: ObjectStorageOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Ensures every bucket the product uses, one after the other, and logs each; safe to run again. */
    async bootstrap(): Promise<void> {
        await eachInOrder(STORAGE_BUCKETS, async (bucket) => {
            const name = bucketNameOf(this.options.bucketPrefix, bucket.purpose)
            await this.client.ensureBucket(name, bucket.publicRead)
            this.logger.info(StorageLogEvent.BucketReady, { bucket: name })
        })
    }
}

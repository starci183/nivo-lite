import { Injectable } from "@nestjs/common"
import type { ObjectStorage } from "@starci/object-storage"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectObjectStorage, InjectStorageOptions } from "./object-storage.decorators"
import { StorageLogEvent } from "./object-storage.log-events"
import type { ObjectStorageOptions } from "./object-storage.options"
import { STORAGE_BUCKETS, bucketNameOf } from "./object-storage.policy"

@Injectable()
/** Sets the buckets of an environment up: creates the missing ones and opens the picture bucket to anonymous reads. */
export class StorageBootstrapService {
    constructor(
        @InjectObjectStorage() private readonly storage: ObjectStorage,
        @InjectStorageOptions() private readonly options: ObjectStorageOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Ensures every bucket the product uses, one after the other, and logs each; safe to run again. */
    async bootstrap(): Promise<void> {
        await eachInOrder(STORAGE_BUCKETS, async (bucket) => {
            const name = bucketNameOf(this.options.bucketPrefix, bucket.purpose)
            await this.storage.ensureBucket(name, { publicRead: bucket.publicRead })
            this.logger.info(StorageLogEvent.BucketReady, { bucket: name })
        })
    }
}

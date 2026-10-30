import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder, ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { ObjectStorageError, ObjectStorageErrorCode } from "./errors/object-storage.error"
import type { SignedObjectUrl, StorageClient, StorageFailureCode } from "./object-storage.contracts"
import { InjectStorageClient, InjectStorageOptions } from "./object-storage.decorators"
import { StorageLogEvent } from "./object-storage.log-events"
import type { ObjectStorageOptions } from "./object-storage.options"
import type {
    ListedObjectsOutcome,
    ObjectSizeOutcome,
    RemovedObjectsOutcome,
    SignedObjectUrlsOutcome,
    SignedUploadOutcome,
    StorageObjectsPort,
    StoredObjectOutcome,
} from "./object-storage.port"
import { UPLOAD_URL_SECONDS, bucketNameOf, objectKeyOf, presignSecondsOf, publicUrlOf } from "./object-storage.policy"

const SIGN_PARALLEL = 16

@Injectable()
/** Issues upload addresses and reads objects through the S3 store; the only door domains have to storage. */
export class StorageObjectsService implements StorageObjectsPort {
    constructor(
        @InjectStorageClient() private readonly client: StorageClient,
        @InjectStorageOptions() private readonly options: ObjectStorageOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** A short-lived address a browser PUTs one object to at `path` of `bucket`. */
    signedUpload(bucket: string, path: string): Promise<SignedUploadOutcome> {
        return this.guard(bucket, async () => {
            const signedUrl = await this.client.presignPut(this.bucketOf(bucket), objectKeyOf(path), UPLOAD_URL_SECONDS)
            return { path, token: "", signedUrl }
        })
    }

    /** The bytes and content type of the object at `path` of `bucket`. */
    download(bucket: string, path: string): Promise<StoredObjectOutcome> {
        return this.guard(bucket, async () => {
            const found = await this.client.get(this.bucketOf(bucket), objectKeyOf(path))
            if (found === null) throw new ObjectStorageError({ code: ObjectStorageErrorCode.ObjectNotFound })
            return found
        })
    }

    /** The size in bytes of the object at `path` of `bucket`; the object is not read. */
    sizeOf(bucket: string, path: string): Promise<ObjectSizeOutcome> {
        return this.guard(bucket, async () => {
            const found = await this.client.head(this.bucketOf(bucket), objectKeyOf(path))
            if (found === null) throw new ObjectStorageError({ code: ObjectStorageErrorCode.ObjectNotFound })
            return found.size
        })
    }

    /** Lists files of one folder, newest first. */
    list(bucket: string, prefix: string, limit: number): Promise<ListedObjectsOutcome> {
        return this.guard(bucket, () => this.client.list(this.bucketOf(bucket), prefix, limit))
    }

    /** Signs read addresses; an object that is not there has no address. */
    async signedUrls(
        bucket: string,
        paths: ReadonlyArray<string>,
        expiresIn: number,
    ): Promise<SignedObjectUrlsOutcome> {
        if (paths.length === 0) return ok([])
        return this.guard(bucket, async () => {
            const physical = this.bucketOf(bucket)
            const seconds = presignSecondsOf(expiresIn)
            const groups = Array.from({ length: Math.ceil(paths.length / SIGN_PARALLEL) }, (_, index) =>
                paths.slice(index * SIGN_PARALLEL, (index + 1) * SIGN_PARALLEL),
            )
            const signed: Array<SignedObjectUrl> = []
            await eachInOrder(groups, async (group) => {
                const answers = await Promise.all(
                    group.map(async (path) => {
                        const key = objectKeyOf(path)
                        if ((await this.client.head(physical, key)) === null) return []
                        return [{ path, signedUrl: await this.client.presignGet(physical, key, seconds) }]
                    }),
                )
                signed.push(...answers.flat())
            })
            return signed
        })
    }

    /** Removes the objects at the paths of `bucket`; answers how many were removed. */
    async remove(bucket: string, paths: ReadonlyArray<string>): Promise<RemovedObjectsOutcome> {
        if (paths.length === 0) return ok(0)
        return this.guard(bucket, () => this.client.remove(this.bucketOf(bucket), paths.map(objectKeyOf)))
    }

    /** The address anyone reads the object at `path` of a public bucket at; no request is made. */
    publicUrl(bucket: string, path: string): string {
        return publicUrlOf(this.options.publicUrl, this.bucketOf(bucket), objectKeyOf(path))
    }

    private bucketOf(purpose: string): string {
        return bucketNameOf(this.options.bucketPrefix, purpose)
    }

    /** Runs one store call: an absent or invalid object is NOT_FOUND, every other failure is logged and UNAVAILABLE. */
    private async guard<T>(bucket: string, run: () => Promise<T>): Promise<Outcome<T, StorageFailureCode>> {
        try {
            return ok(await run())
        } catch (failure) {
            const notThere =
                failure instanceof ObjectStorageError &&
                (failure.code === ObjectStorageErrorCode.ObjectNotFound ||
                    failure.code === ObjectStorageErrorCode.KeyInvalid)
            if (notThere) return refused("OBJECT_STORAGE_NOT_FOUND")
            this.logger.error(StorageLogEvent.Failed, failure, { bucket })
            return refused("OBJECT_STORAGE_UNAVAILABLE")
        }
    }
}

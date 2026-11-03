import { Injectable } from "@nestjs/common"
import { OBJECT_STORAGE_ERROR_CODES, ObjectStorageError } from "@starci/object-storage"
import type { ObjectStorage } from "@starci/object-storage"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder, ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { SignedObjectUrl, StorageFailureCode } from "./object-storage.contracts"
import { InjectObjectStorage, InjectStorageOptions } from "./object-storage.decorators"
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
import { UPLOAD_URL_SECONDS, bucketNameOf, presignSecondsOf } from "./object-storage.policy"

const SIGN_PARALLEL = 16

/** The failure of an object that is not there. */
const missing = (bucket: string): ObjectStorageError =>
    new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.ObjectNotFound, { context: { bucket } })

@Injectable()
/** Issues upload addresses and reads objects through the object storage port; the only door domains have to storage. */
export class StorageObjectsService implements StorageObjectsPort {
    constructor(
        @InjectObjectStorage() private readonly storage: ObjectStorage,
        @InjectStorageOptions() private readonly options: ObjectStorageOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** A short-lived address a browser PUTs one object of `contentType` to at `path` of `bucket`. */
    signedUpload(bucket: string, path: string, contentType: string): Promise<SignedUploadOutcome> {
        return this.guard(bucket, async () => {
            const signed = await this.storage.presignPut(this.bucketOf(bucket), path, {
                contentType,
                expiresIn: UPLOAD_URL_SECONDS,
            })
            return { path, token: "", signedUrl: signed.url }
        })
    }

    /** The bytes and content type of the object at `path` of `bucket`. */
    download(bucket: string, path: string): Promise<StoredObjectOutcome> {
        return this.guard(bucket, async () => {
            const found = await this.storage.get(this.bucketOf(bucket), path)
            if (found === null) throw missing(bucket)
            return found
        })
    }

    /** The size in bytes of the object at `path` of `bucket`; the object is not read. */
    sizeOf(bucket: string, path: string): Promise<ObjectSizeOutcome> {
        return this.guard(bucket, async () => {
            const found = await this.storage.head(this.bucketOf(bucket), path)
            if (found === null) throw missing(bucket)
            return found.size
        })
    }

    /** Lists files of one folder, newest first. */
    list(bucket: string, prefix: string, limit: number): Promise<ListedObjectsOutcome> {
        return this.guard(bucket, async () => {
            const listed = await this.storage.list(this.bucketOf(bucket), prefix, limit)
            return listed.map((file) => ({ name: file.name, createdAt: file.lastModified }))
        })
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
                        if ((await this.storage.head(physical, path)) === null) return []
                        const address = await this.storage.presignGet(physical, path, { expiresIn: seconds })
                        return [{ path, signedUrl: address.url }]
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
        return this.guard(bucket, () => this.storage.removeMany(this.bucketOf(bucket), paths))
    }

    /** The address anyone reads the object at `path` of a public bucket at; no request is made. */
    publicUrl(bucket: string, path: string): string {
        return this.storage.publicUrl(this.bucketOf(bucket), path)
    }

    private bucketOf(purpose: string): string {
        return bucketNameOf(this.options.bucketPrefix, purpose)
    }

    /** Runs one store call: an absent or invalid object is NOT_FOUND, every other failure is logged and UNAVAILABLE. */
    private async guard<T>(bucket: string, run: () => Promise<T>): Promise<Outcome<T, StorageFailureCode>> {
        try {
            return ok(await run())
        } catch (failure) {
            if (failure instanceof ObjectStorageError && failure.kind !== "unavailable") {
                return refused(OBJECT_STORAGE_ERROR_CODES.ObjectNotFound)
            }
            this.logger.error(StorageLogEvent.Failed, failure, { bucket })
            return refused(OBJECT_STORAGE_ERROR_CODES.Unavailable)
        }
    }
}

import { Injectable } from "@nestjs/common"
import {
    OBJECT_STORAGE_ERROR_CODES,
    ObjectStorageError as StoreFailure,
    type ObjectStorage,
} from "@starci/object-storage"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ok, refused, type Outcome } from "@modules/platform/primitives"
import type { SignedFileLink, SignedFileUpload, StorageFailureCode, StoredFileHead } from "./object-storage.contracts"
import { InjectObjectStorage, InjectStorageOptions } from "./object-storage.decorators"
import { FILE_UPLOAD_SECONDS, RECORD_FILES_BUCKET, linkSecondsOf } from "./object-storage-files.policy"
import { StorageLogEvent } from "./object-storage.log-events"
import type { ObjectStorageOptions } from "./object-storage.options"
import type { StorageFilesPort, StoredObjectOutcome } from "./object-storage.port"
import { bucketNameOf } from "./object-storage.policy"

@Injectable()
/**
 * The one file store of the records over `@starci/object-storage`: every call is on the one records bucket of the environment. A
 * missing or refused object is NOT_FOUND; every other failure is logged and UNAVAILABLE. Failures are answered as values.
 */
export class StorageFilesService implements StorageFilesPort {
    constructor(
        @InjectObjectStorage() private readonly storage: ObjectStorage,
        @InjectStorageOptions() private readonly options: ObjectStorageOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** A presigned PUT of exactly `size` bytes of `mime` at `key`: the store refuses any other type or size. */
    signedUpload(key: string, mime: string, size: number): Promise<Outcome<SignedFileUpload, StorageFailureCode>> {
        return this.guard(async () => {
            const signed = await this.storage.presignPut(this.bucket(), key, {
                contentType: mime,
                contentLength: size,
                expiresIn: FILE_UPLOAD_SECONDS,
            })
            return { key, url: signed.url, headers: signed.headers, expiresAt: signed.expiresAt }
        })
    }

    /** The size and content type the store recorded for `key`. */
    async head(key: string): Promise<Outcome<StoredFileHead, StorageFailureCode>> {
        const found = await this.guard(() => this.storage.head(this.bucket(), key))
        if (found.kind === "refused") return found
        return found.value === null
            ? refused(OBJECT_STORAGE_ERROR_CODES.ObjectNotFound)
            : ok({ size: found.value.size, mime: found.value.contentType })
    }

    /** A presigned GET of `key` for at most seven days (one hour when `seconds` is not a number), saved under `downloadName`. */
    signedLink(key: string, seconds: number, downloadName: string): Promise<Outcome<SignedFileLink, StorageFailureCode>> {
        return this.guard(async () => {
            const signed = await this.storage.presignGet(this.bucket(), key, {
                expiresIn: linkSecondsOf(seconds),
                downloadName,
            })
            return { url: signed.url, expiresAt: signed.expiresAt }
        })
    }

    /** The bytes and content type of the object at `key`. */
    async read(key: string): Promise<StoredObjectOutcome> {
        const found = await this.guard(() => this.storage.get(this.bucket(), key))
        if (found.kind === "refused") return found
        return found.value === null ? refused(OBJECT_STORAGE_ERROR_CODES.ObjectNotFound) : ok(found.value)
    }

    /** Writes the bytes at `key`, replacing an earlier object. */
    write(key: string, bytes: Uint8Array, mime: string): Promise<Outcome<null, StorageFailureCode>> {
        return this.guard(async () => {
            await this.storage.put(this.bucket(), key, bytes, mime)
            return null
        })
    }

    /** Removes the object at `key`. */
    remove(key: string): Promise<Outcome<null, StorageFailureCode>> {
        return this.guard(async () => {
            await this.storage.remove(this.bucket(), key)
            return null
        })
    }

    private bucket(): string {
        return bucketNameOf(this.options.bucketPrefix, RECORD_FILES_BUCKET)
    }

    /** Runs one store call: a refused key or object is NOT_FOUND, every other failure is logged and UNAVAILABLE. */
    private async guard<T>(run: () => Promise<T>): Promise<Outcome<T, StorageFailureCode>> {
        try {
            return ok(await run())
        } catch (error) {
            if (error instanceof StoreFailure && error.kind !== "unavailable") {
                return refused(OBJECT_STORAGE_ERROR_CODES.ObjectNotFound)
            }
            this.logger.error(StorageLogEvent.Failed, error, { bucket: RECORD_FILES_BUCKET })
            return refused(OBJECT_STORAGE_ERROR_CODES.Unavailable)
        }
    }
}

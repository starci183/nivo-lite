import type { StoredObject } from "@starci/object-storage"
import type { Outcome } from "@modules/platform/primitives"
import type {
    ListedObject,
    SignedFileLink,
    SignedFileUpload,
    SignedObjectUrl,
    SignedUpload,
    StorageFailureCode,
    StoredFileHead,
} from "./object-storage.contracts"

/** The outcome of asking storage for an upload address. */
export type SignedUploadOutcome = Outcome<SignedUpload, StorageFailureCode>

/** The outcome of reading one stored object. */
export type StoredObjectOutcome = Outcome<StoredObject, StorageFailureCode>

/** The outcome of asking the size of one stored object, in bytes. */
export type ObjectSizeOutcome = Outcome<number, StorageFailureCode>

/** The outcome of listing the objects in one bucket folder. */
export type ListedObjectsOutcome = Outcome<ReadonlyArray<ListedObject>, StorageFailureCode>

/** The outcome of signing object read addresses. */
export type SignedObjectUrlsOutcome = Outcome<ReadonlyArray<SignedObjectUrl>, StorageFailureCode>

/** The outcome of removing objects: how many were removed. */
export type RemovedObjectsOutcome = Outcome<number, StorageFailureCode>

/** The storage door of the back end: upload addresses for browsers and object reads for workers. Buckets are purposes (`media`), never physical names. */
export interface StorageObjectsPort {
    /** A short-lived address a browser PUTs one object of `contentType` to at `path` of `bucket`; the browser must send that content type. */
    signedUpload(bucket: string, path: string, contentType: string): Promise<SignedUploadOutcome>
    /** The bytes and content type of the object at `path` of `bucket`. */
    download(bucket: string, path: string): Promise<StoredObjectOutcome>
    /** The size in bytes of the object at `path` of `bucket`, without reading it. */
    sizeOf(bucket: string, path: string): Promise<ObjectSizeOutcome>
    /** Lists files of one folder, newest first; subfolders are omitted. */
    list(bucket: string, prefix: string, limit: number): Promise<ListedObjectsOutcome>
    /** Signs read addresses for the requested paths; missing objects are omitted. */
    signedUrls(bucket: string, paths: ReadonlyArray<string>, expiresIn: number): Promise<SignedObjectUrlsOutcome>
    /** Removes the objects at the paths; answers how many were removed (missing ones are not counted). */
    remove(bucket: string, paths: ReadonlyArray<string>): Promise<RemovedObjectsOutcome>
    /** The address anyone reads the object at `path` of a public bucket at; no request is made. */
    publicUrl(bucket: string, path: string): string
}

/**
 * The ONE file store of the records: every call works on the one records bucket, keys follow the key law of
 * `object-storage-files.policy.ts`, and the caller (the engine's record files) has proved the workspace, the record and the field.
 */
export interface StorageFilesPort {
    /** A short-lived address a browser PUTs exactly `size` bytes of `mime` to at `key`; another type or size is refused by the store. */
    signedUpload(key: string, mime: string, size: number): Promise<Outcome<SignedFileUpload, StorageFailureCode>>
    /** The size and content type of the object at `key`, without reading it; NOT_FOUND when it is not there. */
    head(key: string): Promise<Outcome<StoredFileHead, StorageFailureCode>>
    /** A read link of the object at `key` for `seconds`, saved under `downloadName`; the object is not looked up. */
    signedLink(key: string, seconds: number, downloadName: string): Promise<Outcome<SignedFileLink, StorageFailureCode>>
    /** The bytes and content type of the object at `key`. */
    read(key: string): Promise<StoredObjectOutcome>
    /** Writes `bytes` of `mime` at `key`, replacing an earlier object. */
    write(key: string, bytes: Uint8Array, mime: string): Promise<Outcome<null, StorageFailureCode>>
    /** Removes the object at `key`; a missing one is not an error. */
    remove(key: string): Promise<Outcome<null, StorageFailureCode>>
}

/** The answer of reading a file for the render jobs: its bytes as a Blob, or why they could not be read. */
export type StorageAssetDownload =
    { readonly data: Blob; readonly error: null } | { readonly data: null; readonly error: Error }

/** The answer of writing a file for the render jobs: no error when the store accepted it. */
export interface StorageAssetUpload {
    /** The failure, or null on success. */
    readonly error: Error | null
}

/** The file store of the render and seed jobs: whole files in and out of a bucket. */
export interface StorageAssetsPort {
    /** Reads one file of a bucket. */
    download(bucket: string, path: string): Promise<StorageAssetDownload>
    /** Writes one file into a bucket, replacing an earlier one at the same path. */
    upload(bucket: string, path: string, body: Buffer, contentType: string): Promise<StorageAssetUpload>
}

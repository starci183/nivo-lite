import type { Outcome } from "@modules/platform/primitives"
import type {
    ListedObject,
    SignedObjectUrl,
    SignedUpload,
    StorageFailureCode,
    StoredObject,
} from "./object-storage.contracts"

/** The outcome of asking storage for an upload address. */
export type SignedUploadOutcome = Outcome<SignedUpload, StorageFailureCode>

/** The outcome of reading one stored object. */
export type StoredObjectOutcome = Outcome<StoredObject, StorageFailureCode>

/** The outcome of listing the objects in one bucket folder. */
export type ListedObjectsOutcome = Outcome<ReadonlyArray<ListedObject>, StorageFailureCode>

/** The outcome of signing object read addresses. */
export type SignedObjectUrlsOutcome = Outcome<ReadonlyArray<SignedObjectUrl>, StorageFailureCode>

/** The outcome of removing objects: how many were removed. */
export type RemovedObjectsOutcome = Outcome<number, StorageFailureCode>

/** The storage door of the back end: upload addresses for browsers and object reads for workers. Buckets are purposes (`media`), never physical names. */
export interface StorageObjectsPort {
    /** A short-lived address a browser PUTs one object to at `path` of `bucket`. */
    signedUpload(bucket: string, path: string): Promise<SignedUploadOutcome>
    /** The bytes and content type of the object at `path` of `bucket`. */
    download(bucket: string, path: string): Promise<StoredObjectOutcome>
    /** Lists files of one folder, newest first; subfolders are omitted. */
    list(bucket: string, prefix: string, limit: number): Promise<ListedObjectsOutcome>
    /** Signs read addresses for the requested paths; missing objects are omitted. */
    signedUrls(bucket: string, paths: ReadonlyArray<string>, expiresIn: number): Promise<SignedObjectUrlsOutcome>
    /** Removes the objects at the paths; answers how many were removed (missing ones are not counted). */
    remove(bucket: string, paths: ReadonlyArray<string>): Promise<RemovedObjectsOutcome>
    /** The address anyone reads the object at `path` of a public bucket at; no request is made. */
    publicUrl(bucket: string, path: string): string
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

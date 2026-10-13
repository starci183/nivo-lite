import type { Outcome } from "@modules/platform/primitives"
import type {
    ListedObject,
    SignedObjectUrl,
    SignedUpload,
    StorageFailureCode,
    StoredObject,
} from "./supabase.contracts"

/** The outcome of asking Storage for a signed upload address. */
export type SignedUploadOutcome = Outcome<SignedUpload, StorageFailureCode>

/** The outcome of reading one stored object. */
export type StoredObjectOutcome = Outcome<StoredObject, StorageFailureCode>

/** The outcome of listing the objects in one bucket folder. */
export type ListedObjectsOutcome = Outcome<ReadonlyArray<ListedObject>, StorageFailureCode>

/** The outcome of signing private object read addresses. */
export type SignedObjectUrlsOutcome = Outcome<ReadonlyArray<SignedObjectUrl>, StorageFailureCode>

/** The outcome of removing objects: how many were removed. */
export type RemovedObjectsOutcome = Outcome<number, StorageFailureCode>

/** The Storage door of the back end: upload addresses for browsers and object reads for workers. */
export interface SupabaseObjectsPort {
    /** A one-time address a browser PUTs one object to at `path` of `bucket`. */
    signedUpload(bucket: string, path: string): Promise<SignedUploadOutcome>
    /** The bytes and content type of the object at `path` of `bucket`. */
    download(bucket: string, path: string): Promise<StoredObjectOutcome>
    /** Lists files of one folder, newest first; subfolders are omitted. */
    list(bucket: string, prefix: string, limit: number): Promise<ListedObjectsOutcome>
    /** Signs read addresses for the requested paths; missing objects are omitted. */
    signedUrls(bucket: string, paths: ReadonlyArray<string>, expiresIn: number): Promise<SignedObjectUrlsOutcome>
    /** Removes the objects at the paths; answers how many were removed (missing ones are not counted). */
    remove(bucket: string, paths: ReadonlyArray<string>): Promise<RemovedObjectsOutcome>
}

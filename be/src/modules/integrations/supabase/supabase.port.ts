import type { Outcome } from "@modules/platform/primitives"
import type { SignedUpload, StorageFailureCode, StoredObject } from "./supabase.contracts"

/** The outcome of asking Storage for a signed upload address. */
export type SignedUploadOutcome = Outcome<SignedUpload, StorageFailureCode>

/** The outcome of reading one stored object. */
export type StoredObjectOutcome = Outcome<StoredObject, StorageFailureCode>

/** The Storage door of the back end: upload addresses for browsers and object reads for workers. */
export interface SupabaseObjectsPort {
    /** A one-time address a browser PUTs one object to at `path` of `bucket`. */
    signedUpload(bucket: string, path: string): Promise<SignedUploadOutcome>
    /** The bytes and content type of the object at `path` of `bucket`. */
    download(bucket: string, path: string): Promise<StoredObjectOutcome>
}

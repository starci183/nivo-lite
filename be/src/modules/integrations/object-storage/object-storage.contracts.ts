import type { OBJECT_STORAGE_ERROR_CODES } from "@starci/object-storage"

/** An address a browser PUTs one object to; `token` stays empty (a presigned S3 address needs none) and is kept for the upload shape the screens already read. */
export interface SignedUpload {
    /** The object path the upload lands at. */
    readonly path: string
    /** Always empty: a presigned address carries its own signature. */
    readonly token: string
    /** The presigned address to PUT the object to. */
    readonly signedUrl: string
}

/** One object listed in a bucket folder, without its bytes. */
export interface ListedObject {
    /** The file name relative to the requested folder. */
    readonly name: string
    /** When the store recorded the object, when known. */
    readonly createdAt: string | null
}

/** A short-lived read address for one object. */
export interface SignedObjectUrl {
    /** The object path in its bucket. */
    readonly path: string
    /** The presigned address. */
    readonly signedUrl: string
}

/** Why storage refused: the object is not there, or the store could not be reached. */
export type StorageFailureCode =
    typeof OBJECT_STORAGE_ERROR_CODES.ObjectNotFound | typeof OBJECT_STORAGE_ERROR_CODES.Unavailable

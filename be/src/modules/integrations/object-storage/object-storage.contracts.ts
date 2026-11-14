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

/** An address a browser PUTs one record file to: the content type and the exact size are part of the signature. */
export interface SignedFileUpload {
    /** The object key the upload lands at. */
    readonly key: string
    /** The presigned address. */
    readonly url: string
    /** The headers the browser must send unchanged (the signed `Content-Type` and `Content-Length`). */
    readonly headers: Readonly<Record<string, string>>
    /** When the address stops working, ISO-8601. */
    readonly expiresAt: string
}

/** What the store records about one record file, read without its bytes. */
export interface StoredFileHead {
    /** The size in bytes. */
    readonly size: number
    /** The content type the store recorded. */
    readonly mime: string
}

/** A short-lived read link of one record file. */
export interface SignedFileLink {
    /** The presigned address. */
    readonly url: string
    /** When it stops working, ISO-8601. */
    readonly expiresAt: string
}

/** Why storage refused: the object is not there, or the store could not be reached. */
export type StorageFailureCode =
    typeof OBJECT_STORAGE_ERROR_CODES.ObjectNotFound | typeof OBJECT_STORAGE_ERROR_CODES.Unavailable

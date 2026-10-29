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

/** Why storage refused: the object is not there, or the store could not be reached (the values of the matching ObjectStorageErrorCode members). */
export type StorageFailureCode = "OBJECT_STORAGE_NOT_FOUND" | "OBJECT_STORAGE_UNAVAILABLE"

/** One stored object read back. */
export interface StoredObject {
    /** The bytes. */
    readonly bytes: Uint8Array
    /** The content type the store recorded. */
    readonly contentType: string
}

/** The size of one stored object. */
export interface ObjectSize {
    /** The size in bytes. */
    readonly size: number
}

/** A stored object, or null when it is not there. */
export type FoundObject = StoredObject | null

/** The size of a stored object, or null when it is not there. */
export type FoundSize = ObjectSize | null

/**
 * The S3 operations the integration is built from, on physical bucket names. The AWS SDK implements it in one file; a double
 * implements it in the specs. A missing object answers null; every other failure rejects with a ObjectStorageError.
 */
export interface StorageClient {
    /** Writes one object, replacing an earlier one at the key. */
    put(bucket: string, key: string, body: Uint8Array, contentType: string): Promise<void>
    /** Reads one object; null when it is not there. */
    get(bucket: string, key: string): Promise<FoundObject>
    /** The size of one object; null when it is not there. */
    head(bucket: string, key: string): Promise<FoundSize>
    /** Removes the objects; answers how many were removed. */
    remove(bucket: string, keys: ReadonlyArray<string>): Promise<number>
    /** The files directly under a folder, newest first, up to `limit`. */
    list(bucket: string, folder: string, limit: number): Promise<ReadonlyArray<ListedObject>>
    /** A presigned read address valid for `expiresIn` seconds, signed for the public origin. */
    presignGet(bucket: string, key: string, expiresIn: number): Promise<string>
    /** A presigned upload address valid for `expiresIn` seconds, signed for the public origin. */
    presignPut(bucket: string, key: string, expiresIn: number): Promise<string>
    /** Creates the bucket when it is missing; a public one gets an anonymous read policy. */
    ensureBucket(bucket: string, publicRead: boolean): Promise<void>
}

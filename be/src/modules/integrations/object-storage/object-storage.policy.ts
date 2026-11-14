import { ObjectStorageError, ObjectStorageErrorCode } from "./errors/object-storage.error"
import { RECORD_FILES_BUCKET } from "./object-storage-files.policy"

/** The longest a SigV4 presigned address lives (seven days). */
export const MAX_PRESIGN_SECONDS = 604_800

/** How long an upload address stays valid. */
export const UPLOAD_URL_SECONDS = 900

const BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u
const PREFIX = /^[a-z0-9][a-z0-9-]*$/u

/** The TTL of a presigned address: a whole number of seconds, at least one and at most seven days. */
export const presignSecondsOf = (requested: number): number =>
    Math.min(MAX_PRESIGN_SECONDS, Math.max(1, Math.floor(Number.isFinite(requested) ? requested : 1)))

/** The bucket of a purpose in an environment: `<prefix>-<purpose>` with underscores turned to hyphens (`avatars_public` -> `nivo-avatars-public`). */
export const bucketNameOf = (prefix: string, purpose: string): string => {
    const name = `${prefix}-${purpose.toLowerCase().replaceAll("_", "-")}`
    if (!PREFIX.test(prefix) || !BUCKET_NAME.test(name)) {
        throw new ObjectStorageError({ code: ObjectStorageErrorCode.BucketInvalid, params: { bucket: name } })
    }
    return name
}

/** A purpose bucket of the product and whether anonymous readers may fetch its objects. */
export interface StorageBucket {
    /** The purpose name the domains use. */
    readonly purpose: string
    /** True when objects are read at their public address. */
    readonly publicRead: boolean
}

/**
 * Every purpose bucket: pictures are public, everything else is private and read through presigned addresses. The records bucket is
 * the ONE store of every file a declared record type keeps; the others belong to the features that still hold their own.
 */
export const STORAGE_BUCKETS: ReadonlyArray<StorageBucket> = [
    { purpose: "avatars_public", publicRead: true },
    { purpose: "media", publicRead: false },
    { purpose: "knowledge-uploads", publicRead: false },
    { purpose: RECORD_FILES_BUCKET, publicRead: false },
]

/** The content type an upload is signed with, or null when the kind admits none. */
export type UploadContentType = string | null

/** The content type the browser reported when the kind admits it (case and parameters ignored), else null. */
export const reportedUploadTypeOf = (admitted: ReadonlyMap<string, string>, given: string): UploadContentType => {
    const asked = given.replace(/;.*/su, "").trim().toLowerCase()
    return [...admitted.values()].includes(asked) ? asked : null
}

/**
 * The content type an upload of one kind is signed with: the browser's own when the kind admits it, else the one the extension of
 * the file name names; null when the kind admits neither, so the upload is refused and never signed as an anonymous binary.
 */
export const uploadContentTypeOf = (
    admitted: ReadonlyMap<string, string>,
    filename: string,
    given: string,
): UploadContentType => {
    const reported = reportedUploadTypeOf(admitted, given)
    if (reported !== null) return reported
    const dot = filename.lastIndexOf(".")
    return dot < 0 ? null : (admitted.get(filename.slice(dot + 1).toLowerCase()) ?? null)
}

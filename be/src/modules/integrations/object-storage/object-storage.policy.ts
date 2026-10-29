import { ObjectStorageError, ObjectStorageErrorCode } from "./errors/object-storage.error"

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
        throw new ObjectStorageError({ code: ObjectStorageErrorCode.KeyInvalid, params: { key: name } })
    }
    return name
}

const FORBIDDEN_CHARACTER = /[\p{Cc}\\]/u

const hasForbiddenCharacter = (path: string): boolean => FORBIDDEN_CHARACTER.test(path)

/** The object key for a path: unchanged when it is a relative path of clean segments, else a KeyInvalid error. */
export const objectKeyOf = (path: string): string => {
    const segments = path.split("/")
    const clean =
        path.length > 0 &&
        path.length <= 1024 &&
        segments.every((segment) => segment !== "" && segment !== "." && segment !== "..") &&
        !hasForbiddenCharacter(path)
    if (!clean) throw new ObjectStorageError({ code: ObjectStorageErrorCode.KeyInvalid, params: { key: path } })
    return path
}

/** The text without the slashes at its end. */
export const withoutTrailingSlashes = (text: string): string => {
    let end = text.length
    while (end > 0 && text.charAt(end - 1) === "/") end -= 1
    return text.slice(0, end)
}

/** The address anyone reads an object of a public bucket at: `<public origin>/<bucket>/<key>`, each segment encoded. */
export const publicUrlOf = (publicUrl: string, bucketName: string, key: string): string =>
    `${withoutTrailingSlashes(publicUrl)}/${bucketName}/${key.split("/").map(encodeURIComponent).join("/")}`

/** A purpose bucket of the product and whether anonymous readers may fetch its objects. */
export interface StorageBucket {
    /** The purpose name the domains use. */
    readonly purpose: string
    /** True when objects are read at their public address. */
    readonly publicRead: boolean
}

/** Every purpose bucket: pictures are public, everything else is private and read through presigned addresses. */
export const STORAGE_BUCKETS: ReadonlyArray<StorageBucket> = [
    { purpose: "avatars_public", publicRead: true },
    { purpose: "media", publicRead: false },
    { purpose: "videos", publicRead: false },
    { purpose: "hiring", publicRead: false },
    { purpose: "knowledge-uploads", publicRead: false },
]

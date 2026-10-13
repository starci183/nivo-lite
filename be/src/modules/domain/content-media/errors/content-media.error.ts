import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the workspace content-media capability. */
export enum ContentMediaErrorCode {
    /** The requested file is not an accepted type or size. */
    UploadInvalid = "CONTENT_MEDIA_UPLOAD_INVALID",
    /** A requested object path is outside the selected workspace. */
    PathInvalid = "CONTENT_MEDIA_PATH_INVALID",
    /** The storage provider could not issue addresses or list files. */
    StorageUnavailable = "CONTENT_MEDIA_STORAGE_UNAVAILABLE",
}

/** How each content-media failure travels to the browser. */
export const CONTENT_MEDIA_ERROR_KINDS: Record<ContentMediaErrorCode, ErrorKind> = {
    [ContentMediaErrorCode.UploadInvalid]: "invalid",
    [ContentMediaErrorCode.PathInvalid]: "invalid",
    [ContentMediaErrorCode.StorageUnavailable]: "unavailable",
}

/** The one typed error of the content-media capability. */
export class ContentMediaError extends DomainError<ContentMediaErrorCode> {}

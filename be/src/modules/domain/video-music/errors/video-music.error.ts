import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the video music. */
export enum VideoMusicErrorCode {
    /** The file store refused a bed. */
    StorageFailed = "VIDEO_MUSIC_STORAGE_FAILED",
}

/** How each video music code travels. */
export const VIDEO_MUSIC_ERROR_KINDS: Record<VideoMusicErrorCode, ErrorKind> = {
    [VideoMusicErrorCode.StorageFailed]: "unavailable",
}

/** The one error class of the video music. */
export class VideoMusicError extends DomainError<VideoMusicErrorCode> {}

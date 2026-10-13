import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the video-renders capability. */
export enum VideoRendersErrorCode {
    /** A write that must answer the row it wrote answered none. */
    NotWritten = "VIDEO_RENDERS_NOT_WRITTEN",
    /** The workspace already has the most renders it may have waiting or running. */
    TooMany = "VIDEO_RENDERS_TOO_MANY",
}

/** How each video-renders code travels. */
export const VIDEO_RENDERS_ERROR_KINDS: Record<VideoRendersErrorCode, ErrorKind> = {
    [VideoRendersErrorCode.NotWritten]: "internal",
    [VideoRendersErrorCode.TooMany]: "conflict",
}

/** The one error class of the video-renders capability. */
export class VideoRendersError extends DomainError<VideoRendersErrorCode> {}

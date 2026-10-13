import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the ffmpeg integration. */
export enum FfmpegErrorCode {
    /** ffmpeg or ffprobe could not start, exited with an error, was aborted or timed out, or measured no duration. */
    Failed = "FFMPEG_FAILED",
}

/** How each ffmpeg code travels. */
export const FFMPEG_ERROR_KINDS: Record<FfmpegErrorCode, ErrorKind> = {
    [FfmpegErrorCode.Failed]: "internal",
}

/** The one error class of the ffmpeg integration. */
export class FfmpegError extends DomainError<FfmpegErrorCode> {}

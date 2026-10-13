import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the video capability. */
export enum VideoErrorCode {
    /** Invalid video editor input. */
    InputInvalid = "VIDEO_INPUT_INVALID",
    /** Approval is required before publication or sharing. */
    NotApproved = "VIDEO_NOT_APPROVED",
    /** No video project of the caller has the requested id (or the caller may not render it). */
    ProjectNotFound = "VIDEO_PROJECT_NOT_FOUND",
    /** The project is being scripted or still has a render waiting or running. */
    ProjectBusy = "VIDEO_PROJECT_BUSY",
    /** The script of the project does not make a valid spec. */
    SpecInvalid = "VIDEO_SPEC_INVALID",
    /** The request itself cannot be rendered (too long, an asset outside the workspace or unreadable): retrying will not help. */
    RenderRejected = "VIDEO_RENDER_REJECTED",
    /** The videos bucket could not be written. */
    StorageFailed = "VIDEO_STORAGE_FAILED",
}

/** How each video code travels. */
export const VIDEO_ERROR_KINDS: Record<VideoErrorCode, ErrorKind> = {
    [VideoErrorCode.InputInvalid]: "invalid",
    [VideoErrorCode.NotApproved]: "conflict",
    [VideoErrorCode.ProjectNotFound]: "not-found",
    [VideoErrorCode.ProjectBusy]: "conflict",
    [VideoErrorCode.SpecInvalid]: "invalid",
    [VideoErrorCode.RenderRejected]: "invalid",
    [VideoErrorCode.StorageFailed]: "unavailable",
}

/** The one error class of the video capability. */
export class VideoError extends DomainError<VideoErrorCode> {}

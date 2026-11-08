import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the remote files integration. */
export enum RemoteFilesErrorCode {
    /** The address could not be asked: a network failure, a timeout or an unreadable answer. */
    RequestFailed = "REMOTE_FILES_REQUEST_FAILED",
}

/** How each remote files code travels. */
export const REMOTE_FILES_ERROR_KINDS: Record<RemoteFilesErrorCode, ErrorKind> = {
    [RemoteFilesErrorCode.RequestFailed]: "unavailable",
}

/** The one error class of the remote files integration. */
export class RemoteFilesError extends DomainError<RemoteFilesErrorCode> {}

import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the documents integration: why a link, a file or a Drive item could not be turned into text. */
export enum DocumentsErrorCode {
    /** The pasted text is not an http or https address. */
    LinkInvalid = "DOCUMENTS_LINK_INVALID",
    /** The address points into a private or loopback network, which is never fetched. */
    HostPrivate = "DOCUMENTS_HOST_PRIVATE",
    /** A Google file is not shared with "anyone with the link". */
    NotPublic = "DOCUMENTS_NOT_PUBLIC",
    /** A Drive folder cannot be imported through this door. */
    FolderUnsupported = "DOCUMENTS_FOLDER_UNSUPPORTED",
    /** The type of the file is not one that can be read. */
    TypeUnsupported = "DOCUMENTS_TYPE_UNSUPPORTED",
    /** The file is larger than the integration reads. */
    TooLarge = "DOCUMENTS_TOO_LARGE",
    /** The bytes are not the kind of file the name says (a "docx" that is not a zip, a "pdf" without its header, a binary "txt"). */
    FileInvalid = "DOCUMENTS_FILE_INVALID",
    /** The file is of the right kind but its text cannot be read (locked, scanned, damaged). */
    FileUnreadable = "DOCUMENTS_FILE_UNREADABLE",
    /** The workspace has not given the Google Drive access the item needs. */
    DriveGrantMissing = "DOCUMENTS_DRIVE_GRANT_MISSING",
    /** The Google Drive access of the workspace was revoked. */
    DriveGrantLost = "DOCUMENTS_DRIVE_GRANT_LOST",
    /** The connected Google account cannot open the item. */
    DriveNoAccess = "DOCUMENTS_DRIVE_NO_ACCESS",
    /** Google Drive refused the access token (401): a short-lived Picker token expired, or the stored token of the grant needs a refresh. */
    TokenRejected = "DOCUMENTS_TOKEN_REJECTED",
    /** The Drive id of a file or folder is malformed. */
    DriveIdInvalid = "DOCUMENTS_DRIVE_ID_INVALID",
    /** The address named as a Drive folder is not a folder. */
    NotFolder = "DOCUMENTS_NOT_FOLDER",
    /** The other side could not be reached, timed out, or answered a status worth retrying. */
    Unavailable = "DOCUMENTS_UNAVAILABLE",
    /** The other side refused the request with a status that will not change. */
    Refused = "DOCUMENTS_REFUSED",
    /** The deployment has no Google OAuth client, so an access token cannot be refreshed. */
    GoogleNotConfigured = "DOCUMENTS_GOOGLE_NOT_CONFIGURED",
    /** Google answered that the refresh token is no longer valid: the grant was revoked. */
    GoogleGrantRevoked = "DOCUMENTS_GOOGLE_GRANT_REVOKED",
}

/** How each documents code travels. */
export const DOCUMENTS_ERROR_KINDS: Record<DocumentsErrorCode, ErrorKind> = {
    [DocumentsErrorCode.LinkInvalid]: "invalid",
    [DocumentsErrorCode.HostPrivate]: "invalid",
    [DocumentsErrorCode.NotPublic]: "invalid",
    [DocumentsErrorCode.FolderUnsupported]: "invalid",
    [DocumentsErrorCode.TypeUnsupported]: "invalid",
    [DocumentsErrorCode.TooLarge]: "invalid",
    [DocumentsErrorCode.FileInvalid]: "invalid",
    [DocumentsErrorCode.FileUnreadable]: "invalid",
    [DocumentsErrorCode.DriveGrantMissing]: "conflict",
    [DocumentsErrorCode.DriveGrantLost]: "conflict",
    [DocumentsErrorCode.DriveNoAccess]: "forbidden",
    [DocumentsErrorCode.TokenRejected]: "conflict",
    [DocumentsErrorCode.DriveIdInvalid]: "invalid",
    [DocumentsErrorCode.NotFolder]: "invalid",
    [DocumentsErrorCode.Unavailable]: "unavailable",
    [DocumentsErrorCode.Refused]: "invalid",
    [DocumentsErrorCode.GoogleNotConfigured]: "unavailable",
    [DocumentsErrorCode.GoogleGrantRevoked]: "conflict",
}

/** The one error class of the documents integration. */
export class DocumentsError extends DomainError<DocumentsErrorCode> {}

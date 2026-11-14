import { DocumentsError, DocumentsErrorCode } from "@modules/integrations/documents"

/** The most megabytes the integration reads of one Drive file (its own bound: the refusal carries it as `maxMb`). */
const MAX_MB = 10

/** The workspace never gave Drive access: the SAME `DocumentsError` the live grant throws when it holds no usable connection. */
export const driveGrantMissing = (): Error => new DocumentsError({ code: DocumentsErrorCode.DriveGrantMissing })

/** The access was revoked: the SAME `DocumentsError` the live grant throws when the stored grant is in error. */
export const driveGrantLost = (): Error => new DocumentsError({ code: DocumentsErrorCode.DriveGrantLost })

/** Drive answered 401: the SAME `DocumentsError` the Drive client throws (a token to refresh). */
export const driveTokenRejected = (): Error => new DocumentsError({ code: DocumentsErrorCode.TokenRejected })

/** Drive answered 403 / 404 for the item: the SAME `DocumentsError` the Drive client throws (the connected account cannot open it). */
export const driveNoAccess = (): Error => new DocumentsError({ code: DocumentsErrorCode.DriveNoAccess })

/** Drive answered a server failure: the SAME `DocumentsError` the integration throws for a status worth another try. */
export const driveUnavailable = (): Error => new DocumentsError({ code: DocumentsErrorCode.Unavailable })

/** The file is larger than the integration reads: the SAME `DocumentsError` (with the bound) the Drive client throws before any download. */
export const driveTooLarge = (): Error => new DocumentsError({ code: DocumentsErrorCode.TooLarge, params: { maxMb: MAX_MB } })

/** The file is of a type the integration cannot read: the SAME `DocumentsError` (with the type) the Drive client throws. */
export const driveTypeUnsupported = (): Error =>
    new DocumentsError({ code: DocumentsErrorCode.TypeUnsupported, params: { type: "application/zip" } })

import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"

/** The statuses worth another try: the other side is busy or broken, not refusing for good. */
const isTransientStatus = (status: number): boolean =>
    status === 0 || status === 408 || status === 425 || status === 429 || status >= 500

/** The error for an HTTP status the other side answered: a transient status is unavailable, any other refusal will not change. */
export const statusError = (status: number): DocumentsError =>
    new DocumentsError({
        code: isTransientStatus(status) ? DocumentsErrorCode.Unavailable : DocumentsErrorCode.Refused,
        params: { status },
    })

/**
 * True when a failure is worth another try: the other side was unavailable, or the call itself broke on the network (an abort, a timeout,
 * a failed fetch). Everything else, including every other documents code, will not change by waiting.
 */
export const isTransientDocumentsError = (cause: unknown): boolean => {
    if (cause instanceof DocumentsError) return cause.code === DocumentsErrorCode.Unavailable
    if (!(cause instanceof Error)) return false
    return (
        cause.name === "AbortError" ||
        cause.name === "TimeoutError" ||
        (cause instanceof TypeError && /fetch/iu.test(cause.message))
    )
}

import { ZaloError, ZaloErrorCode } from "./errors/zalo.error"
import type { ZaloFailure } from "./zalo.contracts"

/**
 * Zalo's numeric errors of the OA message API and of ZNS, grouped by what the sender can do about them. The numbers come from Zalo's
 * published error tables; one that is not listed stays a plain `Rejected` with its number in the params.
 */
const API_ERRORS: ReadonlyArray<readonly [ZaloErrorCode, ReadonlyArray<number>]> = [
    [ZaloErrorCode.WindowClosed, [-230, -232]],
    [ZaloErrorCode.NotFollower, [-213]],
    [ZaloErrorCode.NightHours, [-234, -133]],
    [ZaloErrorCode.TokenRejected, [-216, -124, -14014, -14003]],
    [ZaloErrorCode.RecipientUnreachable, [-108, -114, -118, -139]],
    [ZaloErrorCode.TemplateRejected, [-109, -111, -112, -131, -132]],
    [ZaloErrorCode.QuotaExhausted, [-115, -137, -144, -211]],
    [ZaloErrorCode.NotPermitted, [-117, -120, -126, -127, -135, -138]],
]

const FAILURES: Partial<Record<ZaloErrorCode, ZaloFailure>> = {
    [ZaloErrorCode.WindowClosed]: "zalo_window_expired",
    [ZaloErrorCode.NotFollower]: "zalo_unfollowed",
    [ZaloErrorCode.NightHours]: "zalo_night_hours",
    [ZaloErrorCode.TokenRejected]: "zalo_token",
    [ZaloErrorCode.RecipientUnreachable]: "zalo_recipient",
    [ZaloErrorCode.TemplateRejected]: "zalo_template",
    [ZaloErrorCode.QuotaExhausted]: "zalo_quota",
    [ZaloErrorCode.NotPermitted]: "zalo_not_permitted",
}

/** The numeric error Zalo gave with a refusal, or null when the failure carries none (a network failure). */
const zaloCodeOf = (error: unknown): number | null => {
    const code = error instanceof ZaloError ? error.params.zaloCode : undefined
    return typeof code === "number" ? code : null
}

/** The house code of one of Zalo's numeric errors; an unlisted number is a plain refusal. */
export const zaloErrorCodeOf = (zaloCode: number): ZaloErrorCode =>
    API_ERRORS.find(([, numbers]) => numbers.includes(zaloCode))?.[0] ?? ZaloErrorCode.Rejected

/** Why a message did not go out, in the stable terms the workbench shows; an unclassified failure is `zalo_error`. */
export const zaloFailureOf = (error: unknown): ZaloFailure => {
    const code = zaloCodeOf(error)
    if (code !== null) return FAILURES[zaloErrorCodeOf(code)] ?? "zalo_error"
    return error instanceof ZaloError ? (FAILURES[error.code] ?? "zalo_error") : "zalo_error"
}

/** True when Zalo said the access token itself is bad, so a refresh and one more try can succeed. */
export const isZaloTokenRejection = (error: unknown): boolean => {
    const code = zaloCodeOf(error)
    return code === -216 || code === -124
}

/** True when Zalo answered and said no, as opposed to not answering: only a new authorization fixes a refused refresh token. */
export const isZaloRefusal = (error: unknown): boolean => error instanceof ZaloError && error.params.path !== undefined

import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the Tino integration, each saying WHERE the call failed (the adapter attaches what that proves, `withProof`): the request
 * was refused at Tino's gateway before any route ran (`AuthFailed`: 401 / 403, https://docs.tino.vn/docs/api "Loi"), the route refused
 * it (`Rejected`: its `{"error": [...]}` body, an answer, no effect), or its effect is not known (`Unreachable`, `Failed`). Tino documents
 * no rate-limit or conflict status, so none is coded.
 */
export enum TinoErrorCode {
    /** The API could not be reached or did not answer in time: the request may have left. */
    Unreachable = "TINO_UNREACHABLE",
    /** The API answered a server failure (5xx) or something unreadable: the effect is not known. */
    Failed = "TINO_FAILED",
    /** The API refused the token (401 `invalid_token`; 403 `insufficient_scope`, `ip_not_allowed`, `ipnotallowed`). */
    AuthFailed = "TINO_AUTH_FAILED",
    /** The API refused the request as asked (the route's `error` body); Tino's own code rides in the params. */
    Rejected = "TINO_REJECTED",
}

/** How each Tino code travels. */
export const TINO_ERROR_KINDS: Record<TinoErrorCode, ErrorKind> = {
    [TinoErrorCode.Unreachable]: "unavailable",
    [TinoErrorCode.Failed]: "unavailable",
    [TinoErrorCode.AuthFailed]: "unavailable",
    [TinoErrorCode.Rejected]: "invalid",
}

/** The one error class of the Tino integration. */
export class TinoError extends DomainError<TinoErrorCode> {}

import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the events api capability. */
export enum ApiErrorCode {
    /** A payload field held a value outside the set its event lists for it. */
    ValueOutsideSet = "API_VALUE_OUTSIDE_SET",
}

/** How each events code travels. */
export const API_ERROR_KINDS: Record<ApiErrorCode, ErrorKind> = {
    [ApiErrorCode.ValueOutsideSet]: "invalid",
}

/** The one error class of the events capability. */
export class ApiError extends DomainError<ApiErrorCode> {}

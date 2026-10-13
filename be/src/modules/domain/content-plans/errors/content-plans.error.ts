import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Stable failures of editorial plan storage. */
export enum ContentPlansErrorCode {
    /** Reports that the plan row was not created, so all associated item changes are rolled back. */
    NotWritten = "CONTENT_PLANS_NOT_WRITTEN",
}

/** Error classification exposed to transports. */
export const CONTENT_PLANS_ERROR_KINDS: Record<ContentPlansErrorCode, ErrorKind> = {
    [ContentPlansErrorCode.NotWritten]: "internal",
}

/** The plan capability's typed failure. */
export class ContentPlansError extends DomainError<ContentPlansErrorCode> {}

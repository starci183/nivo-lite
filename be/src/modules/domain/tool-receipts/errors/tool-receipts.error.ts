import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the tools registry receipts capability. */
export enum ToolReceiptsErrorCode {
    /** The recorded connector operation is missing or cannot be read safely. */
    Unreadable = "TOOL_RECEIPTS_UNREADABLE",
}

/** How each receipt code travels. */
export const TOOL_RECEIPTS_ERROR_KINDS: Record<ToolReceiptsErrorCode, ErrorKind> = {
    [ToolReceiptsErrorCode.Unreadable]: "internal",
}

/** The one error class of the tools registry receipts capability. */
export class ToolReceiptsError extends DomainError<ToolReceiptsErrorCode> {}

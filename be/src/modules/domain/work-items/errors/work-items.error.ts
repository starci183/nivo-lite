import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the work items capability. */
export enum WorkItemsErrorCode {
    /** The write answered no row: the item is not in the database. */
    NotFound = "WORK_ITEMS_NOT_FOUND",
}

/** How each work items code travels. */
export const WORK_ITEMS_ERROR_KINDS: Record<WorkItemsErrorCode, ErrorKind> = {
    [WorkItemsErrorCode.NotFound]: "not-found",
}

/** The one error class of the work items capability. */
export class WorkItemsError extends DomainError<WorkItemsErrorCode> {}

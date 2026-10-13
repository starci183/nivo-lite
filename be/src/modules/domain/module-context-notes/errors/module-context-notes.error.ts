import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the module-context-notes capability. */
export enum ModuleContextNotesErrorCode {
    /** No pending note of the workspace has this id. */
    NotFound = "MODULE_CONTEXT_NOTES_NOT_FOUND",
}

/** How each module-context-notes code travels. */
export const MODULE_CONTEXT_NOTES_ERROR_KINDS: Record<ModuleContextNotesErrorCode, ErrorKind> = {
    [ModuleContextNotesErrorCode.NotFound]: "not-found",
}

/** The one error class of the module-context-notes capability. */
export class ModuleContextNotesError extends DomainError<ModuleContextNotesErrorCode> {}

import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the modules capability. */
export enum ModulesErrorCode {
    /** The catalogue has no module with the requested key. */
    NotFound = "MODULES_NOT_FOUND",
    /** The catalogue breaks one of its own rules and must not be written to the database. */
    CatalogInvalid = "MODULES_CATALOG_INVALID",
}

/** How each modules code travels. */
export const MODULES_ERROR_KINDS: Record<ModulesErrorCode, ErrorKind> = {
    [ModulesErrorCode.NotFound]: "not-found",
    [ModulesErrorCode.CatalogInvalid]: "internal",
}

/** The one error class of the modules capability. */
export class ModulesError extends DomainError<ModulesErrorCode> {}

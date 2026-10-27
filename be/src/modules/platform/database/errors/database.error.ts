import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the database capability. */
export enum DatabaseErrorCode {
    /** A dynamic SQL identifier was not on the list of names its caller allows. */
    IdentifierRejected = "DATABASE_IDENTIFIER_REJECTED",
    /** The managed migration wrapper failed or could not be started. */
    MigrationFailed = "DATABASE_MIGRATION_FAILED",
}

/** How each database code travels. */
export const DATABASE_ERROR_KINDS: Record<DatabaseErrorCode, ErrorKind> = {
    [DatabaseErrorCode.IdentifierRejected]: "internal",
    [DatabaseErrorCode.MigrationFailed]: "internal",
}

/** The one error class of the database capability. */
export class DatabaseError extends DomainError<DatabaseErrorCode> {}

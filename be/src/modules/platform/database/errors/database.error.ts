import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the database capability. */
export enum DatabaseErrorCode {
    /** A dynamic SQL identifier was not on the list of names its caller allows. */
    IdentifierRejected = "DATABASE_IDENTIFIER_REJECTED",
    /** A database function name was not an identifier of the shape a migration declares. */
    FunctionRejected = "DATABASE_FUNCTION_REJECTED",
    /** A webhook delivery carried no usable delivery id, so it cannot be claimed once. */
    WebhookDeliveryIdRequired = "DATABASE_WEBHOOK_DELIVERY_ID_REQUIRED",
    /** A RETURNING statement answered something other than rows of the shape its caller expects. */
    ReturningRowRejected = "DATABASE_RETURNING_ROW_REJECTED",
    /** The managed migration wrapper failed or could not be started. */
    MigrationFailed = "DATABASE_MIGRATION_FAILED",
}

/** How each database code travels. */
export const DATABASE_ERROR_KINDS: Record<DatabaseErrorCode, ErrorKind> = {
    [DatabaseErrorCode.IdentifierRejected]: "internal",
    [DatabaseErrorCode.FunctionRejected]: "internal",
    [DatabaseErrorCode.WebhookDeliveryIdRequired]: "invalid",
    [DatabaseErrorCode.ReturningRowRejected]: "internal",
    [DatabaseErrorCode.MigrationFailed]: "internal",
}

/** The one error class of the database capability. */
export class DatabaseError extends DomainError<DatabaseErrorCode> {}

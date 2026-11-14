import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the generic connection form. */
export enum ConnectionFieldsErrorCode {
    /** The provider of the account registered no writer: its form is read-only. */
    NotWritable = "CONNECTION_FIELDS_NOT_WRITABLE",
    /** The caller's role may not change this provider's connection fields. */
    Forbidden = "CONNECTION_FIELDS_FORBIDDEN",
    /** A change names a field the provider does not declare (`params.key`). */
    FieldUnknown = "CONNECTION_FIELDS_FIELD_UNKNOWN",
    /** A change names a field that is shown and never edited here (`params.key`). */
    FieldReadOnly = "CONNECTION_FIELDS_FIELD_READ_ONLY",
    /** A required field was left empty (`params.key`). */
    FieldRequired = "CONNECTION_FIELDS_FIELD_REQUIRED",
    /** A value is longer than its bound, not one of its choices, shorter than its minimum, or named twice (`params.key`, `params.reason`; also a value the provider's own rules refuse). */
    FieldInvalid = "CONNECTION_FIELDS_FIELD_INVALID",
    /** The display name is blank or unusable. */
    NameInvalid = "CONNECTION_FIELDS_NAME_INVALID",
    /** The provider declares no action of that key (`params.action`). */
    ActionUnknown = "CONNECTION_FIELDS_ACTION_UNKNOWN",
    /** The form of the provider could put a secret on a page, so it is disabled for that provider (`params.provider`, `params.codes`). */
    DeclarationInvalid = "CONNECTION_FIELDS_DECLARATION_INVALID",
}

/** How each connection form code travels. */
export const CONNECTION_FIELDS_ERROR_KINDS: Record<ConnectionFieldsErrorCode, ErrorKind> = {
    [ConnectionFieldsErrorCode.NotWritable]: "conflict",
    [ConnectionFieldsErrorCode.Forbidden]: "forbidden",
    [ConnectionFieldsErrorCode.FieldUnknown]: "invalid",
    [ConnectionFieldsErrorCode.FieldReadOnly]: "invalid",
    [ConnectionFieldsErrorCode.FieldRequired]: "invalid",
    [ConnectionFieldsErrorCode.FieldInvalid]: "invalid",
    [ConnectionFieldsErrorCode.NameInvalid]: "invalid",
    [ConnectionFieldsErrorCode.ActionUnknown]: "not-found",
    [ConnectionFieldsErrorCode.DeclarationInvalid]: "unavailable",
}

/** The one error class of the connection form capability. */
export class ConnectionFieldsError extends DomainError<ConnectionFieldsErrorCode> {}

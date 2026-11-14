import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the account-data capability. */
export enum AccountDataErrorCode {
    /** The type is not declared, or its provider is not the connection's: a wiring error. */
    TypeUndeclared = "ACCOUNT_DATA_TYPE_UNDECLARED",
    /** A type declaration breaks a rule of its own shape, or two declarations share a name: a wiring error at boot. */
    TypeInvalid = "ACCOUNT_DATA_TYPE_INVALID",
    /** The value does not fit the declared fields of its type. */
    ValueInvalid = "ACCOUNT_DATA_VALUE_INVALID",
    /** The value carries a member the type names secret. */
    SecretInValue = "ACCOUNT_DATA_SECRET_IN_VALUE",
    /** The value is larger than its type allows. */
    ValueTooLarge = "ACCOUNT_DATA_VALUE_TOO_LARGE",
    /** The type is not written this way (an `advance` type through the intake, a cursor of another mode, a lock of a type that never wakes). */
    WriteMode = "ACCOUNT_DATA_WRITE_MODE",
    /** The member is not the first member of a declared index of the type. */
    IndexUndeclared = "ACCOUNT_DATA_INDEX_UNDECLARED",
}

/** How each account-data code travels. */
export const ACCOUNT_DATA_ERROR_KINDS: Record<AccountDataErrorCode, ErrorKind> = {
    [AccountDataErrorCode.TypeUndeclared]: "internal",
    [AccountDataErrorCode.TypeInvalid]: "internal",
    [AccountDataErrorCode.ValueInvalid]: "invalid",
    [AccountDataErrorCode.SecretInValue]: "invalid",
    [AccountDataErrorCode.ValueTooLarge]: "invalid",
    [AccountDataErrorCode.WriteMode]: "internal",
    [AccountDataErrorCode.IndexUndeclared]: "internal",
}

/** The one error class of the account-data capability. */
export class AccountDataError extends DomainError<AccountDataErrorCode> {}

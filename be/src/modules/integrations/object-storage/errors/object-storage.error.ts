import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the storage integration. */
export enum ObjectStorageErrorCode {
    /** The bucket has no object at the requested key. */
    ObjectNotFound = "OBJECT_STORAGE_NOT_FOUND",
    /** The object store could not be reached or refused the call. */
    ProviderUnavailable = "OBJECT_STORAGE_UNAVAILABLE",
    /** The object key or bucket name is not one the store accepts. */
    KeyInvalid = "OBJECT_STORAGE_KEY_INVALID",
}

/** How each storage code travels. */
export const OBJECT_STORAGE_ERROR_KINDS: Record<ObjectStorageErrorCode, ErrorKind> = {
    [ObjectStorageErrorCode.ObjectNotFound]: "not-found",
    [ObjectStorageErrorCode.ProviderUnavailable]: "unavailable",
    [ObjectStorageErrorCode.KeyInvalid]: "invalid",
}

/** The one error class of the storage integration. */
export class ObjectStorageError extends DomainError<ObjectStorageErrorCode> {}

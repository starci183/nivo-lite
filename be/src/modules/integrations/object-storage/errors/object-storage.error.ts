import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the object storage integration: why the integration refused a call, in the wire words the domains already match on. */
export enum ObjectStorageErrorCode {
    /** The bucket has no object at the requested key. */
    ObjectNotFound = "OBJECT_STORAGE_NOT_FOUND",
    /** The bucket name is not one the store accepts. */
    BucketInvalid = "OBJECT_STORAGE_BUCKET_INVALID",
}

/** How each object storage code travels. */
export const OBJECT_STORAGE_ERROR_KINDS: Record<ObjectStorageErrorCode, ErrorKind> = {
    [ObjectStorageErrorCode.ObjectNotFound]: "not-found",
    [ObjectStorageErrorCode.BucketInvalid]: "invalid",
}

/** The one error class of the object storage integration; the library's own failures are mapped into it at the glue. */
export class ObjectStorageError extends DomainError<ObjectStorageErrorCode> {}

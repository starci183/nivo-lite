import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the record files: why one upload, confirmation, link, put, read or delete of a record's file was refused. */
export enum RecordFilesErrorCode {
    /** No installed package declares the record type. */
    TypeUnknown = "RECORD_FILES_TYPE_UNKNOWN",
    /** The record type declares no `file` field of that name. */
    FieldNotFile = "RECORD_FILES_FIELD_NOT_FILE",
    /** The record is not in the workspace. */
    RecordNotFound = "RECORD_FILES_RECORD_NOT_FOUND",
    /** The field does not accept the content type. */
    MimeNotAccepted = "RECORD_FILES_MIME_NOT_ACCEPTED",
    /** The file is empty or larger than the field accepts. */
    SizeInvalid = "RECORD_FILES_SIZE_INVALID",
    /** The object key is not one issued for this field of this record of this workspace. */
    KeyInvalid = "RECORD_FILES_KEY_INVALID",
    /** No object was uploaded or staged at the key. */
    UploadMissing = "RECORD_FILES_UPLOAD_MISSING",
    /** The record holds no file in the field. */
    NoFile = "RECORD_FILES_NO_FILE",
    /** The store could not be reached. */
    StoreUnavailable = "RECORD_FILES_STORE_UNAVAILABLE",
    /** The address to fetch is not a public https address. */
    UrlInvalid = "RECORD_FILES_URL_INVALID",
    /** The address answered no file: a refusal, an empty answer, a redirect loop or a network failure. */
    UrlUnreachable = "RECORD_FILES_URL_UNREACHABLE",
    /** This app binds no reader of remote files. */
    FetchNotServed = "RECORD_FILES_FETCH_NOT_SERVED",
    /** The list field already holds as many files as it may (`max`). */
    ListFull = "RECORD_FILES_LIST_FULL",
    /** The field holds a list of files, and the call named none of them (`key`). */
    ItemKeyRequired = "RECORD_FILES_ITEM_KEY_REQUIRED",
    /** The record refused the reference (it changed under the write, or its declaration no longer takes it). */
    RecordRejected = "RECORD_FILES_RECORD_REJECTED",
}

/** How each record files code travels. */
export const RECORD_FILES_ERROR_KINDS: Record<RecordFilesErrorCode, ErrorKind> = {
    [RecordFilesErrorCode.TypeUnknown]: "not-found",
    [RecordFilesErrorCode.FieldNotFile]: "invalid",
    [RecordFilesErrorCode.RecordNotFound]: "not-found",
    [RecordFilesErrorCode.MimeNotAccepted]: "invalid",
    [RecordFilesErrorCode.SizeInvalid]: "invalid",
    [RecordFilesErrorCode.KeyInvalid]: "invalid",
    [RecordFilesErrorCode.UploadMissing]: "not-found",
    [RecordFilesErrorCode.NoFile]: "not-found",
    [RecordFilesErrorCode.StoreUnavailable]: "unavailable",
    [RecordFilesErrorCode.UrlInvalid]: "invalid",
    [RecordFilesErrorCode.UrlUnreachable]: "unavailable",
    [RecordFilesErrorCode.FetchNotServed]: "internal",
    [RecordFilesErrorCode.ListFull]: "conflict",
    [RecordFilesErrorCode.ItemKeyRequired]: "invalid",
    [RecordFilesErrorCode.RecordRejected]: "conflict",
}

/** The one error class of the record files. */
export class RecordFilesError extends DomainError<RecordFilesErrorCode> {}

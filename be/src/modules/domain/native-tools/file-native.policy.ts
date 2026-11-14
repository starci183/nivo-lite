import { BillingErrorCode } from "@modules/domain/billing"
import { ToolsError, ToolsErrorCode, type RefusalClass } from "@modules/domain/tools"
import { RecordFilesErrorCode } from "@modules/domain/record-files"
import { isDomainError } from "@modules/platform/errors"

/** The verb of one file tool, by what it does to a record's file. */
export type FileVerb = "put" | "link" | "get"

/**
 * Why a file tool refuses a call. Business (the node or its agent reads it and goes on): `type_unknown` (no installed package declares
 * the type), `field_not_file` (the type declares no `file` field of that name), `not_found` (no such record of the calling agent in the
 * workspace: a record of another agent or workspace answers the same), `mime_not_accepted` and `too_big` (the
 * file does not fit the field's declared types or size), `key_invalid` (the key is no staged file of this workspace nor an object of
 * this field of this record; for a get, the record's reference is no file of this field of this record), `object_missing` (nothing is
 * stored or staged at the key), `url_invalid` (the address is not a public https address), `url_unreachable` (the address answered no
 * file), `no_file` (the record holds no file in the field, or none of the key a list field was asked for), `list_full` (a list field
 * already holds as many files as it may), `key_required` (a `get` of a list field named no file), `quota_exceeded` (the plan's storage is full), `record_rejected` (the record
 * did not take the reference). Infrastructure (the step freezes and is reported): `not_served` (this app binds no file store, or no reader of
 * remote files for a put by address), `store_unavailable`.
 */
export type FileRefusalReason =
    | "type_unknown"
    | "field_not_file"
    | "not_found"
    | "mime_not_accepted"
    | "too_big"
    | "key_invalid"
    | "object_missing"
    | "url_invalid"
    | "url_unreachable"
    | "no_file"
    | "list_full"
    | "key_required"
    | "quota_exceeded"
    | "record_rejected"
    | "not_served"
    | "store_unavailable"

/** What each refusal of the file tools IS (a TOTAL record): `business` the agent goes on from, `infrastructure` freezes the step. */
export const FILE_REFUSAL_CLASS: Readonly<Record<FileRefusalReason, RefusalClass>> = {
    type_unknown: "business",
    field_not_file: "business",
    not_found: "business",
    mime_not_accepted: "business",
    too_big: "business",
    key_invalid: "business",
    object_missing: "business",
    url_invalid: "business",
    url_unreachable: "business",
    no_file: "business",
    list_full: "business",
    key_required: "business",
    quota_exceeded: "business",
    record_rejected: "business",
    not_served: "infrastructure",
    store_unavailable: "infrastructure",
}

/** The verbs of the file tools, by their name in the manifest. */
const VERB_BY_NAME: Readonly<Record<string, FileVerb>> = { put: "put", link: "link", get: "get" }

/** The verb of a file tool by its name in the manifest, or null for a name the file tools do not have. */
export const fileVerbOf = (tool: string): FileVerb | null =>
    Object.hasOwn(VERB_BY_NAME, tool) ? (VERB_BY_NAME[tool] ?? null) : null

/** The refusal a file tool throws for an expected case, in the shape every native refusal has (`reason`, `refusalClass`). */
export const fileRefusal = (reason: FileRefusalReason, cause?: unknown): ToolsError =>
    new ToolsError({
        code: ToolsErrorCode.NativeRefused,
        params: { reason, refusalClass: FILE_REFUSAL_CLASS[reason] },
        ...(cause === undefined ? {} : { cause }),
    })

/** The refusal of each record files code. */
const REFUSALS: Readonly<Record<string, FileRefusalReason>> = {
    [RecordFilesErrorCode.TypeUnknown]: "type_unknown",
    [RecordFilesErrorCode.FieldNotFile]: "field_not_file",
    [RecordFilesErrorCode.RecordNotFound]: "not_found",
    [RecordFilesErrorCode.MimeNotAccepted]: "mime_not_accepted",
    [RecordFilesErrorCode.SizeInvalid]: "too_big",
    [RecordFilesErrorCode.KeyInvalid]: "key_invalid",
    [RecordFilesErrorCode.UploadMissing]: "object_missing",
    [RecordFilesErrorCode.NoFile]: "no_file",
    [RecordFilesErrorCode.ListFull]: "list_full",
    [RecordFilesErrorCode.ItemKeyRequired]: "key_required",
    [RecordFilesErrorCode.UrlInvalid]: "url_invalid",
    [RecordFilesErrorCode.UrlUnreachable]: "url_unreachable",
    [RecordFilesErrorCode.RecordRejected]: "record_rejected",
    [RecordFilesErrorCode.FetchNotServed]: "not_served",
    [RecordFilesErrorCode.StoreUnavailable]: "store_unavailable",
}

/**
 * The refusal a failure of the generic record files comes to, or null for a failure that is no expected case (it propagates): each
 * record files code by its meaning, and the plan's own storage refusal as `quota_exceeded`.
 */
export const fileRefusalOf = (cause: unknown): ToolsError | null => {
    if (!isDomainError(cause)) return null
    if (cause.code === BillingErrorCode.StorageQuotaExceeded) return fileRefusal("quota_exceeded", cause)
    const reason = Object.hasOwn(REFUSALS, cause.code) ? REFUSALS[cause.code] : undefined
    return reason === undefined ? null : fileRefusal(reason, cause)
}

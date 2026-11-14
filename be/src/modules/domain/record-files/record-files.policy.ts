import {
  FILE_NAME_MAX,
  fileMimeOf,
  isFileList,
  mimeAccepted,
  type EntityDefinition,
  type FieldDef,
  type FileRef,
} from "@nivo-lite/agent-sdk/entity"
import { RecordFilesError, RecordFilesErrorCode } from "./errors/record-files.error"

/** A record id: what the entity engine mints. Anything else names no record of the workspace. */
const RECORD_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u

/** What a file name may not carry: control characters and path separators. */
const NAME_UNSAFE = /[\u0000-\u001f\u007f/\\]+/gu

/** The name a file is kept under when the given one holds nothing printable. */
const NAME_FALLBACK = "file"

/** True for a text that can be a record id; any other text names no record (`RecordNotFound`). */
export const isRecordId = (id: string): boolean => RECORD_ID.test(id)

/**
 * The declared `file` field of a record type, by the type's own declaration: `TypeUnknown` when no installed package declares the
 * type, `FieldNotFile` when the type declares no field of that name or one of another kind. Nothing else is read of the type.
 */
export const fileFieldOf = (definition: EntityDefinition | undefined, field: string): FieldDef => {
    if (definition === undefined) throw new RecordFilesError({ code: RecordFilesErrorCode.TypeUnknown })
    const declared = Object.hasOwn(definition.fields, field) ? definition.fields[field] : undefined
    if (declared?.kind !== "file") {
        throw new RecordFilesError({ code: RecordFilesErrorCode.FieldNotFile, params: { field } })
    }
    return declared
}

/**
 * Why a file of `mime` and `size` does not fit the field's declared limits: `MimeNotAccepted` for a content type the field does not
 * accept, `SizeInvalid` for an empty file or one larger than its `maxBytes`; null when it fits.
 */
export const factsRefusalOf = (field: FieldDef, mime: string, size: number): RecordFilesErrorCode | null => {
    if (!mimeAccepted(field.accept ?? [], fileMimeOf(mime))) return RecordFilesErrorCode.MimeNotAccepted
    if (!Number.isInteger(size) || size < 1 || size > (field.maxBytes ?? 0)) return RecordFilesErrorCode.SizeInvalid
    return null
}

/** Throws the refusal of a file that does not fit the field's declared limits. */
export const requireFits = (field: FieldDef, mime: string, size: number): void => {
    const refusal = factsRefusalOf(field, mime, size)
    if (refusal !== null) throw new RecordFilesError({ code: refusal })
}

/** The name a file is kept under: printable, no path separators, bounded; `file` when nothing printable is left. */
export const fileNameOf = (given: string): string => {
    const cleaned = given.replaceAll(NAME_UNSAFE, " ").trim().slice(0, FILE_NAME_MAX).trim()
    return cleaned === "" ? NAME_FALLBACK : cleaned
}

/**
 * The references a file field holds once `ref` is attached to `held`. A single field takes `ref` in place of its file; a list field
 * appends it (`ListFull` when it already holds `max`), or, with `replaces`, puts it where the named item was (`KeyInvalid` when the list
 * holds no such item). A reference whose object is already in the list is not added twice.
 */
export const addedTo = (
    field: FieldDef,
    held: ReadonlyArray<FileRef>,
    ref: FileRef,
    replaces: string | undefined,
): ReadonlyArray<FileRef> => {
    const at = replaces === undefined ? -1 : held.findIndex((item) => item.key === replaces)
    if (replaces !== undefined && at < 0) throw new RecordFilesError({ code: RecordFilesErrorCode.KeyInvalid })
    if (!isFileList(field)) return [ref]
    if (at >= 0) return held.map((item, index) => (index === at ? ref : item))
    if (held.some((item) => item.key === ref.key)) return held
    if (held.length >= (field.max ?? 0)) throw new RecordFilesError({ code: RecordFilesErrorCode.ListFull })
    return [...held, ref]
}

/**
 * The references a field holds once the file `key` names is removed from `held`: with no key, every one (a single field's); with a key,
 * only the item of that key. On a single field a key that is not the held file's removes nothing.
 */
export const removedFrom = (held: ReadonlyArray<FileRef>, key: string | undefined): ReadonlyArray<FileRef> =>
    key === undefined ? [] : held.filter((item) => item.key !== key)

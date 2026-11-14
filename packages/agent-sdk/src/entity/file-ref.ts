import { z } from "zod"
import type { FieldDef } from "./entity.types"

/*
 * The value a `file` field stores: a REFERENCE to one object in the core's file store, never its bytes. The engine's file store issues
 * it (an upload confirmed, or bytes a tool put) and the record keeps it in `data` like any declared value.
 */

/** The longest object key a reference carries. */
export const FILE_KEY_MAX = 512

/** The longest content type a reference or a declaration carries. */
export const FILE_MIME_MAX = 127

/** The longest file name a reference carries. */
export const FILE_NAME_MAX = 255

/** The longest https address a remote file (a provider's result) may be named by when a tool stores it into a file field. */
export const FILE_REMOTE_URL_MAX = 2048

/** The most content types one file field accepts. */
export const FILE_ACCEPT_MAX = 50

/** The most files one list file field (`many`) may declare as its `max`. */
export const FILE_LIST_MAX = 100

/** The largest object any file field may declare (5 GiB, one S3 PUT). */
export const FILE_BYTES_CEILING: number = 5 * 1024 * 1024 * 1024

/** An object key: path segments of letters, digits, `.`, `_` and `-`; no empty segment, no `.` or `..` segment. */
const KEY = /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))[\dA-Za-z][\dA-Za-z._-]*(?:\/[\dA-Za-z][\dA-Za-z._-]*)*$/u

/** A content type `type/subtype`, lower case, no parameters. */
const MIME = /^[\da-z][\da-z!#$&^_.+-]*\/[\da-z][\da-z!#$&^_.+-]*$/u

/** An accepted content type: exact (`image/png`) or a family (`image/*`). */
const ACCEPT = /^[\da-z][\da-z!#$&^_.+-]*\/(?:\*|[\da-z][\da-z!#$&^_.+-]*)$/u

/**
 * One file a `file` field references: the object key in the core's file store, its content type, its size in bytes and its name. A
 * type alias, not an interface, so a reference is a JSON value a record write carries as it is.
 */
export type FileRef = {
    /** The object key in the core's file store; the store's key law ties it to the workspace, record type, record and field. */
    readonly key: string
    /** The content type the object was stored with. */
    readonly mime: string
    /** The size in bytes. */
    readonly size: number
    /** The file name shown and offered on download. */
    readonly name: string
}

/** True for an object key a reference may carry. */
export const isFileKey = (key: string): boolean => key.length <= FILE_KEY_MAX && KEY.test(key)

/** True for a content type `type/subtype` (lower case, no parameters). */
export const isFileMime = (mime: string): boolean => mime.length <= FILE_MIME_MAX && MIME.test(mime)

/** True for an entry of a field's accepted list: an exact content type or a family `type/*`. */
export const isFileAccept = (entry: string): boolean => entry.length <= FILE_MIME_MAX && ACCEPT.test(entry)

/** The content type without its parameters, lower case: `Image/PNG; q=1` is `image/png`. */
export const fileMimeOf = (given: string): string => (given.split(";", 1)[0] ?? "").trim().toLowerCase()

/** True when `mime` is one the accepted list admits: listed exactly, or its family `type/*` is listed. */
export const mimeAccepted = (accept: ReadonlyArray<string>, mime: string): boolean => {
    const slash = mime.indexOf("/")
    const family = slash < 0 ? null : `${mime.slice(0, slash)}/*`
    return accept.includes(mime) || (family !== null && accept.includes(family))
}

/** The bounded shape of any stored reference: what a reader accepts, whatever limits its field declares now. */
export const FILE_REF_SCHEMA: z.ZodType<FileRef> = z.strictObject({
    key: z.string().min(1).max(FILE_KEY_MAX).refine(isFileKey),
    mime: z.string().min(3).max(FILE_MIME_MAX).refine(isFileMime),
    size: z.number().int().min(0).max(FILE_BYTES_CEILING),
    name: z.string().min(1).max(FILE_NAME_MAX),
})

/**
 * The shape a WRITE of a `file` field is parsed through: a bounded reference whose content type the field accepts and whose size is
 * at most the field's `maxBytes`. A field that declares no limits admits nothing (`entityProblems` refuses such a declaration).
 */
export const fileRefSchemaOf = (field: FieldDef): z.ZodType<FileRef> => {
    const accept = field.accept ?? []
    const maxBytes = field.maxBytes ?? 0
    return FILE_REF_SCHEMA.refine((ref) => mimeAccepted(accept, ref.mime) && ref.size <= maxBytes)
}

/** The bounded shape of any stored list of references: no more than the ceiling, no key twice. */
export const FILE_LIST_SCHEMA: z.ZodType<ReadonlyArray<FileRef>> = z
    .array(FILE_REF_SCHEMA)
    .max(FILE_LIST_MAX)
    .refine((list) => new Set(list.map((ref) => ref.key)).size === list.length)

/**
 * The shape a WRITE of a list file field is parsed through: every reference as `fileRefSchemaOf` admits it, at most the field's `max`
 * of them, no object named twice (the order is the value's own).
 */
export const fileListSchemaOf = (field: FieldDef): z.ZodType<ReadonlyArray<FileRef>> =>
    z
        .array(fileRefSchemaOf(field))
        .max(field.max ?? 0)
        .refine((list) => new Set(list.map((ref) => ref.key)).size === list.length)

/** True for a file field that holds an ordered list of references (`many`), false for one that holds a single reference. */
export const isFileList = (field: FieldDef): boolean => field.kind === "file" && field.many === true

/** The shape a write of a file field is parsed through: its list form or its single form. */
export const fileValueSchemaOf = (field: FieldDef): z.ZodType<FileRef | ReadonlyArray<FileRef>> =>
    isFileList(field) ? fileListSchemaOf(field) : fileRefSchemaOf(field)

/** The shape any stored value of a file field is read through, whatever limits the field declares now. */
export const fileStoredSchemaOf = (field: FieldDef): z.ZodType<FileRef | ReadonlyArray<FileRef>> =>
    isFileList(field) ? FILE_LIST_SCHEMA : FILE_REF_SCHEMA

/** The references a file field's stored value names, in order: the list, the single reference as one, none when the value holds no reference. */
export const fileRefsOf = (field: FieldDef, value: unknown): ReadonlyArray<FileRef> => {
    if (isFileList(field)) {
        const list = FILE_LIST_SCHEMA.safeParse(value ?? null)
        return list.success ? list.data : []
    }
    const single = FILE_REF_SCHEMA.safeParse(value ?? null)
    return single.success ? [single.data] : []
}

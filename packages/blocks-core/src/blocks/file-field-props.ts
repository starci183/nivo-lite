import { z } from "zod"
import { fileLimitsOf } from "../rows/file-field"

/** The longest record type name a file block names. */
export const FILE_TYPE_MAX = 100

/** The longest field name a file block names. */
export const FILE_FIELD_MAX = 64

/** The zod type of the prop that names a record type. */
export type FileTypeSchema = z.ZodString

/** The zod type of a prop that names a field of a record type. */
export type FileFieldSchema = z.ZodString

/** The record type whose file field a block shows or fills: a declared type name (`blocks-core.video.brand-kit`). */
export const fileType: FileTypeSchema = z.string().min(1).max(FILE_TYPE_MAX)

/** A field name of a record type. */
export const fileField: FileFieldSchema = z.string().regex(/^[A-Za-z]\w*$/u).max(FILE_FIELD_MAX)

/** True when `field` of the record type `type` is a `file` field the entity declarations declare: a block holds nothing the declaration does not. */
export const isDeclaredFileField = (type: string, field: string): boolean => fileLimitsOf(type, field) !== null

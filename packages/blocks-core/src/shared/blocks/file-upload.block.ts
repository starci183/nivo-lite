import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { PATH_MAX } from "./bounds"
import { fileField, fileType, isDeclaredFileField, type FileFieldSchema, type FileTypeSchema } from "./file-field-props"
import { RECORD_SURFACES } from "./record-surface"
import type { EnumSchema, RequiredAction, RequiredRead, TextSchema } from "./schema-types"

const props: z.ZodObject<{
    label: TextSchema
    type: FileTypeSchema
    field: FileFieldSchema
    idPath: z.ZodOptional<z.ZodString>
    idle: z.ZodOptional<TextSchema>
    surface: z.ZodOptional<EnumSchema<(typeof RECORD_SURFACES)[number]>>
}> = z
    .object({
        label: specText,
        type: fileType,
        field: fileField,
        idPath: z.string().max(PATH_MAX).optional(),
        idle: specText.optional(),
        surface: z.enum(RECORD_SURFACES).optional(),
    })
    .refine((value) => isDeclaredFileField(value.type, value.field), { path: ["field"] })

/** The slots of the upload block: the record whose file field it fills, and the action that changes it (the door grants the upload and the removal by it). */
type Slots = { readonly record: RequiredRead<"record">; readonly write: RequiredAction }
const slots: Slots = {
    record: { kind: "read", shape: "record", required: true },
    write: { kind: "action", required: true },
}

/**
 * Picks one file for the declared `file` field `field` of the bound record (of the record type `type`) and puts it there through the
 * host's file port. The accepted types and the size limit it names come from the entity declaration, not from the spec; a file that
 * breaks them is refused before any byte is sent, and the store checks again. It shows the file now on the field (the bound record
 * carries its reference under the field's name), the progress of an upload, a replace control and a remove control that confirms
 * first. A record not saved yet (no id at `idPath`, default `id`) says to save it first; `idle` words that. `type` and `field` must
 * name a declared file field: a spec naming anything else is refused. The `write` slot binds the action of the module that stores the
 * record's type; the host makes the upload and the removal for it, so the member needs its permission; a bound read or action that
 * does not declare the type's entity port is refused (`reaches`).
 */
export const fileUploadBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.file-upload",
    title: { key: "blockFileUpload" },
    props,
    slots,
    children: false,
    reaches: "type",
})

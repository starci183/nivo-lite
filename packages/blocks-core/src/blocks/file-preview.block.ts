import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { PATH_MAX } from "./bounds"
import { fileField, fileType, isDeclaredFileField, type FileFieldSchema, type FileTypeSchema } from "./file-field-props"
import { RECORD_SURFACES } from "./record-surface"
import type { EnumSchema, RequiredRead, TextSchema } from "./schema-types"

const props: z.ZodObject<{
    label: TextSchema
    type: FileTypeSchema
    field: FileFieldSchema
    posterField: z.ZodOptional<FileFieldSchema>
    idPath: z.ZodOptional<z.ZodString>
    empty: z.ZodOptional<TextSchema>
    surface: z.ZodOptional<EnumSchema<(typeof RECORD_SURFACES)[number]>>
}> = z
    .object({
        label: specText,
        type: fileType,
        field: fileField,
        posterField: fileField.optional(),
        idPath: z.string().max(PATH_MAX).optional(),
        empty: specText.optional(),
        surface: z.enum(RECORD_SURFACES).optional(),
    })
    .refine(
        (value) =>
            isDeclaredFileField(value.type, value.field) &&
            (value.posterField === undefined || isDeclaredFileField(value.type, value.posterField)),
        { path: ["field"] },
    )

/** The slots of the preview block: the record whose file field it shows. */
type Slots = { readonly record: RequiredRead<"record"> }
const slots: Slots = { record: { kind: "read", shape: "record", required: true } }

/**
 * Shows the file on the declared `file` field `field` of the bound record (of the record type `type`; the record carries its
 * reference under the field's name): an image as a picture, a video in a player (with the picture on `posterField` as its poster
 * when the spec names one), anything else, audio included, as a link that opens it with the file's name and size. The bytes are read
 * through a short-lived signed address the host's file port issues; the block asks again before it expires. A record with no file
 * on the field draws `empty`. `type` and `field` must name a declared file field: a spec naming anything else is refused. The host asks
 * the address for the read bound to `record`, so the viewer needs only that read's permission; a read that does not declare the type's
 * entity port is refused (`reaches`).
 */
export const filePreviewBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.file-preview",
    title: { key: "blockFilePreview" },
    props,
    slots,
    children: false,
    reaches: "type",
})

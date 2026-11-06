import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { LIST_FIELD_KINDS, LIST_FIELDS_MAX, LIST_ROWS_MAX } from "../rows/list-rows"
import { PATH_MAX } from "./bounds"
import { currencyCode } from "./currency-prop"
import { formField } from "./form.block"
import type { FormFieldSchema, OptionalRead } from "./form.block"
import type { RequiredAction, TextSchema } from "./schema-types"

/** A field of a row: a form field of one of the kinds a row holds. */
const ROW_KINDS: ReadonlyArray<string> = LIST_FIELD_KINDS
const rowField: FormFieldSchema = formField.refine((field) => ROW_KINDS.includes(field.kind))

const props: z.ZodObject<{
    label: TextSchema
    listPath: z.ZodString
    fields: z.ZodArray<FormFieldSchema>
    maxRows: z.ZodNumber
    minRows: z.ZodOptional<z.ZodNumber>
    isReorderable: z.ZodOptional<z.ZodBoolean>
    addLabel: TextSchema
    removeLabel: TextSchema
    moveUpLabel: z.ZodOptional<TextSchema>
    moveDownLabel: z.ZodOptional<TextSchema>
    emptyRows: z.ZodOptional<TextSchema>
    submitLabel: TextSchema
    successNotice: z.ZodOptional<TextSchema>
    idPath: z.ZodOptional<z.ZodString>
    currency: z.ZodOptional<z.ZodString>
}> = z
    .object({
        label: specText,
        listPath: z.string().min(1).max(PATH_MAX),
        fields: z
            .array(rowField)
            .min(1)
            .max(LIST_FIELDS_MAX)
            .refine((fields) => new Set(fields.map((field) => field.name)).size === fields.length),
        maxRows: z.number().int().min(1).max(LIST_ROWS_MAX),
        minRows: z.number().int().min(0).max(LIST_ROWS_MAX).optional(),
        isReorderable: z.boolean().optional(),
        addLabel: specText,
        removeLabel: specText,
        moveUpLabel: specText.optional(),
        moveDownLabel: specText.optional(),
        emptyRows: specText.optional(),
        submitLabel: specText,
        successNotice: specText.optional(),
        idPath: z.string().max(PATH_MAX).optional(),
        currency: currencyCode.optional(),
    })
    .refine((value) => (value.minRows ?? 0) <= value.maxRows)
    .refine(
        (value) =>
            value.isReorderable !== true || (value.moveUpLabel !== undefined && value.moveDownLabel !== undefined),
    )

/** The slots of the list editor: the record that holds the list, and the action a save runs. */
type Slots = {
    readonly record: OptionalRead<"record">
    readonly submit: RequiredAction
}
const slots: Slots = {
    record: { kind: "read", shape: "record", required: false },
    submit: { kind: "action", required: true },
}

/**
 * Repeated rows of declared fields (text, number, money, choice, switch) read from the list at `listPath` of the bound record, with
 * add and remove and, with `isReorderable`, moving a row up or down. The rows are bounded by `minRows` and `maxRows`. A save runs the
 * action slot with the whole list as `values`: every field of every row under `<position>.<field name>` (`0.min`, `1.rate`),
 * positions counted from 0, so a tier ladder or a table of category rates is saved in one step.
 */
export const listEditorBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.list-editor",
    title: { key: "blockListEditor" },
    props,
    slots,
    children: false,
})

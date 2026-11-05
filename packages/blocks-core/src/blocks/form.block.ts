import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { FORM_KINDS } from "../rows/form-values"
import type { FormKind } from "../rows/form-values"
import { PATH_MAX } from "./bounds"
import { currencyCode } from "./currency-prop"
import type { EnumSchema, RequiredAction, TextSchema } from "./schema-types"

/** The most fields one form holds. */
export const FORM_FIELDS_MAX = 30

/** The most choices one choice field offers. */
export const FORM_OPTIONS_MAX = 50

/** The longest name of a field, and the longest value of a choice. */
export const FORM_NAME_MAX = 64

/** The largest bound a field may set on its text length or its number. */
export const FORM_LIMIT_MAX = 1_000_000_000_000

type OptionSchema = z.ZodObject<{ value: z.ZodString; label: TextSchema }>

const option: OptionSchema = z.object({ value: z.string().min(1).max(FORM_NAME_MAX), label: specText })

/** The zod type of one field of a form. */
export type FormFieldSchema = z.ZodObject<{
    name: z.ZodString
    label: TextSchema
    kind: EnumSchema<FormKind>
    hint: z.ZodOptional<TextSchema>
    options: z.ZodOptional<z.ZodArray<OptionSchema>>
    required: z.ZodOptional<z.ZodBoolean>
    max: z.ZodOptional<z.ZodNumber>
}>

/** One field of a form, as the form block and the blocks that edit values declare it. */
export const formField: FormFieldSchema = z.object({
    name: z
        .string()
        .regex(/^[A-Za-z]\w*$/)
        .max(FORM_NAME_MAX),
    label: specText,
    kind: z.enum(FORM_KINDS),
    hint: specText.optional(),
    options: z.array(option).max(FORM_OPTIONS_MAX).optional(),
    required: z.boolean().optional(),
    max: z.number().positive().max(FORM_LIMIT_MAX).optional(),
})

const props: z.ZodObject<{
    label: TextSchema
    submitLabel: TextSchema
    successNotice: z.ZodOptional<TextSchema>
    requireRecord: z.ZodOptional<z.ZodBoolean>
    idle: z.ZodOptional<TextSchema>
    idPath: z.ZodOptional<z.ZodString>
    currency: z.ZodOptional<z.ZodString>
    fields: z.ZodArray<FormFieldSchema>
}> = z.object({
    label: specText,
    submitLabel: specText,
    successNotice: specText.optional(),
    requireRecord: z.boolean().optional(),
    idle: specText.optional(),
    idPath: z.string().max(PATH_MAX).optional(),
    currency: currencyCode.optional(),
    fields: z.array(formField).min(1).max(FORM_FIELDS_MAX),
})

/** A read slot that a spec may leave unbound. */
export interface OptionalRead<S extends "record" | "list"> {
    /** Marks the slot as one a spec binds to a read. */
    readonly kind: "read"
    /** Whether the bound read yields one record or a list of them. */
    readonly shape: S
    /** A spec may leave the slot unbound; the block then draws a blank form. */
    readonly required: false
}

/** The slots of the form block: the record that fills it, and the action its submit runs. */
type Slots = {
    readonly record: OptionalRead<"record">
    readonly submit: RequiredAction
}
const slots: Slots = {
    record: { kind: "read", shape: "record", required: false },
    submit: { kind: "action", required: true },
}

/**
 * Fields as data, filled from an optional record, validated per field and submitted through one action with the record's id and the
 * values. With `requireRecord` a form that has no record draws the `idle` notice instead of a blank form.
 */
export const formBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.form",
    title: { key: "blockForm" },
    props,
    slots,
    children: false,
})

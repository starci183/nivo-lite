import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { COMMAND_INTENTS, type CommandIntent } from "../rows/decision-commands"
import { currencyCode } from "./currency-prop"
import { FORM_FIELDS_MAX, FORM_NAME_MAX, formField, type FormFieldSchema } from "./form.block"
import type { TextSchema, EnumSchema, RequiredRead, OptionalAction, OptionalRead } from "./schema-types"

/** Where a queue stands: a card on a card page, or a section in a pane. */
export const QUEUE_SURFACES = ["card", "section"] as const

/** How large the commands of a row are: small in a list of many, regular where one decision is the whole point. */
export const QUEUE_COMMAND_SIZES = ["sm", "md"] as const

/** The most commands one queue gives words to. */
export const QUEUE_COMMANDS_MAX = 8

type CommandSchema = z.ZodObject<{
    id: z.ZodString
    label: TextSchema
    intent: z.ZodOptional<EnumSchema<CommandIntent>>
}>

const command: CommandSchema = z.object({
    id: z.string().min(1).max(FORM_NAME_MAX),
    label: specText,
    intent: z.enum(COMMAND_INTENTS).optional(),
})

type EditSchema = z.ZodObject<{
    label: TextSchema
    submitLabel: TextSchema
    cancelLabel: TextSchema
    fields: z.ZodArray<FormFieldSchema>
}>

const edit: EditSchema = z.object({
    label: specText,
    submitLabel: specText,
    cancelLabel: specText,
    fields: z.array(formField).min(1).max(FORM_FIELDS_MAX),
})

type PickSchema = z.ZodObject<{
    valueName: z.ZodString
    title: TextSchema
    searchLabel: TextSchema
    emptyBody: TextSchema
}>

type ConfirmSchema = z.ZodObject<{
    title: TextSchema
    body: TextSchema
    confirmLabel: TextSchema
    cancelLabel: TextSchema
    values: z.ZodRecord<z.ZodString, z.ZodString>
}>

type ChoiceSchema = z.ZodObject<{
    command: z.ZodString
    sends: z.ZodString
    pick: z.ZodOptional<PickSchema>
    confirm: z.ZodOptional<ConfirmSchema>
}>

/**
 * A row command that needs more than a press before the action runs, by the id the rows' commands carry: it either picks one of the
 * options the `options` read lists (a searchable overlay; the chosen id is sent as `values[pick.valueName]`) or confirms first (the
 * declared `values` are sent). The action slot runs with `{ id, command: sends, values }`. Exactly one of `pick` and `confirm`.
 */
const choice: ChoiceSchema = z
    .object({
        command: z.string().min(1).max(FORM_NAME_MAX),
        sends: z.string().min(1).max(FORM_NAME_MAX),
        pick: z
            .object({
                valueName: z.string().min(1).max(FORM_NAME_MAX),
                title: specText,
                searchLabel: specText,
                emptyBody: specText,
            })
            .optional(),
        confirm: z
            .object({
                title: specText,
                body: specText,
                confirmLabel: specText,
                cancelLabel: specText,
                values: z
                    .record(z.string().min(1).max(FORM_NAME_MAX), z.string().max(FORM_NAME_MAX))
                    .refine((values) => Object.keys(values).length <= FORM_FIELDS_MAX),
            })
            .optional(),
    })
    .refine((entry) => (entry.pick === undefined) !== (entry.confirm === undefined))

const props: z.ZodObject<{
    surface: EnumSchema<(typeof QUEUE_SURFACES)[number]>
    isHeadless: z.ZodOptional<z.ZodBoolean>
    commandSize: z.ZodOptional<EnumSchema<(typeof QUEUE_COMMAND_SIZES)[number]>>
    label: TextSchema
    emptyTitle: TextSchema
    emptyBody: TextSchema
    seeWhy: TextSchema
    moreMenu: TextSchema
    currency: z.ZodOptional<z.ZodString>
    commands: z.ZodOptional<z.ZodArray<CommandSchema>>
    edit: z.ZodOptional<EditSchema>
    choices: z.ZodOptional<z.ZodArray<ChoiceSchema>>
}> = z.object({
    surface: z.enum(QUEUE_SURFACES),
    isHeadless: z.boolean().optional(),
    commandSize: z.enum(QUEUE_COMMAND_SIZES).optional(),
    label: specText,
    emptyTitle: specText,
    emptyBody: specText,
    seeWhy: specText,
    moreMenu: specText,
    currency: currencyCode.optional(),
    commands: z
        .array(command)
        .max(QUEUE_COMMANDS_MAX)
        .refine((commands) => new Set(commands.map((entry) => entry.id)).size === commands.length)
        .optional(),
    edit: edit.optional(),
    choices: z
        .array(choice)
        .max(QUEUE_COMMANDS_MAX)
        .refine((choices) => new Set(choices.map((entry) => entry.command)).size === choices.length)
        .optional(),
})
/** The slots of the decision queue block: the queue read and the command a row may run. */
type Slots = {
    readonly queue: RequiredRead<"record">
    readonly command: OptionalAction
    readonly options: OptionalRead<"record">
}
const slots: Slots = {
    queue: { kind: "read", shape: "record", required: true },
    command: { kind: "action", required: false },
    options: { kind: "read", shape: "record", required: false },
}

/**
 * The decisions waiting for a person, each decided in place through a command on its row. The spec gives the words (and look) of
 * the commands by id in `commands`; a command it does not declare draws as its row gives it. With `edit` the edit command of a row
 * opens a small inline form of the declared fields, started from the row's draft, and the action slot runs with
 * `{ id, command: "edit", values }` so a proposal can be changed before it is approved. A command listed in `choices` first opens
 * an overlay that picks one of the `options` (a searchable list, the closest to the row's amount first) or confirms, and then runs
 * the action with `{ id, command: sends, values }`.
 */
export const decisionQueueBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.decision-queue",
    title: { key: "blockDecisionQueue" },
    props,
    slots,
    children: false,
})

import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { COMMAND_INTENTS } from "../rows/decision-commands"
import type { CommandIntent } from "../rows/decision-commands"
import { currencyCode } from "./currency-prop"
import { FORM_FIELDS_MAX, FORM_NAME_MAX, formField } from "./form.block"
import type { FormFieldSchema } from "./form.block"
import type { TextSchema, EnumSchema, RequiredRead, OptionalAction } from "./schema-types"

/** Where a queue stands: a card on a card page, or a section in a pane. */
export const QUEUE_SURFACES = ["card", "section"] as const

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

const props: z.ZodObject<{
    surface: EnumSchema<(typeof QUEUE_SURFACES)[number]>
    label: TextSchema
    emptyTitle: TextSchema
    emptyBody: TextSchema
    seeWhy: TextSchema
    moreMenu: TextSchema
    currency: z.ZodOptional<z.ZodString>
    commands: z.ZodOptional<z.ZodArray<CommandSchema>>
    edit: z.ZodOptional<EditSchema>
}> = z.object({
    surface: z.enum(QUEUE_SURFACES),
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
})
/** The slots of the decision queue block: the queue read and the command a row may run. */
type Slots = {
    readonly queue: RequiredRead<"record">
    readonly command: OptionalAction
}
const slots: Slots = {
    queue: { kind: "read", shape: "record", required: true },
    command: { kind: "action", required: false },
}

/**
 * The decisions waiting for a person, each decided in place through a command on its row. The spec gives the words (and look) of
 * the commands by id in `commands`; a command it does not declare draws as its row gives it. With `edit` the edit command of a row
 * opens a small inline form of the declared fields, started from the row's draft, and the action slot runs with
 * `{ id, command: "edit", values }` so a proposal can be changed before it is approved.
 */
export const decisionQueueBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.decision-queue",
    title: { key: "blockDecisionQueue" },
    props,
    slots,
    children: false,
})

import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { COMMAND_INTENTS } from "../rows/decision-commands"
import type { CommandIntent } from "../rows/decision-commands"
import { OPEN_KEY, ROW_ACTION_SLOTS } from "../rows/row-actions"
import type { RowActionSlot } from "../rows/row-actions"
import { CELL_TONES } from "../rows/table-rows"
import { CHIPS_MAX, PATH_MAX } from "./bounds"
import { labelsProp } from "./labels-prop"
import type { LabelsSchema } from "./labels-prop"
import { paramName } from "./param-name"
import type { ParamNameSchema } from "./param-name"
import type { EnumSchema, TextSchema, RequiredRead, OptionalAction } from "./schema-types"

/** The longest raw value a badge is given a tone for, and the most values one badge gives a tone. */
const TONE_VALUE_MAX = 64
const TONES_MAX = 20

/** The longest key a row's action field takes to choose a command. */
const ACTION_KEY_MAX = 64

/** One command a row may offer: the slot that runs it, the value a row names it by, and its words and look. */
type ActionSchema = z.ZodObject<{
    slot: EnumSchema<RowActionSlot>
    key: z.ZodOptional<z.ZodString>
    label: z.ZodOptional<TextSchema>
    intent: z.ZodOptional<EnumSchema<CommandIntent>>
}>

const action: ActionSchema = z.object({
    slot: z.enum(ROW_ACTION_SLOTS),
    key: z.string().min(1).max(ACTION_KEY_MAX).optional(),
    label: specText.optional(),
    intent: z.enum(COMMAND_INTENTS).optional(),
})

const props: z.ZodObject<{
    label: TextSchema
    empty: TextSchema
    idPath: z.ZodString
    titlePath: z.ZodString
    descriptionPath: z.ZodOptional<z.ZodString>
    badgePath: z.ZodOptional<z.ZodString>
    metaPath: z.ZodOptional<z.ZodString>
    chipPaths: z.ZodOptional<z.ZodArray<z.ZodString>>
    badgeTones: z.ZodOptional<z.ZodRecord<z.ZodString, EnumSchema<(typeof CELL_TONES)[number]>>>
    avatar: z.ZodOptional<z.ZodBoolean>
    actionPath: z.ZodOptional<z.ZodString>
    actions: z.ZodOptional<z.ZodArray<ActionSchema>>
    labels: z.ZodOptional<LabelsSchema>
    emptySearch: z.ZodOptional<TextSchema>
    selectParam: z.ZodOptional<ParamNameSchema>
    searchParam: z.ZodOptional<ParamNameSchema>
}> = z.object({
    label: specText,
    empty: specText,
    idPath: z.string().max(PATH_MAX),
    titlePath: z.string().max(PATH_MAX),
    descriptionPath: z.string().max(PATH_MAX).optional(),
    badgePath: z.string().max(PATH_MAX).optional(),
    metaPath: z.string().max(PATH_MAX).optional(),
    chipPaths: z.array(z.string().max(PATH_MAX)).max(CHIPS_MAX).optional(),
    badgeTones: z
        .record(z.string().max(TONE_VALUE_MAX), z.enum(CELL_TONES))
        .refine((tones) => Object.keys(tones).length <= TONES_MAX)
        .optional(),
    avatar: z.boolean().optional(),
    actionPath: z.string().max(PATH_MAX).optional(),
    actions: z
        .array(action)
        .max(ROW_ACTION_SLOTS.length)
        .refine((actions) => {
            const keys = actions.map((entry) => entry.key ?? entry.slot)
            return (
                new Set(actions.map((entry) => entry.slot)).size === actions.length &&
                new Set(keys).size === keys.length &&
                !keys.includes(OPEN_KEY)
            )
        })
        .optional(),
    labels: labelsProp.optional(),
    emptySearch: specText.optional(),
    selectParam: paramName.optional(),
    searchParam: paramName.optional(),
})
/** The slots of the record list block: the rows read, the one action every row may run, and four more for the `actions` the spec lists. */
type Slots = {
    readonly rows: RequiredRead<"list">
    readonly open: OptionalAction
    readonly action1: OptionalAction
    readonly action2: OptionalAction
    readonly action3: OptionalAction
    readonly action4: OptionalAction
}
const slots: Slots = {
    rows: { kind: "read", shape: "list", required: true },
    open: { kind: "action", required: false },
    action1: { kind: "action", required: false },
    action2: { kind: "action", required: false },
    action3: { kind: "action", required: false },
    action4: { kind: "action", required: false },
}

/**
 * Bound records as a card with an optional pill command under the text of each row; with a `selectParam` a selectable list that
 * writes the chosen row to the param, marks the row the param names and loads further pages on request. With a `searchParam` its
 * empty state says the search found nothing and offers to clear it.
 *
 * The commands of a card list: the single `open` action, and up to four `actions` (`{ slot, key?, label?, intent? }`, each slot
 * bound to one action). A row draws one pill: with an `actionPath`, the command whose key (the slot name unless `key` is given, or
 * `open`) equals the text at that path of its record, and none when no command the viewer may run has that key; without it, the
 * first command the viewer may run, declared ones before `open`.
 */
export const recordListBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.record-list",
    title: { key: "blockRecordList" },
    params: ["selectParam", "searchParam"],
    props,
    slots,
    children: false,
})

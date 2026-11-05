import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { PATH_MAX } from "./bounds"
import { paramName } from "./param-name"
import type { ParamNameSchema } from "./param-name"
import type { TextSchema, RequiredRead, OptionalAction } from "./schema-types"

const props: z.ZodObject<{
    label: TextSchema
    empty: TextSchema
    idPath: z.ZodString
    titlePath: z.ZodString
    descriptionPath: z.ZodOptional<z.ZodString>
    badgePath: z.ZodOptional<z.ZodString>
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
    emptySearch: specText.optional(),
    selectParam: paramName.optional(),
    searchParam: paramName.optional(),
})
/** The slots of the record list block: the rows read and the action a row may run. */
type Slots = {
    readonly rows: RequiredRead<"list">
    readonly open: OptionalAction
}
const slots: Slots = {
    rows: { kind: "read", shape: "list", required: true },
    open: { kind: "action", required: false },
}

/**
 * Bound records as a card with an optional action on each row; with a `selectParam` a selectable list that writes the chosen row
 * to the param, marks the row the param names and loads further pages on request. With a `searchParam` its empty state says
 * the search found nothing and offers to clear it.
 */
export const recordListBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.record-list",
    title: { key: "blockRecordList" },
    params: ["selectParam", "searchParam"],
    props,
    slots,
    children: false,
})

import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { PATH_MAX } from "./bounds"
import type { TextSchema, RequiredRead, OptionalAction } from "./schema-types"

const props: z.ZodObject<{
    label: TextSchema
    empty: TextSchema
    idPath: z.ZodString
    titlePath: z.ZodString
    descriptionPath: z.ZodOptional<z.ZodString>
    badgePath: z.ZodOptional<z.ZodString>
}> = z.object({
    label: specText,
    empty: specText,
    idPath: z.string().max(PATH_MAX),
    titlePath: z.string().max(PATH_MAX),
    descriptionPath: z.string().max(PATH_MAX).optional(),
    badgePath: z.string().max(PATH_MAX).optional(),
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

/** A card listing bound records, with an optional action on each row. */
export const recordListBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.record-list",
    title: { key: "blockRecordList" },
    props,
    slots,
    children: false,
})

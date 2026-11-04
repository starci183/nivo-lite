import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { MAX_ID } from "../bounds"
import type { TextSchema, RowsSlots } from "./schema-types"

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
    idPath: z.string().max(MAX_ID),
    titlePath: z.string().max(MAX_ID),
    descriptionPath: z.string().max(MAX_ID).optional(),
    badgePath: z.string().max(MAX_ID).optional(),
})
const slots: RowsSlots = {
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

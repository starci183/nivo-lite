import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { ITEMS_MAX, PATH_MAX } from "./bounds"
import type { TextSchema, TermPathsSchema, RequiredRead } from "./schema-types"

const props: z.ZodObject<{ label: TextSchema; items: TermPathsSchema }> = z.object({
    label: specText,
    items: z.array(z.object({ term: specText, path: z.string().max(PATH_MAX) })).max(ITEMS_MAX),
})
/** The slots of the detail block. */
type Slots = {
    readonly data: RequiredRead<"record">
}
const slots: Slots = { data: { kind: "read", shape: "record", required: true } }

/** The facts of one bound record in a card: each item names its term and the path of its value. */
export const detailBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.detail",
    title: { key: "blockDetail" },
    props,
    slots,
    children: false,
})

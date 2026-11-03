import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { TextSchema, TermPathsSchema, RequiredRead } from "./schema-types"

const props: z.ZodObject<{ label: TextSchema; items: TermPathsSchema }> = z.object({
    label: specText,
    items: z.array(z.object({ term: specText, path: z.string() })),
})
const slots: { readonly data: RequiredRead<"record"> } = { data: { kind: "read", shape: "record", required: true } }

/** A ribbon of figures in one card: each item names its term and the path of its value in the bound record. */
export const figuresBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.figures",
    title: { key: "blockFigures" },
    props,
    slots,
    children: false,
})

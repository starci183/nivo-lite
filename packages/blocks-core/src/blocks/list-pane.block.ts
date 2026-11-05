import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { paramName } from "./param-name"
import type { ParamNameSchema } from "./param-name"
import type { TextSchema } from "./schema-types"

const props: z.ZodObject<{
    search: z.ZodBoolean
    searchParam: z.ZodOptional<ParamNameSchema>
    searchLabel: z.ZodOptional<TextSchema>
}> = z
    .object({
        search: z.boolean(),
        searchParam: paramName.optional(),
        searchLabel: specText.optional(),
    })
    .refine((value) => !value.search || value.searchParam !== undefined)
const slots: Record<never, never> = {}

/**
 * The pane of a list: a search field over its two children, a filter-tabs block and a list. The text typed waits 300 ms and is
 * written to the `searchParam`; Escape clears it. The blocks inside read the param through their own bindings.
 */
export const listPaneBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.list-pane",
    title: { key: "blockListPane" },
    props,
    slots,
    children: { max: 2, accepts: ["core.filter-tabs", "core.record-list"] },
})

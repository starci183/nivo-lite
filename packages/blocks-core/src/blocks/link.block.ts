import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { PATH_MAX } from "./bounds"
import type { TextSchema } from "./schema-types"

const props: z.ZodObject<{ label: TextSchema; path: z.ZodString }> = z.object({
    label: specText,
    path: z.string().min(1).max(PATH_MAX),
})
const slots: Record<never, never> = {}

/** One link to a page of the app: its words and the path it opens, an app path or one beside the open page (`./work`). */
export const linkBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.link",
    title: { key: "blockLink" },
    props,
    slots,
    children: false,
})

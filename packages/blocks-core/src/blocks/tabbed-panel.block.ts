import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { paramName } from "./selection-param"
import type { TextSchema } from "./schema-types"

/** The most tabs one panel holds. */
export const TABS_MAX = 12

/** The longest id of a tab. */
export const TAB_ID_MAX = 64

type TabSchema = z.ZodObject<{ id: z.ZodString; label: TextSchema }>

const tab: TabSchema = z.object({ id: z.string().min(1).max(TAB_ID_MAX), label: specText })

const props: z.ZodObject<{
    label: TextSchema
    tabs: z.ZodArray<TabSchema>
    param: z.ZodString
}> = z.object({
    label: specText,
    tabs: z.array(tab).min(1).max(TABS_MAX),
    param: paramName,
})
const slots: Record<never, never> = {}

/** Child blocks under tabs: the nth child is the panel of the nth tab, and the spec param holds the id of the chosen tab. */
export const tabbedPanelBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.tabbed-panel",
    title: { key: "blockTabbedPanel" },
    props,
    slots,
    children: { max: TABS_MAX },
})

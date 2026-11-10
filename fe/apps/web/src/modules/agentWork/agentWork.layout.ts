import type { PaneGridLayout } from "@/modules/types"

/**
 * The arrangement (pane-grid.choose.frame grid) of the Work tab: the well, the one pane on the page ground, where white cards float
 * (the region tabs are the second tab row of the page band).
 */
export const agentWorkGridOf = (): PaneGridLayout => ({
    areas: { base: ["well"], medium: ["well"] },
    columns: { base: ["fill"], medium: ["fill"] },
    rows: { base: ["fill"], medium: ["fill"] },
})

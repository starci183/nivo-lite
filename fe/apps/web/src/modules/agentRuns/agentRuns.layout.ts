import type { PaneGridLayout } from "@/modules/types"

/**
 * The list of runs: the table of runs alone, in the main pane on the page ground (the workflow is a select in the table's search row).
 */
export const agentRunsGridOf = (): PaneGridLayout => ({
    areas: { base: ["main"], medium: ["main"] },
    columns: { base: ["fill"], medium: ["fill"] },
    rows: { base: ["fill"], medium: ["fill"] },
})

/**
 * The panes of one run: the head, the map and the decision on the page ground, and at the wide width the step the person pressed in a
 * white aside beside them (a drawer below it). A phone has the main pane alone: the steps are a card in it and there is no map.
 */
export const agentRunGridOf = (): PaneGridLayout => ({
    areas: { base: ["main"], medium: ["main"], wide: ["main aside"] },
    columns: { base: ["fill"], medium: ["fill"], wide: ["fill", "standard"] },
    rows: { base: ["fill"], medium: ["fill"], wide: ["fill"] },
})

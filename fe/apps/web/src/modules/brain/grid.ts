import type { PaneGridLayout } from "@/modules/types"

/** What decides the arrangement of the panes of a Second Brain tab. */
interface BrainGridInput {
    /** The tab has a side pane: a third column from the wide width, a drawer below it. */
    readonly hasAside: boolean
    /** The one pane a phone shows. */
    readonly phone: "list" | "main"
    /** The read settled to a notice: one pane across the page. */
    readonly isWhole: boolean
}

/** The grid of a read that settled without rows: one pane across the page. */
const WHOLE_PAGE_GRID: PaneGridLayout = {
    areas: { base: ["main"], medium: ["main"], wide: ["main"] },
    columns: { base: ["fill"], medium: ["fill"], wide: ["fill"] },
    rows: { base: ["fill"], medium: ["fill"], wide: ["fill"] },
}

/** The panes of a read that has rows. */
const panesOf = (input: BrainGridInput): PaneGridLayout => ({
    areas: {
        base: input.phone === "list" ? ["list"] : ["head", "main"],
        medium: ["list head", "list main"],
        wide: input.hasAside ? ["list head aside", "list main aside"] : ["list head", "list main"],
    },
    columns: {
        base: ["fill"],
        medium: ["wide", "fill"],
        wide: input.hasAside ? ["wide", "fill", "standard"] : ["wide", "fill"],
    },
    rows: {
        base: input.phone === "list" ? ["fill"] : ["auto", "fill"],
        medium: ["auto", "fill"],
        wide: ["auto", "fill"],
    },
})

/**
 * The panes of a Second Brain tab: the list runs the whole height of its column (search and filters at its top, no band of its
 * own), the main pane has its head band, and the side pane runs both rows with its own head inside. A phone shows the list, or the main pane with its head.
 */
export const brainGridOf = (input: BrainGridInput): PaneGridLayout => (input.isWhole ? WHOLE_PAGE_GRID : panesOf(input))

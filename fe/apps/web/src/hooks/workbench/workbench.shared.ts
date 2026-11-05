import type { PaneGridLayout } from "@/modules/types"

/** Which of the workbench's two panes the owner chose: the default arrangement, the decisions as the one pane a phone shows, or the side pane closed. */
export type WorkbenchPane = "default" | "waiting" | "closed"

/** What decides the arrangement of a workbench's panes. */
interface WorkbenchGridInput {
    readonly pane: WorkbenchPane
    /** A decision is explained: the side pane holds the explanation, so it is shown. */
    readonly hasWhy: boolean
}

/**
 * The areas and tracks of every workbench: the tabs band over the work, and the side pane (its head over its body) beside
 * them from 70rem. A phone shows one pane: the work with its tabs, or the side pane when the owner opened it or an
 * explanation is open. The owner may close the side pane; an open explanation reopens it.
 */
export const workbenchGridOf = (input: WorkbenchGridInput): PaneGridLayout => {
    const isAsideShown = input.pane !== "closed" || input.hasWhy
    const isAsideAlone = input.pane === "waiting" || input.hasWhy
    const single = isAsideAlone ? ["asideHead", "aside"] : ["head", "main"]
    return {
        areas: {
            base: single,
            medium: single,
            wide: isAsideShown ? ["head asideHead", "main aside"] : ["head", "main"],
        },
        columns: {
            base: ["fill"],
            medium: ["fill"],
            wide: isAsideShown ? ["fill", "standard"] : ["fill"],
        },
        rows: { base: ["auto", "fill"], medium: ["auto", "fill"], wide: ["auto", "fill"] },
    }
}

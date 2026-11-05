import type { PaneGridProps } from "@starci/grammar/common"

/**
 * The arrangement (pane-grid.choose.frame grid): the status band across the top, under it the work (open tasks, then recent
 * turns) taking the rest of the width, and a standard column of the goals and the schedule, each with its Add command. On a
 * phone the same panes stack in that order.
 */
export const areasOf = (phoneView: "work" | "goals"): PaneGridProps["areas"] => ({
    base: phoneView === "work" ? ["status", "phonetabs", "main"] : ["status", "phonetabs", "aside"],
    medium: ["status status", "main aside"],
})
/** The columns: one on a phone, the work taking what is left beside a standard column on a laptop. */
export const COLUMNS: NonNullable<PaneGridProps["columns"]> = { base: ["fill"], medium: ["fill", "standard"] }
/** The rows: the status band, the phone tab line and the body take their height; on a laptop the body takes the rest. */
export const ROWS: NonNullable<PaneGridProps["rows"]> = {
    base: ["auto", "auto", "auto"],
    medium: ["auto", "fill"],
}

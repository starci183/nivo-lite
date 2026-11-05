import type { PaneGridLayout } from "@/modules/types"

/**
 * The arrangement (pane-grid.choose.frame grid) of the Work tab: the status band across the top, under it the work (open tasks,
 * then recent turns) taking the rest of the width beside a standard column of the goals and the schedule, each with its Add
 * command. On a phone the same panes stack in that order, and the phone tab picks the work or the goals.
 */
export const agentWorkGridOf = (phoneView: "work" | "goals"): PaneGridLayout => ({
    areas: {
        base: phoneView === "work" ? ["status", "phonetabs", "main"] : ["status", "phonetabs", "aside"],
        medium: ["status status", "main aside"],
    },
    columns: { base: ["fill"], medium: ["fill", "standard"] },
    rows: { base: ["auto", "auto", "auto"], medium: ["auto", "fill"] },
})

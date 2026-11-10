import type { PaneGridLayout } from "@/modules/types"

/**
 * The panes of the inbox, a workspace: the customers in a white column, the opened customer's cards on the well beside it and, at the
 * wide width, the facts of the customer in a white column (a drawer below it). A phone shows the list, or the opened customer alone.
 * With no customer open there is no side pane and no empty column: the well takes the rest.
 */
export const inboxGridOf = (phone: "list" | "main", hasDetail: boolean): PaneGridLayout => ({
    areas: {
        base: [phone === "main" ? "main" : "list"],
        medium: ["list main"],
        wide: [hasDetail ? "list main aside" : "list main"],
    },
    columns: { base: ["fill"], medium: ["wide", "fill"], wide: hasDetail ? ["wide", "fill", "standard"] : ["wide", "fill"] },
    rows: { base: ["fill"] },
})

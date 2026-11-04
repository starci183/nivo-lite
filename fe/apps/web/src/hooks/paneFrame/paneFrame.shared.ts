import type { PaneGridLayout } from "@/modules/types"

/** What decides the arrangement of a console page's panes. */
interface PaneGridInput {
    /** The page has a list pane (`listHead`, `list`). */
    readonly hasList: boolean
    /** The page has a side pane (`asideHead`, `aside`): a third column from the wide width, a drawer below it. */
    readonly hasAside: boolean
    /** The one pane a phone shows when there is a list. */
    readonly phone: "list" | "main"
}

/**
 * The areas and tracks every console page's pane grid shares. A phone shows one pane (`listHead`/`list` or `head`/`main`); from
 * 48rem the list sits beside the main pane at the wide rail width; from 70rem the side pane joins at the standard width. Every
 * pane is a head band over a body: `listHead`, `head`, `asideHead` over `list`, `main`, `aside`.
 */
export const paneGridOf = (input: PaneGridInput): PaneGridLayout => {
    const heads = [...(input.hasList ? ["listHead"] : []), "head", ...(input.hasAside ? ["asideHead"] : [])]
    const bodies = [...(input.hasList ? ["list"] : []), "main", ...(input.hasAside ? ["aside"] : [])]
    return {
        areas: {
            base: input.hasList && input.phone === "list" ? ["listHead", "list"] : ["head", "main"],
            medium: input.hasList ? ["listHead head", "list main"] : ["head", "main"],
            wide: [heads.join(" "), bodies.join(" ")],
        },
        columns: {
            base: ["fill"],
            medium: input.hasList ? ["wide", "fill"] : ["fill"],
            wide: [
                ...(input.hasList ? (["wide"] as const) : []),
                "fill",
                ...(input.hasAside ? (["standard"] as const) : []),
            ],
        },
        rows: { base: ["auto", "fill"], medium: ["auto", "fill"], wide: ["auto", "fill"] },
    }
}

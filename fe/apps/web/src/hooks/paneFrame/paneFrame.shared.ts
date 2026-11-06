import type { PaneGridLayout } from "@/modules/types"

/** What decides the arrangement of a console page's panes. */
interface PaneGridInput {
    /** The page has a list pane (`listHead`, `list`). */
    readonly hasList: boolean
    /** The page has a side pane (`asideHead`, `aside`): a third column from the wide width, a drawer below it. */
    readonly hasAside: boolean
    /** The one pane a phone shows when there is a list. */
    readonly phone: "list" | "main"
    /** The list column has a head band of its own (default). Without one the list runs the full height and the head band sits over the main column only. */
    readonly hasListHead?: boolean
}

/** The area that heads the list column: its own head band, or the list itself when it runs the full height. */
const listHeadOf = (hasList: boolean, hasListHead: boolean): ReadonlyArray<string> => {
    if (!hasList) return []
    return hasListHead ? ["listHead"] : ["list"]
}

/** What a phone shows: the list (with its head band when it has one), or the main pane with its head. */
const baseAreas = (input: PaneGridInput, hasListHead: boolean): ReadonlyArray<string> => {
    if (!input.hasList || input.phone === "main") return ["head", "main"]
    return hasListHead ? ["listHead", "list"] : ["list"]
}

/**
 * The areas and tracks every console page's pane grid shares. A phone shows one pane (`listHead`/`list` or `head`/`main`); from
 * 48rem the list sits beside the main pane at the wide rail width; from 70rem the side pane joins at the standard width. Every
 * pane is a head band over a body: `listHead`, `head`, `asideHead` over `list`, `main`, `aside`.
 */
export const paneGridOf = (input: PaneGridInput): PaneGridLayout => {
    const hasListHead = input.hasListHead !== false
    const listHead = listHeadOf(input.hasList, hasListHead)
    const heads = [...listHead, "head", ...(input.hasAside ? ["asideHead"] : [])]
    const bodies = [...(input.hasList ? ["list"] : []), "main", ...(input.hasAside ? ["aside"] : [])]
    return {
        areas: {
            base: baseAreas(input, hasListHead),
            medium: input.hasList ? [`${listHead[0]} head`, `list main`] : ["head", "main"],
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

/** What decides the arrangement of a chat surface: the rooms list beside the thread, or the thread alone (the panel of one agent). */
interface ChatGridInput {
    /** The surface has the list of rooms (`listHead`, `list`). */
    readonly hasList: boolean
    /** The one pane a phone shows when there is a list. */
    readonly phone: "list" | "main"
}

/**
 * The areas and tracks of a chat surface: a head band, the thread that scrolls and the composer pinned under it, beside the rooms
 * list from 48rem. A phone shows the list or the thread alone. Without a list the three areas stand in one column.
 */
export const chatGridOf = (input: ChatGridInput): PaneGridLayout => {
    const thread = ["head", "thread", "composer"]
    if (!input.hasList) {
        return {
            areas: { base: thread, medium: thread },
            columns: { base: ["fill"], medium: ["fill"] },
            rows: { base: ["auto", "fill", "auto"], medium: ["auto", "fill", "auto"] },
        }
    }
    const isListShown = input.phone === "list"
    return {
        areas: {
            base: isListShown ? ["listHead", "list"] : thread,
            medium: ["listHead head", "list thread", "list composer"],
        },
        columns: { base: ["fill"], medium: ["wide", "fill"] },
        rows: {
            base: isListShown ? ["auto", "fill"] : ["auto", "fill", "auto"],
            medium: ["auto", "fill", "auto"],
        },
    }
}

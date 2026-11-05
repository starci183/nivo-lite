import type { ChainPanelView, PaneGridLayout, ThreadFeedView, ThreadMessageView } from "@/modules/types"

/** What decides the arrangement of the threads page's panes. */
interface ThreadGridInput {
    /** The one screen a phone shows: the threads, or the opened one. */
    readonly phone: "list" | "main"
    /** The execution chain is docked as a third column from the wide width (else it is a drawer). */
    readonly isChainDocked: boolean
    /** A thread is open: its head, messages and composer exist. */
    readonly hasThread: boolean
}

/**
 * The areas and tracks of the threads page. A phone shows the threads or the opened thread (head, messages, composer); from
 * 48rem the threads sit beside the thread; from 70rem the execution chain joins as a docked column unless it was closed, and
 * below that width it is a drawer. A pane that is not in the areas of a width is hidden there (or a drawer).
 */
export const threadGridOf = (input: ThreadGridInput): PaneGridLayout => {
    const thread = input.hasThread
    const pair = thread ? ["listHead head", "list thread", "list composer"] : ["listHead head", "list thread"]
    const triple = thread
        ? ["listHead head asideHead", "list thread aside", "list composer aside"]
        : ["listHead head asideHead", "list thread aside"]
    const single = thread ? ["head", "thread", "composer"] : ["head", "thread"]
    const rows = thread ? (["auto", "fill", "auto"] as const) : (["auto", "fill"] as const)
    return {
        areas: {
            base: input.phone === "list" ? ["listHead", "list"] : single,
            medium: pair,
            wide: input.isChainDocked && thread ? triple : pair,
        },
        columns: {
            base: ["fill"],
            medium: ["standard", "fill"],
            wide: input.isChainDocked && thread ? ["standard", "fill", "standard"] : ["standard", "fill"],
        },
        rows: {
            base: input.phone === "list" ? ["auto", "fill"] : rows,
            medium: rows,
            wide: rows,
        },
    }
}

/** One waiting bubble: the skeleton of a message keeps the geometry of the ready thread. */
const WAITING_MESSAGE: ThreadMessageView = {
    id: "waiting",
    authorName: "",
    isAgent: false,
    isOwn: false,
    glyph: null,
    avatarUrl: null,
    time: "",
    segments: [{ kind: "text", offset: 0, text: "" }],
    quoted: [],
    approval: null,
}

/** The open thread before its messages are in: two waiting bubbles. */
export const THREAD_FEED_SKELETON: ThreadFeedView = {
    title: "",
    subtitle: "",
    pendingCount: 0,
    messages: [WAITING_MESSAGE, { ...WAITING_MESSAGE, id: "waiting-2" }],
}

/** The execution chain before its steps are in. */
export const THREAD_CHAIN_SKELETON: ChainPanelView = {
    summaryLine: "-",
    stateLine: "-",
    stateTone: "neutral",
    steps: [],
    isComplete: false,
}

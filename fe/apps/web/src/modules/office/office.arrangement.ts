import type { Arrangement } from "@/modules/types"

/** The frame state an arrangement depends on. */
interface ArrangementFrame {
    readonly phoneView: "list" | "thread"
    readonly centre: "chat" | "tasks"
    readonly isInfoOpen: boolean
    readonly isCompact: boolean
}

/** One column, the conversation list on its own screen (a phone before a room is opened). */
const LIST_SCREEN: Arrangement = { areas: ["listHead", "list"], columns: ["fill"], rows: ["auto", "fill"] }

/** One column: header, thread and composer (the info column is a drawer here). */
const SINGLE_CHAT: Arrangement = {
    areas: ["head", "thread", "composer"],
    columns: ["fill"],
    rows: ["auto", "fill", "auto"],
}

/** The tasks view has no composer. */
const SINGLE_TASKS: Arrangement = { areas: ["head", "thread"], columns: ["fill"], rows: ["auto", "fill"] }

/** List and Office side by side. */
const PAIR_CHAT: Arrangement = {
    areas: ["listHead head", "list thread", "list composer"],
    columns: ["standard", "fill"],
    rows: ["auto", "fill", "auto"],
}

const PAIR_TASKS: Arrangement = {
    areas: ["listHead head", "list thread"],
    columns: ["standard", "fill"],
    rows: ["auto", "fill"],
}

/** List, Office and group info side by side. */
const TRIPLE_CHAT: Arrangement = {
    areas: ["listHead head infoHead", "list thread info", "list composer info"],
    columns: ["standard", "fill", "standard"],
    rows: ["auto", "fill", "auto"],
}

const TRIPLE_TASKS: Arrangement = {
    areas: ["listHead head infoHead", "list thread info"],
    columns: ["standard", "fill", "standard"],
    rows: ["auto", "fill"],
}

/** The arrangement for the frame: the screen a phone shows, the centre view and the info column. */
export const arrangementOf = (view: ArrangementFrame): Arrangement => {
    const isTasks = view.centre === "tasks"
    if (view.isCompact) {
        if (view.phoneView === "list") return LIST_SCREEN
        return isTasks ? SINGLE_TASKS : SINGLE_CHAT
    }
    if (view.isInfoOpen) return isTasks ? TRIPLE_TASKS : TRIPLE_CHAT
    return isTasks ? PAIR_TASKS : PAIR_CHAT
}

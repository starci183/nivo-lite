/** Whole workbench: alerts above a three-pane inbox. */
export const WORKBENCH_CLASS_NAME = "flex min-w-0 flex-col gap-4"

/** The three panes, filling the joined card that FillViewport sizes. */
export const INBOX_CLASS_NAME = "relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden"

/** Conversation list pane. */
const LIST_PANE_CLASS_NAME = "w-full min-w-0 shrink-0 flex-col md:w-80"
/** The list pane while it is the open pane. */
export const LIST_PANE_OPEN_CLASS_NAME = `${LIST_PANE_CLASS_NAME} flex`
/** The list pane when only wide screens show it beside the thread. */
export const LIST_PANE_WIDE_ONLY_CLASS_NAME = `${LIST_PANE_CLASS_NAME} hidden md:flex`

/** Thread pane. */
const THREAD_PANE_CLASS_NAME = "min-w-0 flex-1 flex-col"
/** The thread pane while it is the open pane. */
export const THREAD_PANE_OPEN_CLASS_NAME = `${THREAD_PANE_CLASS_NAME} flex`
/** The thread pane when only wide screens show it beside the list. */
export const THREAD_PANE_WIDE_ONLY_CLASS_NAME = `${THREAD_PANE_CLASS_NAME} hidden md:flex`

/** Customer pane: an overlay on narrow screens, a docked column from xl. */
const SIDE_PANE_CLASS_NAME =
    "absolute inset-0 z-20 flex-col overflow-y-auto sm:left-auto sm:w-80 xl:static xl:z-auto xl:w-80 xl:shrink-0"
/** The customer pane while the member opened it. */
export const SIDE_PANE_OPEN_CLASS_NAME = `${SIDE_PANE_CLASS_NAME} flex`
/** The customer pane when it is only shown docked beside the thread. */
export const SIDE_PANE_DOCKED_ONLY_CLASS_NAME = `${SIDE_PANE_CLASS_NAME} hidden xl:flex`

/** A centred empty region filling its pane. */
export const CENTER_CLASS_NAME = "flex flex-1 items-center justify-center p-6"

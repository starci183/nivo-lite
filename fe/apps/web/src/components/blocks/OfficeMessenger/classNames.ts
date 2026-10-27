/** The columns inside the one joined surface: they touch, with no gap; each column pads its own content rows, never a separator. */
export const BODY_CLASS_NAME = "flex h-full min-h-0 min-w-0"

/** The left column: full width on phones, a fixed width beside the thread from md; it owns the panel content edge. */
export const LIST_COLUMN_CLASS_NAME = "flex w-full min-w-0 shrink-0 flex-col md:w-72 xl:w-80"

/** The left column while the thread shows on a phone. */
export const LIST_COLUMN_HIDDEN_CLASS_NAME = "hidden w-full min-w-0 shrink-0 flex-col md:flex md:w-72 xl:w-80"

/** The centre column: header, thread, composer. */
export const THREAD_COLUMN_CLASS_NAME = "flex min-w-0 flex-1 flex-col"

/** The centre column while the list shows on a phone. */
export const THREAD_COLUMN_HIDDEN_CLASS_NAME = "hidden min-w-0 flex-1 flex-col md:flex"

/** The docked info column on wide screens. */
export const INFO_COLUMN_CLASS_NAME = "flex w-72 shrink-0 flex-col 2xl:w-80"

/** The tasks view scrolls in the centre column. */
export const TASKS_CLASS_NAME = "min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"

/** The vertical hairline between two columns, from md up; on a phone only one column shows. */
export const DIVIDER_CLASS_NAME = "hidden shrink-0 md:flex"

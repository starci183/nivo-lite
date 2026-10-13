/** Blocks inside the card. */
export const STACK = "flex min-w-0 flex-col gap-3"

/** Gates: one separator between rows, none at the edges. */
export const GATE_LIST = "divide-y divide-separator"

/** One gate. */
export const GATE = "flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0"

/** The name of a gate with its status. */
export const GATE_HEAD = "flex flex-wrap items-center justify-between gap-2"

/** The actions of a gate. */
export const GATE_ACTIONS = "flex flex-wrap items-center gap-2"

/** Evidence keeps the line breaks of the owner; long words wrap. */
export const EVIDENCE = "whitespace-pre-wrap break-words"

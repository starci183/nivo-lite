/** Avatar column, also the spacer for grouped rows. */
export const AVATAR_SLOT_CLASS_NAME = "flex w-8 shrink-0 justify-center self-start sm:w-10"

/** System notice: a centred line. */
export const NOTICE_CLASS_NAME = "flex flex-wrap items-center justify-center gap-2 py-2 text-center"

/** The first row of an author group gets air above it. */
export const ROW_FIRST_CLASS_NAME = "mt-3"

const ACTIONS_FLOAT =
    "[&_.starci-core-chat-bubble-actions]:absolute [&_.starci-core-chat-bubble-actions]:top-full [&_.starci-core-chat-bubble-actions]:z-10 [&_.starci-core-chat-bubble-actions]:pt-1"

/**
 * The hover actions take no height: grammar keeps their row in the flow at opacity 0, which put about 40px between two short
 * bubbles, so they float under their bubble (the stack is the anchor) and only cover the next row while hovered.
 * Incoming bubble: the actions line up with its left edge.
 */
const ROW_START_CLASS_NAME = `${ACTIONS_FLOAT} [&_.starci-core-chat-bubble-actions]:left-0`

/** Outgoing bubble: the floating actions line up with its right edge. */
const ROW_END_CLASS_NAME = `${ACTIONS_FLOAT} [&_.starci-core-chat-bubble-actions]:right-0`

/** The first incoming row of an author group: air above, floating actions. */
const ROW_FIRST_START_CLASS_NAME = `${ROW_FIRST_CLASS_NAME} ${ROW_START_CLASS_NAME}`

/** The first outgoing row of an author group: air above, floating actions. */
const ROW_FIRST_END_CLASS_NAME = `${ROW_FIRST_CLASS_NAME} ${ROW_END_CLASS_NAME}`

/** The wrapper class of one bubble row: its side, and air above it unless it continues an author group. */
export const rowClassNameOf = (isOutgoing: boolean, isContinuation: boolean): string => {
    if (isContinuation) return isOutgoing ? ROW_END_CLASS_NAME : ROW_START_CLASS_NAME
    return isOutgoing ? ROW_FIRST_END_CLASS_NAME : ROW_FIRST_START_CLASS_NAME
}

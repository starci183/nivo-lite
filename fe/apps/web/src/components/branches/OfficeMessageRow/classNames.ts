/** Avatar column, also the spacer for grouped rows. */
export const AVATAR_SLOT_CLASS_NAME = "flex w-8 shrink-0 justify-center self-start sm:w-10"

/** System notice: a centred line. */
export const NOTICE_CLASS_NAME = "flex flex-wrap items-center justify-center gap-2 py-2 text-center"

/** The first row of an author group gets air above it. */
export const ROW_FIRST_CLASS_NAME = "mt-3"

/** The wrapper class of one bubble row: air above it unless it continues an author group. The bubble's hover actions are Grammar's. */
export const rowClassNameOf = (_isOutgoing: boolean, isContinuation: boolean): string =>
    isContinuation ? "" : ROW_FIRST_CLASS_NAME

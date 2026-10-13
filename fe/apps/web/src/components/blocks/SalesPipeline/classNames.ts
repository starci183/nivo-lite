/** The board: five stage lanes side by side; the scroll region owns the sideways overflow. */
export const BOARD_CLASS_NAME = "flex min-w-full gap-3 pb-2"

/** One lane column: a fixed 16rem track on narrow screens, an equal share on wide ones. */
export const LANE_CLASS_NAME = "flex w-64 shrink-0 flex-col lg:w-auto lg:min-w-0 lg:flex-1"

/** A deal row inside a lane. */
export const DEAL_ROW_CLASS_NAME = "flex min-w-0 flex-col gap-2 border-b border-separator px-4 py-3 last:border-b-0"

/** Chips and facts on one wrapping line. */
export const CHIPS_CLASS_NAME = "flex flex-wrap items-center gap-x-2 gap-y-1"

/** The command under a deal. */
export const ROW_ACTIONS_CLASS_NAME = "flex flex-wrap items-center gap-2"

/** Stacked form fields inside the dialog. */
export const FORM_CLASS_NAME = "flex flex-col gap-3"

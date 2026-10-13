const CHIP = "flex min-w-0 cursor-grab flex-col gap-1 active:cursor-grabbing"

/** The draggable frame of a chip: the time line above the button (GAP-1); a skipped post is dimmed. */
export const chipClassName = (isSkipped: boolean): string => (isSkipped ? `${CHIP} opacity-50` : CHIP)

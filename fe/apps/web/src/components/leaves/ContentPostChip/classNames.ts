const CHIP = "min-w-0 cursor-grab active:cursor-grabbing"

/** The draggable frame of a chip: the time line above the button; a skipped post is dimmed. */
export const chipClassName = (isSkipped: boolean): string => (isSkipped ? `${CHIP} opacity-50` : CHIP)

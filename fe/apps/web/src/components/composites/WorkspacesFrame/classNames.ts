import { cn } from "@heroui/react"

/** Space above and below the logo row (PADDING-9: the block inset the shell does not own). */
export const HEADER_CLASS_NAME = cn("py-6", "sm:py-8")

/** Page content under the logo row (PADDING-9 block inset). */
export const FRAME_CLASS_NAME = cn("flex", "flex-col", "pb-6", "sm:pb-8")

/** Logo beside the language switch (GAP-4). */
export const TOP_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-4")

/** Language switch beside the account menu (GAP-3). */
export const TOP_END_CLASS_NAME = cn("flex", "items-center", "gap-3")

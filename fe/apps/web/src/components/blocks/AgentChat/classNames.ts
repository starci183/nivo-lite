import { cn } from "@heroui/react"

/** Columns inside the chat SurfaceCard (the card owns face, radius, clip and elevation: SURFACE-2, BOUNDARY-6). */
export const FRAME_CLASS_NAME = cn("flex", "h-full", "min-h-0", "min-w-0")
export const LIST_COLUMN_CLASS_NAME = cn(
    "flex",
    "min-h-0",
    "w-72",
    "shrink-0",
    "flex-col",
    "border-e",
    "border-separator",
    "bg-surface-secondary",
    "max-lg:hidden",
)
export const LIST_COLUMN_OPEN_CLASS_NAME = cn(
    "flex",
    "min-h-0",
    "w-full",
    "flex-col",
    "bg-surface-secondary",
    "lg:hidden",
)
export const LIST_HEAD_CLASS_NAME = cn(
    "flex",
    "items-center",
    "justify-between",
    "gap-2",
    "border-b",
    "border-separator",
    "p-3",
)
export const LIST_SCROLL_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-1", "overflow-y-auto", "p-2")
export const MAIN_CLASS_NAME = cn("flex", "min-h-0", "min-w-0", "flex-1", "flex-col", "max-lg:data-[list=open]:hidden")
export const HEADER_CLASS_NAME = cn(
    "flex",
    "min-w-0",
    "items-center",
    "gap-3",
    "border-b",
    "border-separator",
    "px-3",
    "py-3",
)
export const HEADER_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col")
export const HEADER_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "items-center", "gap-2")
export const CHANNEL_BAR_CLASS_NAME = cn("border-b", "border-separator", "px-3")
/** Thread scroll region on the card face (SURFACE-1: no own fill). */
export const THREAD_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-3", "overflow-y-auto", "p-4")
export const NOTICE_ROW_CLASS_NAME = cn("flex", "min-w-0", "justify-center")
export const EMPTY_CLASS_NAME = cn(
    "m-auto",
    "flex",
    "max-w-md",
    "flex-col",
    "items-center",
    "gap-3",
    "py-6",
    "text-center",
)
export const EMPTY_CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "justify-center", "gap-2")
export const EMPTY_FIELD_CLASS_NAME = cn("w-full", "text-start")
export const STEP_LIST_CLASS_NAME = cn("flex", "w-full", "flex-col", "gap-2", "text-start")
export const STEP_ROW_CLASS_NAME = cn("flex", "items-start", "gap-3")
/** Composer: the card's closing band with one leading seam (BOUNDARY-1 case-3). */
export const COMPOSER_CLASS_NAME = cn(
    "flex",
    "shrink-0",
    "flex-col",
    "gap-2",
    "border-t",
    "border-separator",
    "px-4",
    "pt-3",
    "pb-4",
)
export const CHIPS_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-2", "overflow-x-auto")
export const COMPOSER_ROW_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-2")
/** The message field grows (the Grammar Textarea owns its face). */
export const COMPOSER_INPUT_CLASS_NAME = cn("min-w-0", "flex-1")
export const BACK_CLASS_NAME = cn("max-sm:hidden")

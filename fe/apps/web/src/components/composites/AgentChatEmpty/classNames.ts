import { cn } from "@heroui/react"

/** The centred greeting of an empty chat. */
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
/** The wrapping row of prompts in the greeting. */
export const EMPTY_CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "justify-center", "gap-2")
/** The visitor name field in the greeting. */
export const EMPTY_FIELD_CLASS_NAME = cn("w-full", "text-start")
/** The list of next steps in the greeting. */
export const STEP_LIST_CLASS_NAME = cn("flex", "w-full", "flex-col", "gap-2", "text-start")
/** One next step: its number and its words. */
export const STEP_ROW_CLASS_NAME = cn("flex", "items-start", "gap-3")

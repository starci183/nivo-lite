import { cn } from "@heroui/react"

/** The payment step is one centered column of peer sections. */
export const STACK_CLASS_NAME = cn("flex", "w-full", "max-w-3xl", "flex-col", "gap-6")
/** Content within a payment outcome card. */
export const CENTERED_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-4", "text-center")
/** Actions belonging to one payment outcome. */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3")
/** The decorative image stays small beside the outcome copy. */
export const MASCOT_CLASS_NAME = cn("w-40")

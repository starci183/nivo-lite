import { cn } from "@heroui/react"

/** The step track above the step body (GAP-6). */
export const STEP_CLASS_NAME = cn("flex", "flex-col", "gap-6")
/** The form card beside the step mascot; the mascot drops below the form on a narrow screen and never covers a field or action (GAP-6). */
export const STEP_BODY_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-6", "lg:flex-row", "lg:items-start", "[&>*:first-child]:min-w-0", "[&>*:first-child]:flex-1")

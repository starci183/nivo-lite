import { cn } from "@heroui/react"

/** Stack inside the card (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** The choice of agent and of audience side by side on desktop (GAP-4). */
export const CHOICES_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")

/** The agent the question is asked as: its avatar beside its name and role (GAP-2). */
export const IDENTITY_CLASS_NAME = cn("flex", "items-center", "gap-3")

/** The name and the role of the agent stack and may shrink (GAP-1). */
export const IDENTITY_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col")

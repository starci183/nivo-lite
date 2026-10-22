import { cn } from "@heroui/react"

/** The card's stack: title, rule, who decides, people, buttons. */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** One line with the policy on the left and the clock on the right. */
export const FACTS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")
/** The people tagged, one per row. */
export const PEOPLE_CLASS_NAME = cn("flex", "flex-col", "gap-2")
/** One person: name and role on the left, the vote on the right. */
export const PERSON_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-3")
/** The two decision buttons side by side. */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

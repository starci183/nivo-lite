import { cn } from "@heroui/react"

/** Department group inside the rule list. */
export const GROUP_CLASS = cn("flex", "flex-col", "gap-2")

/** One rule row: action, mode, limit. */
export const RULE_ROW_CLASS = cn(
    "grid",
    "grid-cols-1",
    "items-end",
    "gap-3",
    "py-3",
    "first:pt-0",
    "last:pb-0",
    "md:grid-cols-[1fr_auto_14rem]",
)

/** Action name column of a rule row. */
export const RULE_NAME_CLASS = cn("flex", "min-w-0", "flex-col", "gap-1")

/** Limit cell of a rule row. */
export const RULE_LIMIT_CLASS = cn("w-full")

/** Rule rows list: one hairline between rows, none at the edges. */
export const RULE_LIST_CLASS = cn("flex", "flex-col", "divide-y", "divide-separator")

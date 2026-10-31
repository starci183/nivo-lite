import { cn } from "@heroui/react"

/** One rule row: action, mode, limit. */
export const RULE_ROW_CLASS = cn("grid", "grid-cols-1", "items-end", "gap-3", "md:grid-cols-[1fr_auto_14rem]")

/** Limit cell of a rule row. */
export const RULE_LIMIT_CLASS = cn("w-full")

import { cn } from "@heroui/react"

/** Vertical rhythm between the header, motto and sections. */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")

/** Stack of fields inside a section. */
export const FIELDS_CLASS = cn("flex", "flex-col", "gap-4")

/** Two-column grid of short fields, one column on phones. */
export const GRID_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")

/** Three-column grid for the three goal numbers. */
export const GOALS_GRID_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-3")

/** Save row at the end of a section. */
export const SAVE_ROW_CLASS = cn("flex", "flex-wrap", "items-center", "justify-end", "gap-3")

/** Department group inside the rule list. */
export const GROUP_CLASS = cn("flex", "flex-col", "gap-2")

/** One rule row: action, mode, limit. */
export const RULE_ROW_CLASS = cn("grid", "grid-cols-1", "items-end", "gap-3", "border-t", "border-separator", "py-3", "md:grid-cols-[minmax(0,1fr)_auto_14rem]")

/** Action name column of a rule row. */
export const RULE_NAME_CLASS = cn("flex", "min-w-0", "flex-col", "gap-1")

/** Limit cell of a rule row. */
export const RULE_LIMIT_CLASS = cn("w-full")

/** Rule rows list. */
export const RULE_LIST_CLASS = cn("flex", "flex-col")

/** Required-field group row. */
export const REQUIRED_ROW_CLASS = cn("border-t", "border-separator", "py-3")

/** One staff row. */
export const STAFF_ROW_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3", "border-t", "border-separator", "py-3")

/** Staff name + meta column. */
export const STAFF_BODY_CLASS = cn("flex", "min-w-0", "flex-col", "gap-1")

/** Staff badge + action cluster. */
export const STAFF_ACTIONS_CLASS = cn("flex", "items-center", "gap-3")

/** Add-staff form grid. */
export const STAFF_FORM_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-3")

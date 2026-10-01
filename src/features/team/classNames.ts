import { cn } from "@heroui/react"

/** Vertical rhythm between header, members, invitations and the invite form. */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")

/** Stack inside a card. */
export const STACK_CLASS = cn("flex", "flex-col", "gap-4")

/** One member / invite row: identity left, facts and actions right; wraps on phones. */
export const ROW_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-3", "border-t", "border-separator", "py-3", "first:border-t-0")

/** Avatar + name + email column. */
export const IDENTITY_CLASS = cn("flex", "min-w-0", "flex-1", "basis-64", "items-center", "gap-3")

/** Name / email text stack. */
export const IDENTITY_TEXT_CLASS = cn("flex", "min-w-0", "flex-col", "gap-0.5")

/** Name line (name + "You" chip). */
export const NAME_LINE_CLASS = cn("flex", "min-w-0", "items-center", "gap-2")

/** Role, status and last sign-in cluster. */
export const FACTS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-5", "gap-y-2")

/** One labelled fact (small caption over a value). */
export const FACT_CLASS = cn("flex", "min-w-28", "flex-col", "gap-0.5")

/** Column heading row, hidden on phones. */
export const HEAD_ROW_CLASS = cn("hidden", "items-center", "gap-4", "pb-2", "md:flex")

/** Buttons at the end of a row. */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Inline confirmation under a row. */
export const CONFIRM_CLASS = cn("flex", "w-full", "flex-col", "gap-3", "rounded-lg", "bg-surface-secondary", "p-3")

/** Invite form grid: two columns on desktop. */
export const FORM_GRID_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")

/** Copyable link box. */
export const LINK_BOX_CLASS = cn("flex", "flex-col", "gap-2", "rounded-lg", "bg-surface-secondary", "p-3")

/** The link text itself: selectable, wraps anywhere. */
export const LINK_TEXT_CLASS = cn("break-all", "font-mono", "text-sm", "select-all")

/** Right-aligned form footer. */
export const FOOTER_CLASS = cn("flex", "flex-wrap", "items-center", "justify-end", "gap-3")

/** Public invitation page canvas. */
export const INVITE_CANVAS_CLASS = cn("flex", "min-h-dvh", "items-center", "justify-center", "bg-background", "px-4", "py-10")

/** Public invitation card width. */
export const INVITE_CARD_CLASS = cn("flex", "w-full", "max-w-md", "flex-col", "gap-5")

/** Invitation page action stack. */
export const INVITE_ACTIONS_CLASS = cn("flex", "flex-col", "gap-3")

/** The invitation card surface (plain section: grammar SurfaceCard is client-only). */
export const CARD_CLASS = cn("flex", "flex-col", "gap-4", "rounded-2xl", "border", "border-separator", "bg-surface", "p-6", "shadow-sm")

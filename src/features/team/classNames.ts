import { cn } from "@heroui/react"

/** Vertical rhythm between header, members, invitations and the invite form (GAP-5: page regions). */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")

/** A named section: its SectionHeader, notices and the collection (GAP-4). */
export const SECTION_CLASS = cn("flex", "flex-col", "gap-4")

/** Stack inside a card (GAP-4). */
export const STACK_CLASS = cn("flex", "flex-col", "gap-4")

/** One invite row of the SurfaceListCard: trailing seam dropped on the last row (BOUNDARY-2 case-1), row inset PADDING-4 inline / PADDING-3 block; identity, facts and actions wrap on phones. */
export const ROW_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0")

/** Avatar + name + email column (GAP-3). */
export const IDENTITY_CLASS = cn("flex", "min-w-0", "flex-1", "basis-64", "items-center", "gap-3")

/** Name / email lines of one identity (GAP-1). */
export const IDENTITY_TEXT_CLASS = cn("flex", "min-w-0", "flex-col", "gap-1")

/** Name line (name + "You" badge, GAP-2). */
export const NAME_LINE_CLASS = cn("flex", "min-w-0", "items-center", "gap-2")

/** Role badge cluster (GAP-2 case-4). */
export const FACTS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Buttons at the end of a row (GAP-2 case-3). */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")

/** A freshly issued invite link under its row: the read-only copyable Input and its note (GAP-2). */
export const LINK_BOX_CLASS = cn("flex", "w-full", "flex-col", "gap-2")

/** Invite form grid: two columns on desktop (GAP-4). */
export const FORM_GRID_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")

/** Right-aligned form footer (GAP-3). */
export const FOOTER_CLASS = cn("flex", "flex-wrap", "items-center", "justify-end", "gap-3")

/** Accept-invitation action stack on the public invite page (GAP-3). */
export const INVITE_ACTIONS_CLASS = cn("flex", "flex-col", "gap-3")

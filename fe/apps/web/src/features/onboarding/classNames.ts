import { cn } from "@heroui/react"

/* Page frame (outside the console shell). PageContainer owns the inline page inset; the routed block owns only its block inset (PADDING-9). */
export const SHELL_CLASS_NAME = cn("min-h-dvh", "py-6", "sm:py-8")
/** Logo row above the page content (GAP-6: the named transition between chrome and content). */
export const FRAME_CLASS_NAME = cn("flex", "flex-col", "gap-8")
/** Logo beside the language switch (GAP-4). */
export const TOP_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-4")
/** Page regions (GAP-5). */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-6")
/** Blocks inside one card or section (GAP-4). */
export const STACK_MD_CLASS_NAME = cn("flex", "flex-col", "gap-4")
/** Lines of one entry (GAP-1). */
export const COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")
/** Button row (GAP-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3")
/** Badges row (GAP-2 case-4). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")
/** Two peer sections side by side on wide screens (GAP-5). */
export const GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-6", "lg:grid-cols-2")

/* Plan choice (RadioGroup option content). */
/** Plan name beside the recommended badge (GAP-2). */
export const PLAN_LABEL_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")
/** Seats, price and features of one plan (GAP-2). */
export const PLAN_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-2")
/** Price figure beside its period (GAP-1). */
export const PRICE_CLASS_NAME = cn("flex", "flex-wrap", "items-baseline", "gap-1")
/** Feature lines (GAP-2); List owns the reset. */
export const FEATURES_CLASS_NAME = cn("flex", "flex-col", "gap-2")

/* Workspace cards. */
/** Workspace cards: one collection of peer cards in a grid (GAP-4 case-2); List owns the reset. */
export const WS_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")
/** Content of one workspace card (GAP-4). */
export const WS_CARD_CLASS_NAME = cn("flex", "flex-col", "gap-4")
/** Workspace mark beside its name and meta (GAP-4). */
export const WS_HEAD_CLASS_NAME = cn("flex", "items-center", "gap-4")
/** One invite row of the SurfaceListCard: trailing seam dropped on the last row (BOUNDARY-2 case-1), row inset PADDING-4 / PADDING-3. */
export const INVITE_ROW_CLASS_NAME = cn(
    "flex",
    "flex-col",
    "gap-3",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)

/* Empty and settled states. */
/** A settled state centred inside its card (GAP-4). */
export const CENTERED_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-4", "text-center")
/** Width of a decorative mascot inside a plain MediaFrame. */
export const MASCOT_CLASS_NAME = cn("w-40")

/* Payment. */
/** Payment column (GAP-5). */
export const CENTER_CLASS_NAME = cn("flex", "w-full", "max-w-3xl", "flex-col", "gap-6")
/** QR column beside the transfer details (GAP-5); the details take two of three tracks at md. */
export const PAY_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-6", "md:grid-cols-3")
/** Transfer details column. */
export const PAY_DETAILS_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "md:col-span-2")
/** QR code, its title and the countdown (GAP-4). */
export const QR_WRAP_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-4")
/** Width of the QR MediaFrame. */
export const QR_CLASS_NAME = cn("w-full", "max-w-64")
/** Countdown ring beside its reading (GAP-3). */
export const COUNTDOWN_CLASS_NAME = cn("flex", "items-center", "gap-3")

/* Workspace switcher. */
/** Switcher entries, a compact navigation list (GAP-1 as Sidebar's list); List owns the reset. */
export const SWITCH_CLASS_NAME = cn("flex", "flex-col", "gap-1")

/* Workspaces home. */
/** Welcome card: copy column beside the art band from md, stacked on mobile (GAP-5). */
export const WELCOME_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "md:grid-cols-5")
/** Copy column of the welcome card (GAP-4). */
export const WELCOME_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "items-start", "gap-4", "p-4", "md:col-span-3")
/** SURFACE-6 case-1: the decorative hero band at full accent strength; it carries one aria-hidden image and no copy. This is the page's only brand signature moment (DISCIPLINE-3). */
export const WELCOME_ART_CLASS_NAME =
    "relative isolate order-first h-40 overflow-hidden bg-accent md:order-none md:col-span-2 md:h-auto"
/** A square frame as tall as the band, centred: the square mascot fits the band whatever its height. */
export const WELCOME_IMAGE_CLASS_NAME = cn(
    "absolute",
    "inset-y-0",
    "left-1/2",
    "aspect-square",
    "h-full",
    "-translate-x-1/2",
)
/** Invite link input beside its button; stacked on mobile (GAP-3). */
export const LINK_ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3", "sm:flex-row", "sm:items-end")
/** The input takes the remaining width of the link row. */
export const LINK_FIELD_CLASS_NAME = cn("min-w-0", "flex-1")
/** Account menu trigger: the email names the button; phones show only the avatar (the email stays for screen readers), wider screens truncate it. */
export const ACCOUNT_EMAIL_CLASS_NAME = cn("sr-only", "sm:not-sr-only", "sm:max-w-56")
/** Locale switch beside the account menu (GAP-3). */
export const TOP_END_CLASS_NAME = cn("flex", "items-center", "gap-3")
/** Join card, first band (no invites): outer edge on top and sides, a separator below (PADDING-4 / PADDING-3). */
export const JOIN_EMPTY_BAND_CLASS_NAME = cn("px-4", "pb-3", "pt-4")
/** Join card, last band (invite link form): a separator above, outer edge on the other sides (PADDING-3 / PADDING-4). */
export const JOIN_LINK_BAND_CLASS_NAME = cn("px-4", "pb-4", "pt-3")

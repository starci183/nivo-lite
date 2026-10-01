import { cn } from "@heroui/react";

/** Whole console: rail + column on desktop, column + bottom tabs on phones; it owns the viewport height. */
export const ROOT_CLASS_NAME = cn("flex", "h-dvh", "flex-col", "overflow-hidden", "bg-background", "md:flex-row");
/** Right-hand column: top bar, optional strip, then the page area. */
export const COLUMN_CLASS_NAME = cn("flex", "min-h-0", "min-w-0", "flex-1", "flex-col");
/**
 * The page area. A flex column with min-h-0 so a child (Office chat) can take `flex-1 min-h-0` and fill the
 * viewport with its own pinned composer; ordinary pages simply scroll here.
 */
export const MAIN_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "overflow-y-auto");

/** Left rail on desktop, bottom tab bar on phones (Zalo pattern). */
export const RAIL_CLASS_NAME = cn(
  "order-last",
  "flex",
  "shrink-0",
  "flex-row",
  "items-stretch",
  "gap-1",
  "border-t",
  "border-separator",
  "bg-surface",
  "px-2",
  "py-1",
  "md:order-first",
  "md:w-24",
  "md:flex-col",
  "md:items-center",
  "md:gap-2",
  "md:border-r",
  "md:border-t-0",
  "md:px-1",
  "md:py-4",
);
/** Layout classes: rail logo. */
export const RAIL_LOGO_CLASS_NAME = cn("hidden", "pb-2", "md:block");
/** Layout classes: rail nav. */
export const RAIL_NAV_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-row", "gap-1", "overflow-x-auto", "md:overflow-visible", "md:w-full", "md:flex-none", "md:flex-col", "md:gap-2");
/** Layout classes: rail spacer. */
export const RAIL_SPACER_CLASS_NAME = cn("hidden", "md:block", "md:flex-1");
/** Layout classes: rail user. */
export const RAIL_USER_CLASS_NAME = cn("hidden", "md:block");
/** Layout classes: rail item. */
export const RAIL_ITEM_CLASS_NAME = cn(
  "relative",
  "flex",
  "min-h-12",
  "min-w-16",
  "flex-1",
  "flex-col",
  "items-center",
  "justify-center",
  "gap-1",
  "rounded-xl",
  "px-0",
  "py-2",
  "no-underline",
  "hover:bg-surface-secondary",
  "focus-visible:outline-2",
  "focus-visible:outline-focus",
  "md:w-full",
  "md:min-w-0",
  "md:flex-none",
);
/** Layout classes: rail item active. */
export const RAIL_ITEM_ACTIVE_CLASS_NAME = cn("bg-accent-soft");
/** Layout classes: rail glyph. */
export const RAIL_GLYPH_CLASS_NAME = cn("relative", "flex", "items-center", "justify-center");
/** Layout classes: rail glyph accent. */
export const RAIL_GLYPH_ACCENT_CLASS_NAME = cn("size-8", "rounded-xl", "bg-accent", "md:size-10", "text-accent-foreground");
/** Layout classes: rail glyph muted. */
export const RAIL_GLYPH_MUTED_CLASS_NAME = cn("size-6", "text-muted");
/** Layout classes: rail glyph active. */
export const RAIL_GLYPH_ACTIVE_CLASS_NAME = cn("size-6", "text-foreground");
/** Layout classes: rail badge. */
export const RAIL_BADGE_CLASS_NAME = cn("pointer-events-none", "absolute", "-right-3", "-top-2");
/** Layout classes: rail label. */
export const RAIL_LABEL_CLASS_NAME = cn("max-w-full", "truncate", "text-center", "md:overflow-visible", "md:whitespace-normal", "md:leading-tight");

/** Light top bar. */
export const TOPBAR_CLASS_NAME = cn(
  "flex",
  "h-14",
  "shrink-0",
  "items-center",
  "gap-3",
  "border-b",
  "border-separator",
  "bg-surface",
  "px-4",
  "md:px-6",
);
/** Layout classes: topbar identity. */
export const TOPBAR_IDENTITY_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-3");
/** Layout classes: topbar mark. */
export const TOPBAR_MARK_CLASS_NAME = cn("md:hidden");
/** Layout classes: workspace name. */
export const WORKSPACE_NAME_CLASS_NAME = cn("hidden", "min-w-0", "sm:block");
/** Layout classes: badge. */
export const BADGE_CLASS_NAME = cn("hidden", "sm:block");
/** Layout classes: topbar search. */
export const TOPBAR_SEARCH_CLASS_NAME = cn("mx-auto", "hidden", "w-full", "max-w-md", "lg:block");
/** Layout classes: topbar spacer. */
export const TOPBAR_SPACER_CLASS_NAME = cn("flex-1", "lg:hidden");
/** Layout classes: actions. */
export const ACTIONS_CLASS_NAME = cn("ml-auto", "flex", "items-center", "gap-2");
/** Layout classes: new label. */
export const NEW_LABEL_CLASS_NAME = cn("hidden", "sm:inline");
/** Layout classes: new plus. */
export const NEW_PLUS_CLASS_NAME = cn("sm:hidden");
/** Layout classes: topbar user. */
export const TOPBAR_USER_CLASS_NAME = cn("md:hidden");

/** Layout classes: bell wrap. */
export const BELL_WRAP_CLASS_NAME = cn("relative", "flex", "items-center");
/** Layout classes: bell count. */
export const BELL_COUNT_CLASS_NAME = cn("pointer-events-none", "absolute", "-right-1", "-top-1");
/** Layout classes: notify panel. */
export const NOTIFY_PANEL_CLASS_NAME = cn("flex", "w-72", "flex-col", "gap-2");
/** Layout classes: notify list. */
export const NOTIFY_LIST_CLASS_NAME = cn("flex", "flex-col");
/** Layout classes: notify item. */
export const NOTIFY_ITEM_CLASS_NAME = cn(
  "flex",
  "flex-col",
  "gap-1",
  "rounded-lg",
  "px-2",
  "py-2",
  "no-underline",
  "hover:bg-surface-secondary",
);
/** Layout classes: sr only. */
export const SR_ONLY_CLASS_NAME = cn("sr-only");

/** Layout classes: a rail item that only the desktop rail shows (phones reach it through "More"). */
export const PHONE_HIDDEN_CLASS_NAME = cn("hidden", "md:flex");
/** Layout classes: the phone-only "More" tab wrapper. */
export const PHONE_ONLY_CLASS_NAME = cn("flex", "flex-1", "md:hidden");
/** Layout classes: breathing room at the end of scrolling pages (keeps bottom-right controls clear of overlays). */
export const PAGE_END_SPACER_CLASS_NAME = cn("h-24", "shrink-0");
/** Layout classes: the workspace name as the switcher trigger (same box as the plain name; looks like text until hovered). */
export const WORKSPACE_TRIGGER_CLASS_NAME = cn("min-w-0", "max-w-full", "cursor-pointer", "rounded-md", "text-left", "hover:opacity-80");

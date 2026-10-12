import { cn } from "@heroui/react";

/** TopBar brand slot: logo, workspace switcher, role chip, founding badge on one line (GAP-3). */
export const BRAND_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-3");
/** The workspace switcher shows from sm; phones keep the logo and role only. */
export const WORKSPACE_NAME_CLASS_NAME = cn("hidden", "min-w-0", "sm:block");
/** Founding badge shows from sm. */
export const BADGE_CLASS_NAME = cn("hidden", "sm:block");
/** TopBar actions: search, new, language, bell, account (GAP-2). */
export const ACTIONS_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-2");
/** Search sits in the bar from lg; below that it leaves the row. */
export const TOPBAR_SEARCH_CLASS_NAME = cn("hidden", "w-full", "max-w-md", "lg:block");
/** "New" label from sm; the plus glyph below. */
export const NEW_LABEL_CLASS_NAME = cn("hidden", "sm:inline");
/** Plus glyph on phones. */
export const NEW_PLUS_CLASS_NAME = cn("sm:hidden");

/** Notification popover body: list then the Office action (GAP-3). */
export const NOTIFY_PANEL_CLASS_NAME = cn("flex", "w-72", "flex-col", "gap-3");
/** Pending rows, one hairline between them (BOUNDARY-3 case-1). */
export const NOTIFY_LIST_CLASS_NAME = cn("divide-y", "divide-separator");
/** One pending row: name action over its summary (GAP-1); separator-facing sides `py-3` (PADDING-3). */
export const NOTIFY_ITEM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "items-start", "gap-1", "py-3", "first:pt-0", "last:pb-0");

/** Compact navigation content inside WorkspaceShell's compact bar (the bar owns its edge, face and inset). */
export const COMPACT_NAV_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "items-center", "justify-between", "gap-2");

/** Screen-reader-only text. */
export const SR_ONLY_CLASS_NAME = cn("sr-only");

/** Breathing room at the end of scrolling pages (keeps bottom-right controls clear of overlays). */
export const PAGE_END_SPACER_CLASS_NAME = cn("h-24", "shrink-0");

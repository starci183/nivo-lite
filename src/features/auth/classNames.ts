import { cn } from "@heroui/react";

/** Split auth screen: brand pane and form pane, stacked on mobile. */
export const AUTH_CANVAS_CLASS_NAME = cn("relative", "grid", "min-h-dvh", "grid-cols-1", "lg:grid-cols-2");
/** Brand pane: its blocks are page regions (GAP-6) inside an inset that steps one rule at the wide breakpoint (PADDING-7: p-6 -> p-8). */
export const AUTH_BRAND_PANE_CLASS_NAME = cn("flex", "flex-col", "justify-center", "gap-8", "p-6", "lg:p-8");
/** Reading measure of the display headline. */
export const AUTH_HEADLINE_CLASS_NAME = cn("max-w-xl");
/** Selling points (GAP-4); List owns the reset. */
export const AUTH_POINTS_CLASS_NAME = cn("flex", "max-w-xl", "flex-col", "gap-4");
/** One point: its tile beside its line (GAP-3). */
export const AUTH_POINT_CLASS_NAME = cn("flex", "items-center", "gap-3");
/** Form pane, same stepped inset as the brand pane (PADDING-7). */
export const AUTH_FORM_PANE_CLASS_NAME = cn("flex", "items-center", "justify-center", "p-6", "lg:p-8");
/** Width of the auth card. */
export const AUTH_CARD_CLASS_NAME = cn("w-full", "max-w-md");
/** Title group above the form inside the card (GAP-5). */
export const AUTH_STACK_CLASS_NAME = cn("flex", "flex-col", "gap-6");
/** Fields of one form step (GAP-4 case-3). */
export const AUTH_FIELDS_CLASS_NAME = cn("flex", "flex-col", "gap-4");
/** Stacked full-width actions (GAP-3). */
export const AUTH_ACTIONS_CLASS_NAME = cn("flex", "w-full", "flex-col", "gap-3");
/** Language switch pinned to the screen corner. */
export const AUTH_LOCALE_CLASS_NAME = cn("absolute", "right-4", "top-4", "z-10", "lg:right-8", "lg:top-6");
/** Points beside the mascot (GAP-4). */
export const AUTH_POINTS_ROW_CLASS_NAME = cn("flex", "max-w-xl", "items-end", "justify-between", "gap-4");
/** Width of the decorative mascot's plain MediaFrame. */
export const AUTH_MASCOT_CLASS_NAME = cn("w-32", "shrink-0", "lg:w-40");
/** Centred text actions under a form (GAP-2 case-3). */
export const AUTH_CENTER_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-center", "gap-2");

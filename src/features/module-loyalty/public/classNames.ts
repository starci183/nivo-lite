import { cn } from "@heroui/react";

/** The page canvas: one centred column, comfortable on a phone. */
export const CANVAS_CLASS_NAME = cn("mx-auto", "flex", "min-h-dvh", "w-full", "max-w-lg", "flex-col", "justify-center", "gap-6", "px-4", "py-8");
/** A card of the page. */
export const CARD_CLASS_NAME = cn("flex", "flex-col", "gap-4", "rounded-xl", "border", "border-separator", "bg-surface", "p-5");
/** Stacked form fields and the button under them. */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3");
/** Big figures: tier and points side by side. */
export const FIGURES_CLASS_NAME = cn("grid", "grid-cols-2", "gap-3");
/** One big figure. */
export const FIGURE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "rounded-lg", "bg-surface-secondary", "p-3");
/** The reward list. */
export const LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "p-0");
/** One reward row. */
export const ROW_CLASS_NAME = cn("flex", "items-start", "justify-between", "gap-3", "border-b", "border-separator", "py-3", "last:border-b-0");
/** Name and note of a reward. */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-0.5");

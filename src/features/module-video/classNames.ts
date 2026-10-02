import { cn } from "@heroui/react";

/** Vertical rhythm of the workbench. */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
/** Stacked fields and blocks inside a card. */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");
/** Tight stack (label over value). */
export const STACK_SM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");
/** A wrapping row of actions or chips. */
export const ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
/** Actions at the bottom of a step: back left, next right, wrapping on phones. */
export const FOOTER_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2", "pt-2");

/** The library grid: one column on phones, more as the room grows. */
export const GRID_CLASS_NAME = cn("m-0", "grid", "list-none", "grid-cols-1", "gap-3", "p-0", "sm:grid-cols-2", "xl:grid-cols-3");
/** One video card. */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "overflow-hidden", "rounded-xl", "border", "border-separator", "bg-surface");
/** The thumbnail area of a card: a fixed 16:9 window so cards of any aspect line up. */
export const THUMB_CLASS_NAME = cn("relative", "flex", "aspect-video", "w-full", "items-center", "justify-center", "overflow-hidden", "bg-surface-secondary");
export const THUMB_IMG_CLASS_NAME = cn("h-full", "w-full", "object-contain");
export const CARD_BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-2", "p-3");

/** Goal choice tiles. */
export const CHOICES_CLASS_NAME = cn("m-0", "grid", "list-none", "grid-cols-1", "gap-2", "p-0", "sm:grid-cols-2", "lg:grid-cols-3");
export const CHOICE_CLASS_NAME = cn("flex", "min-h-20", "w-full", "min-w-0", "cursor-pointer", "flex-col", "items-start", "gap-1", "rounded-lg", "border", "border-separator", "bg-surface", "p-3", "text-left", "outline-none", "focus-visible:outline-2", "focus-visible:outline-focus");
export const CHOICE_ON_CLASS_NAME = cn("border-accent", "bg-surface-secondary");

/** The media picker: square tiles that scroll the page, not sideways. */
export const MEDIA_GRID_CLASS_NAME = cn("m-0", "grid", "list-none", "grid-cols-3", "gap-2", "p-0", "sm:grid-cols-4", "lg:grid-cols-6");
export const MEDIA_TILE_CLASS_NAME = cn("relative", "aspect-square", "w-full", "cursor-pointer", "overflow-hidden", "rounded-lg", "border-2", "border-transparent", "bg-surface-secondary", "p-0", "outline-none", "focus-visible:outline-2", "focus-visible:outline-focus");
export const MEDIA_TILE_ON_CLASS_NAME = cn("border-accent");
export const MEDIA_IMG_CLASS_NAME = cn("h-full", "w-full", "object-cover");

/** The knowledge source list. */
export const SOURCE_CLASS_NAME = cn("flex", "min-w-0", "cursor-pointer", "items-start", "gap-3", "rounded-lg", "border", "border-separator", "p-3");

/** One scene of the script. */
export const SCENE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "rounded-xl", "border", "border-separator", "bg-surface", "p-3", "md:p-4");
export const SCENE_HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2");

/** The storyboard: scenes side by side, scrolling sideways inside the card on narrow screens. */
export const STORYBOARD_CLASS_NAME = cn("m-0", "flex", "list-none", "gap-3", "overflow-x-auto", "p-0", "pb-2");
export const FRAME_CLASS_NAME = cn("relative", "flex", "shrink-0", "items-end", "justify-center", "overflow-hidden", "rounded-lg", "bg-surface-secondary");
export const FRAME_TEXT_CLASS_NAME = cn("w-full", "bg-black/60", "p-2", "text-center", "text-xs", "font-semibold", "leading-snug", "text-white");
export const FRAME_CARD_TEXT_CLASS_NAME = cn("absolute", "inset-0", "flex", "items-center", "justify-center", "p-3", "text-center", "text-sm", "font-bold", "leading-snug", "text-white");

/** The result player. */
export const PLAYER_CLASS_NAME = cn("mx-auto", "block", "max-h-[70vh]", "w-full", "max-w-full", "rounded-lg", "bg-black");

/** Native colour input. */
export const COLOR_CLASS_NAME = cn("h-10", "w-14", "cursor-pointer", "rounded-md", "border", "border-separator", "bg-surface", "p-1");
export const FIELD_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-end", "gap-4");
export const LOGO_CLASS_NAME = cn("h-16", "w-16", "rounded-md", "border", "border-separator", "bg-surface-secondary", "object-contain");

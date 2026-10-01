import { cn } from "@heroui/react";

/* Page frame (outside the console shell): canvas, centred column, generous spacing. */
export const SHELL_CLASS_NAME = cn("relative", "mx-auto", "flex", "min-h-dvh", "w-full", "max-w-5xl", "flex-col", "gap-8", "px-4", "py-6", "sm:px-8", "sm:py-10");
export const TOP_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-4");
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-6");
export const STACK_SM_CLASS_NAME = cn("flex", "flex-col", "gap-3");
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
export const TOP_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-start", "justify-between", "gap-4");
export const LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "gap-3", "p-0");
export const GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-6", "lg:grid-cols-2");
export const CARD_CLASS_NAME = cn("rounded-2xl", "border", "border-divider", "bg-surface", "p-5", "shadow-sm", "sm:p-6");
export const SECTION_TITLE_CLASS_NAME = cn("m-0", "text-lg", "font-semibold", "text-foreground");
export const MUTED_CLASS_NAME = cn("m-0", "text-sm", "text-muted");
export const H1_CLASS_NAME = cn("m-0", "text-2xl", "font-bold", "tracking-tight", "text-foreground", "sm:text-3xl");

/* Stepper: Chọn gói -> Đặt tên -> Thanh toán. */
export const STEPPER_CLASS_NAME = cn("m-0", "flex", "list-none", "items-center", "gap-0", "p-0");
export const STEP_CLASS_NAME = cn("flex", "items-center", "gap-2");
export const STEP_DOT_CLASS_NAME = cn("flex", "size-7", "shrink-0", "items-center", "justify-center", "rounded-full", "border", "text-xs", "font-semibold");
export const STEP_DOT_DONE_CLASS_NAME = cn("border-accent", "bg-accent", "text-white");
export const STEP_DOT_NOW_CLASS_NAME = cn("border-accent", "bg-[var(--nivo-accent-soft)]", "text-accent");
export const STEP_DOT_NEXT_CLASS_NAME = cn("border-divider", "bg-surface", "text-muted");
export const STEP_LABEL_CLASS_NAME = cn("text-sm", "font-medium", "max-sm:hidden");
export const STEP_LABEL_NOW_CLASS_NAME = cn("text-foreground", "max-sm:inline");
export const STEP_LINE_CLASS_NAME = cn("mx-2", "h-px", "w-6", "bg-slate-300", "sm:mx-3", "sm:w-12");

/* Plan cards. */
export const PLANS_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-2");
export const PLAN_CLASS_NAME = cn(
  "relative", "flex", "h-full", "flex-col", "gap-4", "rounded-2xl", "border", "border-divider", "bg-surface", "p-5", "text-left", "transition", "hover:border-foreground/30", "sm:p-6",
);
export const PLAN_ON_CLASS_NAME = cn("!border-accent", "ring-2", "ring-accent/30", "shadow-md");
export const PLAN_TAG_CLASS_NAME = cn("absolute", "-top-3", "left-5", "rounded-full", "bg-accent", "px-3", "py-0.5", "text-xs", "font-semibold", "text-white");
export const PRICE_CLASS_NAME = cn("flex", "items-baseline", "gap-1.5");
export const PRICE_BIG_CLASS_NAME = cn("text-3xl", "font-bold", "tracking-tight", "text-foreground");
export const FEATURES_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "gap-2", "p-0");
export const FEATURE_CLASS_NAME = cn("flex", "items-start", "gap-2", "text-sm", "text-foreground");
export const CHECK_CLASS_NAME = cn("mt-0.5", "size-4", "shrink-0", "text-accent");
export const RADIO_CLASS_NAME = cn("absolute", "right-5", "top-5", "flex", "size-5", "items-center", "justify-center", "rounded-full", "border");

/* Workspace tile + cards. */
export const TILE_CLASS_NAME = cn("flex", "shrink-0", "items-center", "justify-center", "rounded-2xl", "font-bold", "text-white");
export const WS_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2");
export const WS_CARD_CLASS_NAME = cn("flex", "flex-col", "gap-4", "rounded-2xl", "border", "border-divider", "bg-surface", "p-5", "shadow-sm", "transition", "hover:shadow-md");
export const WS_HEAD_CLASS_NAME = cn("flex", "items-center", "gap-4");
export const WS_NAME_CLASS_NAME = cn("m-0", "truncate", "text-base", "font-semibold", "text-foreground");
export const WS_META_CLASS_NAME = cn("m-0", "text-sm", "text-muted");
export const INVITE_CLASS_NAME = cn("flex", "flex-col", "gap-3", "rounded-xl", "border", "border-divider", "bg-surface", "p-4");

/* Empty state. */
export const EMPTY_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-4", "rounded-2xl", "border", "border-dashed", "border-divider", "bg-surface", "px-6", "py-10", "text-center");
export const EMPTY_IMG_CLASS_NAME = cn("h-44", "w-auto", "select-none", "sm:h-52");

/* Payment. */
export const CENTER_CLASS_NAME = cn("flex", "w-full", "max-w-3xl", "flex-col", "gap-6");
export const PAY_CARD_CLASS_NAME = cn("grid", "grid-cols-1", "gap-6", "rounded-3xl", "border", "border-divider", "bg-surface", "p-5", "shadow-md", "sm:p-8", "md:grid-cols-[17rem_1fr]", "md:gap-10");
export const QR_WRAP_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-4");
export const QR_CLASS_NAME = cn("h-auto", "w-full", "max-w-64", "rounded-2xl", "border", "border-divider", "bg-white", "p-3");
export const RING_WRAP_CLASS_NAME = cn("relative", "flex", "size-16", "items-center", "justify-center");
export const RING_TEXT_CLASS_NAME = cn("absolute", "text-xs", "font-semibold", "tabular-nums", "text-foreground");
export const AMOUNT_CLASS_NAME = cn("m-0", "text-4xl", "font-bold", "tracking-tight", "text-foreground");
export const DETAILS_CLASS_NAME = cn("m-0", "flex", "flex-col", "gap-1");
export const DETAIL_ROW_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-3", "border-b", "border-divider", "py-3");
export const CODE_CHIP_CLASS_NAME = cn("rounded-lg", "bg-[var(--nivo-accent-soft)]", "px-3", "py-1", "font-mono", "text-base", "font-bold", "tracking-wider", "text-accent");
export const LIVE_CLASS_NAME = cn("flex", "items-center", "gap-2", "rounded-xl", "bg-default", "px-4", "py-3", "text-sm", "font-medium", "text-foreground");
export const LIVE_DOT_CLASS_NAME = cn("size-2.5", "shrink-0", "animate-pulse", "rounded-full", "bg-accent", "motion-reduce:animate-none");
export const SUCCESS_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-5", "rounded-3xl", "border", "border-divider", "bg-surface", "px-6", "py-10", "text-center", "shadow-md");
export const SUCCESS_IMG_CLASS_NAME = cn("h-56", "w-auto", "select-none");

/* Workspace switcher. */
export const SWITCH_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "gap-1", "p-0");
export const SWITCH_ITEM_CLASS_NAME = cn("flex", "w-full", "items-center", "justify-between", "gap-3", "rounded-lg", "px-3", "py-2", "text-left", "hover:bg-default");

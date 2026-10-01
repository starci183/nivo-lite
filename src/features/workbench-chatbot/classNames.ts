import { cn } from "@heroui/react";

/** Whole workbench: metrics strip above a three-pane inbox. */
export const WORKBENCH_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");

/* ---------- Metrics ---------- */

export const METRICS_CLASS_NAME = cn("grid", "grid-cols-1", "divide-y", "divide-separator", "rounded-lg", "border", "border-separator", "bg-surface", "sm:grid-cols-3", "sm:divide-x", "sm:divide-y-0");
export const METRIC_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-0.5", "px-4", "py-3");
export const METRIC_VALUE_CLASS_NAME = cn("text-2xl", "font-semibold", "leading-8", "text-foreground", "tabular-nums");

/* ---------- Inbox frame ---------- */

export const INBOX_CLASS_NAME = cn("relative", "flex", "h-[var(--office-h,70dvh)]", "min-h-[28rem]", "min-w-0", "overflow-hidden", "rounded-lg", "border", "border-separator", "bg-surface");
export const LIST_PANE_CLASS_NAME = cn("w-full", "min-w-0", "shrink-0", "flex-col", "border-separator", "md:w-80", "md:border-r");
export const THREAD_PANE_CLASS_NAME = cn("min-w-0", "flex-1", "flex-col");
export const SIDE_PANE_CLASS_NAME = cn("absolute", "inset-0", "z-20", "flex-col", "overflow-y-auto", "bg-surface", "sm:left-auto", "sm:w-80", "sm:border-l", "sm:border-separator", "xl:static", "xl:z-auto", "xl:w-80", "xl:shrink-0");
export const HEAD_CLASS_NAME = cn("flex", "min-h-16", "shrink-0", "items-center", "gap-3", "border-b", "border-separator", "px-4", "py-3");
export const HEAD_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col");
export const PHONE_ONLY_CLASS_NAME = cn("flex", "md:hidden");
export const BACK_GLYPH_CLASS_NAME = cn("flex", "rotate-180");
export const HIDDEN_BELOW_MD_CLASS_NAME = cn("hidden", "md:flex");

/* ---------- Conversation list ---------- */

export const FILTERS_CLASS_NAME = cn("flex", "shrink-0", "gap-1", "overflow-x-auto", "px-3", "pb-2");
export const FILTER_CLASS_NAME = cn("shrink-0", "rounded-full", "border", "border-separator", "px-3", "py-1", "text-sm", "text-muted", "hover:bg-surface-secondary");
export const FILTER_ACTIVE_CLASS_NAME = cn("border-accent", "bg-accent-soft", "text-foreground");
export const LIST_BODY_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "overflow-y-auto", "px-2", "pb-2");
export const ROW_CLASS_NAME = cn("flex", "w-full", "items-start", "gap-3", "rounded-lg", "px-3", "py-2.5", "text-left", "text-foreground", "hover:bg-surface-secondary", "focus-visible:outline-2", "focus-visible:outline-accent");
export const ROW_ACTIVE_CLASS_NAME = cn("bg-accent-soft", "hover:bg-accent-soft");
export const ROW_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
export const ROW_LINE_CLASS_NAME = cn("flex", "min-w-0", "items-baseline", "justify-between", "gap-2");
export const ROW_CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-1");

/* ---------- Thread ---------- */

export const THREAD_SCROLL_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-3", "overflow-y-auto", "px-4", "py-4");
export const MSG_ROW_CLASS_NAME = cn("flex", "w-full", "gap-2");
export const MSG_ROW_OUT_CLASS_NAME = cn("justify-end");
export const MSG_COLUMN_CLASS_NAME = cn("flex", "max-w-[85%]", "flex-col", "gap-1", "sm:max-w-[72%]");
export const MSG_COLUMN_OUT_CLASS_NAME = cn("items-end");
export const MSG_AUTHOR_CLASS_NAME = cn("flex", "items-center", "gap-2");
export const BUBBLE_IN_CLASS_NAME = cn("w-fit", "max-w-full", "whitespace-pre-wrap", "break-words", "rounded-2xl", "rounded-tl-md", "bg-surface-secondary", "px-4", "py-2");
export const BUBBLE_AI_CLASS_NAME = cn("w-fit", "max-w-full", "whitespace-pre-wrap", "break-words", "rounded-2xl", "rounded-tr-md", "border", "border-separator", "bg-surface", "px-4", "py-2");
export const BUBBLE_HUMAN_CLASS_NAME = cn("w-fit", "max-w-full", "whitespace-pre-wrap", "break-words", "rounded-2xl", "rounded-tr-md", "bg-accent-soft", "px-4", "py-2");
export const SYSTEM_LINE_CLASS_NAME = cn("flex", "items-center", "justify-center", "gap-3", "px-6", "py-1", "text-center");
export const SYSTEM_RULE_CLASS_NAME = cn("h-px", "min-w-6", "flex-1", "bg-separator");
export const DELIVERY_CLASS_NAME = cn("flex", "items-center", "gap-1");

/* ---------- Composer ---------- */

export const COMPOSER_CLASS_NAME = cn("flex", "shrink-0", "flex-col", "gap-2", "border-t", "border-separator", "bg-surface", "px-4", "pt-3", "pb-3");
export const COMPOSER_ROW_CLASS_NAME = cn("flex", "items-end", "gap-2");
export const COMPOSER_FIELD_CLASS_NAME = cn("min-w-0", "flex-1");

/* ---------- Side panel ---------- */

export const SIDE_SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "px-4", "py-4");
export const SIDE_FACTS_CLASS_NAME = cn("grid", "grid-cols-[5.5rem_1fr]", "gap-x-3", "gap-y-1.5");
export const CUSTOMER_HEAD_CLASS_NAME = cn("flex", "items-center", "gap-3");
export const ESCALATION_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "bg-surface-secondary", "px-4", "py-4");
export const QUOTE_CLASS_NAME = cn("whitespace-pre-wrap", "break-words", "border-l-2", "border-separator", "pl-3");
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
export const EMPTY_CLASS_NAME = cn("flex", "flex-1", "items-center", "justify-center", "p-6");

import { cn } from "@heroui/react";

/** The public pages a candidate sees (apply, pick an interview time, answer an offer): one centred column, no console chrome. */
export const CANVAS_CLASS_NAME = cn("flex", "min-h-dvh", "justify-center", "bg-background", "px-4", "py-8", "md:py-12");
export const COLUMN_CLASS_NAME = cn("flex", "w-full", "max-w-2xl", "flex-col", "gap-6");
export const CARD_CLASS_NAME = cn("flex", "flex-col", "gap-4", "rounded-xl", "border", "border-separator", "bg-surface", "p-4", "md:p-6");
export const FACTS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-2");
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-4");
export const PRE_CLASS_NAME = cn("m-0", "whitespace-pre-wrap", "break-words", "text-sm", "leading-relaxed");
export const SLOTS_CLASS_NAME = cn("flex", "flex-col", "gap-2");
export const FOOT_CLASS_NAME = cn("text-center");
/** Hidden from people, present for bots: the honeypot field. */
export const HONEYPOT_CLASS_NAME = cn("absolute", "-left-[9999px]", "h-0", "w-0", "overflow-hidden");

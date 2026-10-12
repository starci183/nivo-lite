import { cn } from "@heroui/react";

/** The public apply form: stacked fields (GAP-4 case-3). */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-4");
/** The candidate's answer choices, stacked (GAP-2). */
export const SLOTS_CLASS_NAME = cn("flex", "flex-col", "gap-2");
// grammar gap: no Common honeypot field; the bot trap stays a raw input, visually hidden and aria-hidden.
/** Hidden from people, present for bots: the honeypot field. */
export const HONEYPOT_CLASS_NAME = cn("sr-only");

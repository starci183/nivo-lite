import { cn } from "@heroui/react";

/** Chat beside the draft column from xl (GAP-5). */
export const GRID_CLASS_NAME = cn("grid", "min-w-0", "grid-cols-1", "items-start", "gap-6", "xl:grid-cols-2");
/** Header and composer bands of the chat: separator-facing inset (PADDING-3 case-3). */
export const CHAT_BAND_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "px-4", "py-3");
export const COMPOSER_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "px-4", "py-3");
/** The field beside the action that submits it (GAP-3 case-1). */
export const COMPOSER_ROW_CLASS_NAME = cn("flex", "min-w-0", "items-end", "gap-3");
export const COMPOSER_FIELD_CLASS_NAME = cn("min-w-0", "flex-1");
/** Messages stacked in the conversation scroll owner (GAP-3, PADDING-4). */
export const THREAD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "p-4");
export const ROW_CLASS_NAME = cn("flex", "min-w-0", "justify-start");

export const SIDE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
/** Draft facts (GAP-2). */
export const FACTS_CLASS_NAME = cn("flex", "flex-col", "gap-2");
/** Gates: one separator between rows, none at the edges (BOUNDARY-3 case-1). */
export const GATE_LIST_CLASS_NAME = cn("divide-y", "divide-separator");
export const GATE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "py-3", "first:pt-0", "last:pb-0");
export const GATE_HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2");
export const GATE_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
/** Evidence keeps the owner's line breaks; long words wrap. */
export const EVIDENCE_CLASS_NAME = cn("whitespace-pre-wrap", "break-words");
/** One version row of the Grammar list card: BOUNDARY-2 case-1 with the band inset (PADDING-4 inline, PADDING-3 block). */
export const VERSION_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
export const VERSION_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");
/** Confirm cards under NIVO's reply (an approval card in the bubble footer). */
export const WRITES_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
export const WRITE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "rounded-lg", "border", "border-separator", "p-3");
export const WRITE_HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2");
export const WRITE_FIELDS_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");

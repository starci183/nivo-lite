import { cn } from "@heroui/react";

/** Column holding the status row above the card and the card itself. */
export const APPROVAL_CARD_COLUMN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");

/** Status row above the joined card. */
export const APPROVAL_CARD_STATUS_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");

/** First band of the joined card. */
export const APPROVAL_CARD_BAND_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "px-4", "py-4");

/** Later bands separated by an edge-to-edge hairline. */
export const APPROVAL_CARD_BAND_DIVIDED_CLASS_NAME = cn(
  "flex",
  "min-w-0",
  "flex-col",
  "gap-3",
  "border-t",
  "border-separator",
  "px-4",
  "py-4",
);

/** The quoted draft surface. */
export const APPROVAL_CARD_QUOTE_CLASS_NAME = cn("min-w-0", "rounded-2xl", "rounded-tl-sm", "bg-surface-secondary", "px-4", "py-3", "whitespace-pre-wrap");

/** Row that holds the footer facts and the open-lead link. */
export const APPROVAL_CARD_META_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2");

/** Approve and reject side by side. */
export const APPROVAL_CARD_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");

/** Channel label + character count row above the draft bubble. */
export const APPROVAL_CARD_DRAFT_META_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2");

/** Edit / copy actions under the bubble. */
export const APPROVAL_CARD_DRAFT_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");

/** Label group with the AI chip. */
export const APPROVAL_CARD_LABEL_GROUP_CLASS_NAME = cn("flex", "items-center", "gap-2");

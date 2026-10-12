import { cn } from "@heroui/react"

/* ---------- Messenger frame ---------- */

/**
 * Columns inside the messenger SurfaceCard. Office is full-bleed (frameless card, no page inset), so the body paints the surface
 * itself and its column seams run from the header seam to the window's bottom edge.
 */
export const MESSENGER_BODY_CLASS_NAME = cn("flex", "h-full", "min-h-0", "min-w-0", "bg-surface")

/** Left column: conversation list. Full width on phones, fixed width beside the thread from md; one inline seam (BOUNDARY-4 case-3). */
export const LIST_COLUMN_CLASS_NAME = cn("flex", "w-full", "min-w-0", "shrink-0", "flex-col", "border-separator", "md:w-72", "md:border-r", "xl:w-80")

/** Hidden on phones (thread is showing), visible from md. */
export const PHONE_HIDDEN_CLASS_NAME = cn("hidden", "md:flex")

/** Centre column: thread header, scrolling messages, pinned composer. */
export const THREAD_COLUMN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col")

/** Docked info column on wide screens (below that the panel opens in a Grammar Drawer); one inline seam (BOUNDARY-4 case-3). */
export const INFO_COLUMN_CLASS_NAME = cn("flex", "w-72", "shrink-0", "flex-col", "border-l", "border-separator", "2xl:w-80")

/* ---------- Column headers ---------- */

/** Shared header band of every column, one fixed height so the three column heads line up: one trailing seam (BOUNDARY-1 case-2), separator-facing inset (PADDING-3). */
export const COLUMN_HEAD_CLASS_NAME = cn("flex", "h-18", "shrink-0", "items-center", "gap-3", "border-b", "border-separator", "px-4")

/** Title block inside a header: grows and truncates. */
export const HEAD_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col")

/** Right-side controls inside a header. */
export const HEAD_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "items-center", "gap-2")

/** Back arrow only on phones. */
export const PHONE_ONLY_CLASS_NAME = cn("flex", "md:hidden")

/** Group mark in the thread header: hidden on phones to leave room for the title. */
export const HEAD_AVATAR_CLASS_NAME = cn("hidden", "shrink-0", "md:flex")

/* ---------- Conversation list ---------- */

/** Search box band under the list header. */
export const LIST_SEARCH_CLASS_NAME = cn("shrink-0", "px-3", "pt-3", "pb-2")

/** Scrolling list body: sections stacked (GAP-4). */
export const LIST_BODY_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-4", "overflow-y-auto", "px-2", "pb-4")

/** One list section: caption and its ListBox (GAP-1). */
export const LIST_SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-1")

/** Section caption row. */
export const LIST_CAPTION_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-2", "px-3", "pt-2", "pb-1")

/** Trailing cell of a conversation row: time over the waiting count. */
export const LIST_TRAILING_CLASS_NAME = cn("flex", "shrink-0", "flex-col", "items-end", "gap-1")

/* ---------- Thread ---------- */

/** Scroll region holding the messages (no app-painted ground: ChatBubble owns the incoming and outgoing faces, SURFACE-3/4). */
export const THREAD_SCROLL_CLASS_NAME = cn("min-h-0", "flex-1", "overflow-y-auto", "overscroll-contain")

/** Message column inside the scroll region. */
export const THREAD_BODY_CLASS_NAME = cn("mx-auto", "flex", "w-full", "max-w-4xl", "flex-col", "gap-1", "px-3", "py-4", "sm:px-6")

/** Promo slot at the top of the thread (scrolls away with history). */
export const PROMO_SLOT_CLASS_NAME = cn("pb-3")

/** Day separator band: air around the labelled Divider. */
export const DAY_CLASS_NAME = cn("py-3")

/** First row of an author group gets air above it. */
export const ROW_FIRST_CLASS_NAME = cn("mt-3")

/** Avatar column, also the spacer for grouped rows. */
export const AVATAR_SLOT_CLASS_NAME = cn("flex", "w-8", "shrink-0", "justify-center", "self-start", "sm:w-10")

/** System notice: centred line. */
export const NOTICE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-center", "gap-2", "py-2", "text-center")

/** Typing indicator row keeps its height so the layout does not jump. */
export const TYPING_CLASS_NAME = cn("min-h-6", "px-12", "pt-1")

/* ---------- Approval and exception cards in the thread ---------- */

/**
 * Width of a decision card in the thread (the nested SurfaceCard inside owns face, outline and inset: BOUNDARY-5). Grammar 0.9.3 gives a
 * ChatBubble with a footer a definite stack width and stretches the footer, so the card can take the footer's width up to 36rem.
 */
export const APPROVAL_CARD_CLASS_NAME = cn("w-full", "max-w-xl")

/** Content stack inside a decision card (GAP-3). */
export const APPROVAL_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-3")

/** Status row: badges and the lead action. */
export const APPROVAL_STATUS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Text stack inside the card. */
export const APPROVAL_TEXT_CLASS_NAME = cn("flex", "flex-col", "gap-1")

/** Draft or proposal band: recessed neutral band (SURFACE-3) with the soft notice corner (RADIUS-5 case-2). */
export const APPROVAL_QUOTE_CLASS_NAME = cn("flex", "flex-col", "gap-1", "whitespace-pre-wrap", "break-words", "rounded-xl", "bg-surface-secondary", "text-foreground", "px-3", "py-2")

/** Decision buttons. */
export const APPROVAL_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Pushes the lead link to the end of the status row. */
export const APPROVAL_LINK_CLASS_NAME = cn("ml-auto")

/* ---------- Composer ---------- */

/** Composer: the card's closing band, one leading seam (BOUNDARY-1 case-3). */
export const COMPOSER_CLASS_NAME = cn("flex", "shrink-0", "flex-col", "gap-2", "border-t", "border-separator", "px-4", "pt-3", "pb-4")

/** Quick prompt chips: one row that scrolls sideways instead of wrapping. */
export const CHIPS_CLASS_NAME = cn("flex", "gap-2", "overflow-x-auto", "pb-1")

/** Input row: @ button, textarea, send. */
export const COMPOSER_ROW_CLASS_NAME = cn("flex", "items-center", "gap-2")

/** Textarea host grows. */
export const COMPOSER_FIELD_CLASS_NAME = cn("min-w-0", "flex-1")

/** Text column in a mention option or member row. */
export const MEMBER_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col")

/* ---------- Info panel ---------- */

/** Docked panel body: scrolls inside the column. */
export const INFO_BODY_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-6", "overflow-y-auto", "p-4")

/** Drawer panel body: the Drawer owns inset and scroll. */
export const INFO_DRAWER_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-6")

/** One panel section. */
export const INFO_SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-2")

/** Section title row with count. */
export const INFO_TITLE_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-2")

/** Content of a compact pending card (the nested whole-action SurfaceCard owns the outline and the press). */
export const PENDING_ROW_CLASS_NAME = cn("flex", "w-full", "items-start", "gap-3")

/** Member row. */
export const MEMBER_ROW_CLASS_NAME = cn("flex", "items-start", "gap-3", "py-1")

/** Member quick actions. */
export const MEMBER_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-1")

/* ---------- Tasks view ---------- */

/** Scrolling tasks body in the centre column. */
export const TASKS_SCROLL_CLASS_NAME = cn("min-h-0", "flex-1", "overflow-y-auto", "p-4", "sm:p-6")

/** Stack of regions inside the tasks view. */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** Filter row. */
export const FILTERS_CLASS_NAME = cn("flex", "flex-wrap", "items-end", "gap-4")

/** One filter's width (the Select owns its own field face). */
export const FILTER_CARD_CLASS_NAME = cn("w-full", "sm:w-60")

/** Task row. */
export const TASK_ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3", "px-4", "py-4", "list-none", "sm:flex-row", "sm:items-center", "sm:gap-4")

/** Row main column. */
export const TASK_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")

/** Title line: title and status badge. */
export const TASK_TITLE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Row side action. */
export const TASK_SIDE_CLASS_NAME = cn("flex", "items-center", "gap-3")

/** Visually hidden text for screen readers. */
export const SR_ONLY_CLASS_NAME = cn("sr-only")

/** Shown from sm up. */
export const WIDE_ONLY_CLASS_NAME = cn("hidden", "sm:inline")

/** Shown below sm only. */
export const NARROW_ONLY_CLASS_NAME = cn("inline", "sm:hidden")

/* ---------- Exception cards ---------- */

/** Stack of inputs inside an exception card. */
export const EXCEPTION_FIELDS_CLASS_NAME = cn("flex", "flex-col", "gap-3")

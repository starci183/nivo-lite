import { cn } from "@heroui/react"

/* ---------- Messenger frame ---------- */

/**
 * The messenger box. Its height comes from `--office-h`, measured at runtime so the thread fills the
 * viewport under whatever chrome the shell draws (falls back to 70dvh before the first measure).
 */
export const MESSENGER_CLASS_NAME = cn(
  "relative",
  "flex",
  "h-[var(--office-h,70dvh)]",
  "min-h-96",
  "min-w-0",
  "overflow-hidden",
  "rounded-lg",
  "border",
  "border-separator",
  "bg-surface",
)

/** Left column: conversation list. Full width on phones, fixed width beside the thread from md. */
export const LIST_COLUMN_CLASS_NAME = cn("flex", "w-full", "min-w-0", "shrink-0", "flex-col", "border-separator", "md:w-72", "md:border-r", "xl:w-80")

/** Hidden on phones (thread is showing), visible from md. */
export const PHONE_HIDDEN_CLASS_NAME = cn("hidden", "md:flex")

/** Centre column: thread header, scrolling messages, pinned composer. */
export const THREAD_COLUMN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col")

/** Right column when it takes space (xl and up). */
export const INFO_COLUMN_CLASS_NAME = cn(
  "absolute",
  "inset-0",
  "z-20",
  "flex",
  "flex-col",
  "bg-surface",
  "sm:left-auto",
  "sm:w-80",
  "sm:border-l",
  "sm:border-separator",
  "xl:static",
  "xl:z-auto",
  "xl:w-72",
  "xl:shrink-0",
  "2xl:w-80",
)

/* ---------- Column headers ---------- */

/** Shared header bar height and padding for all three columns. */
export const COLUMN_HEAD_CLASS_NAME = cn("flex", "min-h-16", "shrink-0", "items-center", "gap-3", "border-b", "border-separator", "px-4", "py-3")

/** Title block inside a header: grows and truncates. */
export const HEAD_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col")

/** Right-side controls inside a header. */
export const HEAD_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "items-center", "gap-2")

/** Back arrow only on phones. */
export const PHONE_ONLY_CLASS_NAME = cn("flex", "md:hidden")

/** Mirrors the "next" arrow so it points back. */
export const BACK_GLYPH_CLASS_NAME = cn("flex", "rotate-180")

/* ---------- Conversation list ---------- */

/** Search box band under the list header. */
export const LIST_SEARCH_CLASS_NAME = cn("shrink-0", "px-3", "pt-3", "pb-2")

/** Scrolling list body. */
export const LIST_BODY_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-4", "overflow-y-auto", "px-2", "pb-4")

/** One list section: caption and rows. */
export const LIST_SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-1")

/** Section caption row. */
export const LIST_CAPTION_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-2", "px-3", "pt-2", "pb-1")

/** One conversation row (button or link). */
export const LIST_ROW_CLASS_NAME = cn(
  "flex",
  "w-full",
  "min-h-16",
  "items-center",
  "gap-3",
  "rounded-lg",
  "px-3",
  "py-2",
  "text-left",
  "text-foreground",
  "no-underline",
  "hover:bg-surface-secondary",
  "focus-visible:outline-2",
  "focus-visible:outline-accent",
)

/** The selected row gets the blush selection surface. */
export const LIST_ROW_ACTIVE_CLASS_NAME = cn("bg-accent-soft", "hover:bg-accent-soft")

/** Row text column. */
export const LIST_ROW_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col")

/** Row first line: name and time. */
export const LIST_ROW_TOP_CLASS_NAME = cn("flex", "min-w-0", "items-baseline", "justify-between", "gap-2")

/** Row second line: preview and count. */
export const LIST_ROW_BOTTOM_CLASS_NAME = cn("flex", "min-w-0", "items-center", "justify-between", "gap-2")

/** Keeps the time / count from shrinking. */
export const NO_SHRINK_CLASS_NAME = cn("shrink-0")

/** Round crimson unread-style counter. */
export const COUNT_DOT_CLASS_NAME = cn(
  "grid",
  "h-5",
  "min-w-5",
  "shrink-0",
  "place-items-center",
  "rounded-full",
  "bg-accent",
  "px-1",
  "text-xs",
  "font-semibold",
  "text-accent-foreground",
)

/* ---------- Thread ---------- */

/** Scroll region holding the messages. */
export const THREAD_SCROLL_CLASS_NAME = cn("min-h-0", "flex-1", "overflow-y-auto", "overscroll-contain")

/** Message column inside the scroll region. */
export const THREAD_BODY_CLASS_NAME = cn("mx-auto", "flex", "w-full", "max-w-4xl", "flex-col", "gap-1", "px-3", "py-4", "sm:px-6")

/** Promo slot at the top of the thread (scrolls away with history). */
export const PROMO_SLOT_CLASS_NAME = cn("pb-3")

/** Day separator: rule, label, rule. */
export const DAY_CLASS_NAME = cn("flex", "items-center", "gap-3", "py-3")

/** Rule beside a day label. */
export const DAY_RULE_CLASS_NAME = cn("h-px", "flex-1", "bg-separator")

/** A message from someone else: avatar then bubble column. */
export const ROW_THEIRS_CLASS_NAME = cn("group", "flex", "items-end", "gap-2", "pr-6", "sm:pr-16")

/** A message from me: right-aligned. */
export const ROW_MINE_CLASS_NAME = cn("group", "flex", "flex-row-reverse", "items-end", "gap-2", "pl-10", "sm:pl-24")

/** First row of an author group gets air above it. */
export const ROW_FIRST_CLASS_NAME = cn("mt-3")

/** Avatar column, also the spacer for grouped rows. */
export const AVATAR_SLOT_CLASS_NAME = cn("flex", "w-8", "shrink-0", "justify-center", "self-start", "sm:w-10")

/** Bubble column: author line, bubble, actions. */
export const BUBBLE_COLUMN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")

/** Right-align the column contents for my messages. */
export const BUBBLE_COLUMN_MINE_CLASS_NAME = cn("items-end")

/** Author line above a bubble. */
export const AUTHOR_LINE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2", "px-1")

/** Bubble from someone else. */
export const BUBBLE_THEIRS_CLASS_NAME = cn("w-fit", "max-w-full", "whitespace-pre-wrap", "break-words", "rounded-2xl", "rounded-tl-md", "bg-surface-secondary", "px-4", "py-2")

/** My bubble: blush selection surface. */
export const BUBBLE_MINE_CLASS_NAME = cn("w-fit", "max-w-full", "whitespace-pre-wrap", "break-words", "rounded-2xl", "rounded-tr-md", "bg-accent-soft", "px-4", "py-2")

/** Positions the hover actions against the bubble. */
export const BUBBLE_WRAP_CLASS_NAME = cn("relative", "flex", "max-w-full", "flex-col")

/** Hover actions floating over the bubble's top edge (pointer devices only). */
export const BUBBLE_ACTIONS_CLASS_NAME = cn(
  "absolute",
  "-top-5",
  "right-2",
  "z-10",
  "hidden",
  "items-center",
  "gap-1",
  "rounded-lg",
  "border",
  "border-separator",
  "bg-surface",
  "px-1",
  "opacity-0",
  "md:flex",
  "md:group-hover:opacity-100",
  "md:focus-within:opacity-100",
)

/** My bubble's actions sit on the right edge. */
export const BUBBLE_ACTIONS_MINE_CLASS_NAME = cn("right-auto", "left-2")

/** @mention token in a message. */
export const MENTION_CLASS_NAME = cn("font-medium", "text-accent")

/** System notice: centred pill. */
export const NOTICE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-center", "gap-2", "py-2", "text-center")

/** Typing indicator row keeps its height so the layout does not jump. */
export const TYPING_CLASS_NAME = cn("min-h-6", "px-12", "pt-1")

/* ---------- Approval card in the thread ---------- */

/** Approval card: bordered white card inside the thread. */
export const APPROVAL_CARD_CLASS_NAME = cn(
  "flex",
  "w-full",
  "max-w-xl",
  "flex-col",
  "gap-3",
  "rounded-2xl",
  "rounded-tl-md",
  "border",
  "border-separator",
  "bg-surface",
  "p-4",
  "transition-shadow",
)

/** Ring shown briefly when the header chip jumps to a card. */
export const APPROVAL_FOCUS_CLASS_NAME = cn("ring-2", "ring-accent", "ring-offset-2")

/** Status row: badge and AI chip. */
export const APPROVAL_STATUS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Text stack inside the card. */
export const APPROVAL_TEXT_CLASS_NAME = cn("flex", "flex-col", "gap-1")

/** Draft quote. */
export const APPROVAL_QUOTE_CLASS_NAME = cn("whitespace-pre-wrap", "break-words", "rounded-lg", "border-l-2", "border-accent", "bg-surface-secondary", "px-3", "py-2")

/** Decision buttons. */
export const APPROVAL_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Pushes the lead link to the end of the action row. */
export const APPROVAL_LINK_CLASS_NAME = cn("ml-auto")

/** AI chip wrapper (coral fill from brand.css). */
export const AI_CHIP_CLASS_NAME = cn("nivo-ai-chip")

/* ---------- Composer ---------- */

/** Composer region pinned under the thread. */
export const COMPOSER_CLASS_NAME = cn("relative", "flex", "shrink-0", "flex-col", "gap-2", "border-t", "border-separator", "bg-surface", "px-3", "pt-2", "pb-3", "sm:px-4")

/** Quick prompt chips: one row that scrolls sideways instead of wrapping. */
export const CHIPS_CLASS_NAME = cn("flex", "gap-2", "overflow-x-auto", "pb-1")

/** Input row: @ button, textarea, send. */
export const COMPOSER_ROW_CLASS_NAME = cn("flex", "items-center", "gap-2")

/** Textarea host grows. */
export const COMPOSER_FIELD_CLASS_NAME = cn(
  "min-w-0",
  "flex-1",
  "[&_textarea]:min-h-11!",
  "[&_textarea]:max-h-40!",
  "[&_textarea]:resize-none!",
  "[&_textarea]:[field-sizing:content]",
)

/** Mention autocomplete list above the composer. */
export const MENTION_LIST_CLASS_NAME = cn("absolute", "bottom-full", "left-3", "right-3", "z-10", "mb-1", "flex", "flex-col", "rounded-lg", "border", "border-separator", "bg-surface", "p-1")

/** One option in the mention list. */
export const MENTION_OPTION_CLASS_NAME = cn("flex", "w-full", "items-center", "gap-3", "rounded-lg", "px-3", "py-2", "text-left", "hover:bg-surface-secondary")

/** Highlighted mention option. */
export const MENTION_ACTIVE_CLASS_NAME = cn("bg-accent-soft")

/** Text column in a mention option or member row. */
export const MEMBER_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col")

/* ---------- Info panel ---------- */

/** Scrolling panel body. */
export const INFO_BODY_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-6", "overflow-y-auto", "p-4")

/** One panel section. */
export const INFO_SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-2")

/** Section title row with count. */
export const INFO_TITLE_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-2")

/** Compact pending row (button). */
export const PENDING_ROW_CLASS_NAME = cn(
  "flex",
  "w-full",
  "items-start",
  "gap-3",
  "rounded-lg",
  "border",
  "border-separator",
  "px-3",
  "py-2",
  "text-left",
  "hover:bg-surface-secondary",
  "focus-visible:outline-2",
  "focus-visible:outline-accent",
)

/** Member row. */
export const MEMBER_ROW_CLASS_NAME = cn("flex", "items-start", "gap-3", "py-1")

/** Member quick actions. */
export const MEMBER_ACTIONS_CLASS_NAME = cn("-ml-3", "flex", "flex-wrap", "items-center", "gap-1")

/* ---------- Tasks view ---------- */

/** Scrolling tasks body in the centre column. */
export const TASKS_SCROLL_CLASS_NAME = cn("min-h-0", "flex-1", "overflow-y-auto", "p-4", "sm:p-6")

/** Stack of regions inside the tasks view. */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** Filter cards row. */
export const FILTERS_CLASS_NAME = cn("flex", "flex-wrap", "items-end", "gap-4")

/** One filter card. */
export const FILTER_CARD_CLASS_NAME = cn("w-full", "rounded-lg", "border", "border-separator", "bg-surface", "p-3", "sm:w-60")

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

/** Round group avatar (Office group chat). */
export const GROUP_AVATAR_CLASS_NAME = cn("grid", "size-10", "shrink-0", "place-items-center", "rounded-full", "bg-accent-soft", "text-accent")

/** Group avatar in the thread header: hidden on phones to leave room for the title. */
export const HEAD_AVATAR_CLASS_NAME = cn("hidden", "size-10", "shrink-0", "place-items-center", "rounded-full", "bg-accent-soft", "text-accent", "md:grid")

/** Shown from sm up. */
export const WIDE_ONLY_CLASS_NAME = cn("hidden", "sm:inline")

/** Shown below sm only. */
export const NARROW_ONLY_CLASS_NAME = cn("inline", "sm:hidden")

/* ---------- NIVO Core and exception cards ---------- */

/** Round white tile holding the NIVO mark, used as the NIVO avatar. */
export const NIVO_AVATAR_CLASS_NAME = cn("inline-flex", "size-8", "items-center", "justify-center", "rounded-full", "border", "border-separator", "bg-surface")

/** NIVO message bubble: neutral surface with a coral edge so it reads as the company core. */
export const BUBBLE_NIVO_CLASS_NAME = cn("w-fit", "max-w-full", "whitespace-pre-wrap", "break-words", "rounded-2xl", "rounded-tl-md", "border-l-2", "border-accent", "bg-surface-secondary", "px-4", "py-2")

/** Stack of inputs inside an exception card. */
export const EXCEPTION_FIELDS_CLASS_NAME = cn("flex", "flex-col", "gap-3")

/** Candidate radio row. */
export const EXCEPTION_CANDIDATE_CLASS_NAME = cn("flex", "w-full", "items-center", "gap-2", "rounded-lg", "border", "border-separator", "px-3", "py-2", "text-left")

/** Selected candidate ring. */
export const EXCEPTION_CANDIDATE_ON_CLASS_NAME = cn("border-accent", "bg-accent-soft")

/** Mention option NIVO mark tile. */
export const NIVO_OPTION_MARK_CLASS_NAME = cn("inline-flex", "size-8", "shrink-0", "items-center", "justify-center", "rounded-full", "border", "border-separator", "bg-surface")
